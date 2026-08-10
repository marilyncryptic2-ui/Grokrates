import type {
  AssetGroupRow, BoardEntry, ExposureGroup, Snapshot, StrategyResult, VenueRow, YieldOpportunity,
} from "./types";
import {
  RATE_ARB_MIN_SPREAD, displayName,
} from "./config/curation";
import { round2 } from "./strategies/looping";
import { buildRoute, type PoolLite, type RouteResult } from "./strategies/route";
import { groupOf, isLoopableProtocol, effectiveLtv } from "./config/groups";
import type { FundingInfo } from "./adapters/funding";

// ═══ Strategy construction ════════════════════════════════════════
// Loops live in the multi-venue route engine (buildRoute / snapshot.routes).
// Per-venue StrategyResult rows only carry: fixed (Pendle PT) and rate-arb.
// Single-venue buildLoop and delta-neutral are fully retired.


function effective(o: YieldOpportunity): number {
  // Total yield the holder actually earns.
  // Native-source pools (Lido, Sky, Ethena, LSTs…): apy already IS the native
  // yield and nativeYield === apy → return apy once (no double-count).
  // Venue pools (Aave, Morpho…): venue rate + any attached native yield on the
  // same asset (e.g. supplying wstETH earns Aave supply APY + Lido staking).
  const venueReal = o.apyMean30d != null ? o.apyMean30d : o.apy;
  if (o.nativeYield > 0 && Math.abs(o.nativeYield - o.apy) < 1e-9) {
    return round2(venueReal); // pure native source
  }
  return round2(venueReal + (o.nativeYield > 0 ? o.nativeYield : 0));
}

function buildFixed(pt: YieldOpportunity): StrategyResult {
  return {
    kind: "fixed",
    label: `Fixed ${pt.exitTerms.replace("matures ", "to ")}`,
    netApy: round2(pt.apy),
    leverage: null, maxLeverage: null, liquidationBufferPct: null, breakEvenBorrowApy: null,
    stages: null,
    protocolsUsed: ["Pendle"],
    steps: [
      `Buy PT-${displayName(pt.asset)} on Pendle (${pt.chain}) at today's discount.`,
      `The PT redeems 1:1 at maturity (${pt.exitTerms.replace("matures ", "")}) — that discount is a locked ${round2(pt.apy)}% annualized.`,
      `Nothing to manage until maturity.`,
    ],
    risks: [
      `Exiting before maturity means selling the PT at market price — the rate is only guaranteed if held to term.`,
      `Underlying protocol risk (the yield source backing ${displayName(pt.asset)}) still applies.`,
    ],
    basedOn: pt.id,
  };
}

function buildRateArb(bestLend: YieldOpportunity, cheapBorrow: YieldOpportunity): StrategyResult | null {
  if (cheapBorrow.borrowApy == null) return null;
  const lend = bestLend.apyMean30d ?? bestLend.apy;
  const spread = round2(lend - cheapBorrow.borrowApy);
  if (spread < RATE_ARB_MIN_SPREAD) return null;
  return {
    kind: "rate-arb",
    label: `Rate arb +${spread} pts`,
    netApy: spread,
    leverage: null, maxLeverage: null, liquidationBufferPct: null, breakEvenBorrowApy: null,
    stages: null,
    protocolsUsed: [cheapBorrow.protocolLabel, bestLend.protocolLabel],
    steps: [
      `Borrow ${displayName(bestLend.asset)} on ${cheapBorrow.protocolLabel} (${cheapBorrow.chain}) at ${round2(cheapBorrow.borrowApy)}% against collateral you already hold.`,
      `Lend it on ${bestLend.protocolLabel} (${bestLend.chain}) at ${round2(lend)}% realized.`,
      `The ${spread} pt spread is yours until rates converge — this is yield on borrowed money, on top of whatever your collateral earns.`,
    ],
    risks: [
      `The spread compresses as capital piles in; the borrow rate can spike above the lend rate — exit when the spread closes.`,
      `Your borrow creates liquidation risk against your collateral — size conservatively.`,
      `Uses the realized lend rate, not advertised — advertised is ${round2(bestLend.apy)}%.`,
    ],
    basedOn: bestLend.id,
  };
}

// ═══ Assembly: venue rows -> asset groups -> board -> top10 ═══════

export function buildSnapshotFromData(
  opps: YieldOpportunity[],
  _funding: Record<string, FundingInfo>,
  warnings: string[],
): Snapshot {
  const clean = opps.filter((o) => !o.flags.includes("apy-implausible"));
  const borrowables = clean.filter((o) => o.borrowApy != null);

  // Per-asset best-lend / cheapest-borrow (for rate arb), USD assets only
  // where both sides exist and the asset is a plain lending asset.
  const arbAssets = ["USDC", "USDT", "DAI", "USDS", "WETH", "SOL", "WSOL"];

  const venueRowsByAsset = new Map<string, VenueRow[]>();
  for (const o of clean) {
    if (o.flags.includes("pt-fixed")) continue; // PTs attach as strategies, not rows
    // Loop product is the multi-venue route engine (snapshot.routes), not a
    // per-venue StrategyResult. Fixed (Pendle) and rate-arb still attach here.
    // Delta-neutral and single-venue buildLoop are fully retired.
    const strategies: StrategyResult[] = [];
    const key = displayName(o.asset);
    const arr = venueRowsByAsset.get(key) ?? [];
    arr.push({ opp: o, strategies });
    venueRowsByAsset.set(key, arr);
  }

  // Attach PT fixed to the matching asset's best venue row.
  const pts = clean.filter((o) => o.flags.includes("pt-fixed"));
  for (const pt of pts) {
    const rows = venueRowsByAsset.get(displayName(pt.asset));
    if (!rows?.length) continue;
    const best = rows[0];
    if (!best.strategies.some((s) => s.kind === "fixed" && s.netApy >= pt.apy)) {
      best.strategies = best.strategies.filter((s) => s.kind !== "fixed");
      best.strategies.push(buildFixed(pt));
    }
  }

  // Rate arb per arb asset.
  for (const asset of arbAssets) {
    const lends = clean.filter((o) => o.asset === asset && !o.flags.includes("pt-fixed"));
    const borrows = borrowables.filter((o) => o.asset === asset);
    if (!lends.length || !borrows.length) continue;
    const bestLend = lends.slice().sort((a, b) => (b.apyMean30d ?? b.apy) - (a.apyMean30d ?? a.apy))[0];
    const cheap = borrows.slice().sort((a, b) => (a.borrowApy ?? 99) - (b.borrowApy ?? 99))[0];
    if (bestLend.protocol === cheap.protocol && bestLend.chain === cheap.chain) continue;
    const arb = buildRateArb(bestLend, cheap);
    if (!arb) continue;
    const rows = venueRowsByAsset.get(displayName(asset));
    const target = rows?.find((r) => r.opp.id === bestLend.id) ?? rows?.[0];
    if (target && !target.strategies.some((s) => s.kind === "rate-arb")) target.strategies.push(arb);
  }

  // Groups
  const groups: AssetGroupRow[] = [];
  for (const [asset, venues] of venueRowsByAsset) {
    venues.sort((a, b) => effective(b.opp) - effective(a.opp));
    const totals = venues.map((v) => effective(v.opp));
    groups.push({
      asset,
      exposure: venues[0].opp.exposure,
      venueCount: venues.length,
      apyRange: [round2(Math.min(...totals)), round2(Math.max(...totals))],
      best: venues[0],
      venues,
    });
  }
  groups.sort((a, b) => effective(b.best.opp) - effective(a.best.opp));

  // Board
  const GROUP_ORDER: ExposureGroup[] = ["ETH", "BTC", "SOL", "USD", "RWA"];
  const board: BoardEntry[] = GROUP_ORDER.map((exposure) => {
    const inGroup = groups.filter((g) => g.exposure === exposure);
    let baseApy: number | null = null, baseVenue: string | null = null;
    let overlayApy: number | null = null, overlayLabel: string | null = null, overlayVenue: string | null = null;
    for (const g of inGroup) {
      const e = effective(g.best.opp);
      if (baseApy == null || e > baseApy) { baseApy = e; baseVenue = `${g.asset} · ${g.best.opp.protocolLabel}`; }
      for (const v of g.venues) for (const s of v.strategies) {
        if (overlayApy == null || s.netApy > overlayApy) {
          overlayApy = s.netApy; overlayLabel = s.label; overlayVenue = `${g.asset} · ${v.opp.protocolLabel}`;
        }
      }
    }
    return { exposure, baseApy, baseVenue, overlayApy, overlayLabel, overlayVenue };
  }).filter((b) => b.baseApy != null);

  // Top 10: bases + strategies compete, ranked by realized effective.
  const candidates: Snapshot["top10"] = [];
  for (const g of groups) {
    candidates.push({
      rank: 0, asset: g.asset, venue: g.best.opp.protocolLabel, chain: g.best.opp.chain,
      strategyLabel: null, effectiveApy: effective(g.best.opp), tvlUsd: g.best.opp.tvlUsd, url: g.best.opp.url,
    });
    for (const v of g.venues) for (const s of v.strategies) {
      candidates.push({
        rank: 0, asset: g.asset, venue: v.opp.protocolLabel, chain: v.opp.chain,
        strategyLabel: s.label, effectiveApy: s.netApy, tvlUsd: v.opp.tvlUsd, url: v.opp.url,
      });
    }
  }
  const seen = new Set<string>();
  const top10 = candidates
    .sort((a, b) => b.effectiveApy - a.effectiveApy)
    .filter((c) => {
      const k = `${c.asset}:${c.venue}:${c.strategyLabel ?? "base"}`;
      if (seen.has(k)) return false; seen.add(k); return true;
    })
    .slice(0, 10)
    .map((c, i) => ({ ...c, rank: i + 1 }));

  const routes = buildRoutes(clean);

  return {
    updatedAt: new Date().toISOString(),
    groups, board, top10, routes, warnings,
    poolCount: clean.length,
  };
}

// ── Wire real pool data into the route engine ──
// Map opportunities to PoolLite, then run the greedy route engine once per
// correlation group, starting from the group's deepest-TVL asset.
function buildRoutes(opps: YieldOpportunity[]): RouteResult[] {
  const pools: PoolLite[] = opps.map((o) => {
    // Use the real e-mode LTV for correlated pairs where we have it; the
    // route engine only borrows same-group assets, so e-mode is the correct
    // LTV. Falls back to the live standard-mode LTV from the feed.
    const ltv = effectiveLtv(o.protocol, o.asset, o.ltv);
    return {
      asset: o.asset.toUpperCase(),
      venue: o.protocolLabel,
      chain: o.chain,
      supplyApy: effective(o), // realized total yield (native + venue rate)
      borrowApy: o.borrowApy,
      poolLtv: ltv,
      loopable: isLoopableProtocol(o.protocol) && o.borrowApy != null && o.borrowApy >= 0.01 && ltv != null && ltv > 0,
    };
  });

  // Starting asset per group = the one with the most pools (proxy for depth),
  // among assets that are actually in a correlation group.
  const byGroup = new Map<string, Map<string, number>>();
  for (const p of pools) {
    const g = groupOf(p.asset);
    if (!g) continue;
    const m = byGroup.get(g) ?? new Map();
    m.set(p.asset, (m.get(p.asset) ?? 0) + 1);
    byGroup.set(g, m);
  }

  const routes: RouteResult[] = [];
  for (const [, assetCounts] of byGroup) {
    // Try the top few candidate start assets in the group; keep the best route.
    const starts = [...assetCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map((e) => e[0]);
    let best: RouteResult | null = null;
    for (const startAsset of starts) {
      const r = buildRoute(startAsset, 10_000, pools);
      if (!r) continue;
      if (!best || r.netApy > best.netApy) best = r;
    }
    if (best) routes.push(best);
  }
  return routes.sort((a, b) => b.netApy - a.netApy);
}

export { effective };

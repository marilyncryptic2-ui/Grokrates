import type { AdapterResult, YieldOpportunity } from "../types";
import { exposureOf, ACCESS_GATE, EXIT_TERMS, TVL_FLOOR_USD, MIN_APY } from "../config/curation";

const MORPHO_GQL = "https://api.morpho.org/graphql";

const QUERY = `
query {
  markets(
    first: 200
    orderBy: SupplyAssetsUsd
    orderDirection: Desc
    where: { chainId_in: [1, 8453, 42161, 10, 137] }
  ) {
    items {
      uniqueKey
      lltv
      loanAsset { symbol address }
      collateralAsset { symbol address }
      state {
        supplyApy
        borrowApy
        supplyAssetsUsd
        borrowAssetsUsd
        rewards { supplyApr borrowApr }
      }
    }
  }
}`;

function normalize(sym: string | null | undefined): string | null {
  if (!sym) return null;
  const s = sym.toUpperCase().trim();
  if (s === "WETH") return "WETH";
  if (s === "WSTETH") return "WSTETH";
  if (s === "WEETH") return "WEETH";
  if (s === "USDC") return "USDC";
  if (s === "USDT") return "USDT";
  if (s === "USDE") return "USDE";
  if (s === "SUSDE") return "SUSDE";
  if (s === "WBTC") return "WBTC";
  if (s === "CBBTC") return "CBBTC";
  return s;
}

export async function fetchMorpho(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  try {
    const res = await fetch(MORPHO_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY }),
      cache: "no-store",
    });
    if (!res.ok) {
      warnings.push(`morpho HTTP ${res.status}`);
      return { opps: [], warnings };
    }
    const json = await res.json();
    if (json.errors?.length) {
      warnings.push(`morpho GQL: ${json.errors[0]?.message ?? "unknown"}`);
      return { opps: [], warnings };
    }

    const items = json.data?.markets?.items ?? [];
    for (const m of items) {
      // Morpho Blue is isolated markets: loanAsset is the borrowable, collateral is separate.
      // For our engine we need supply side of the loan asset (what you earn when supplying the loan asset)
      // and the borrow APY of that same market.
      const loanSym = normalize(m.loanAsset?.symbol);
      if (!loanSym) continue;
      const exposure = exposureOf(loanSym);
      if (!exposure) continue;

      const supplyApy = (m.state?.supplyApy ?? 0) * 100; // Morpho returns decimal
      const borrowApy = (m.state?.borrowApy ?? 0) * 100;
      const tvl = m.state?.supplyAssetsUsd ?? 0;

      if (!isFinite(supplyApy) || supplyApy < MIN_APY) continue;
      if (!isFinite(tvl) || tvl < TVL_FLOOR_USD) continue;

      // LLTV is the liquidation LTV for this isolated market (0–1 ray style or decimal)
      let ltv: number | null = null;
      if (m.lltv != null) {
        const raw = Number(m.lltv);
        ltv = raw > 1 ? raw / 1e18 : raw; // some return ray
        if (ltv > 1) ltv = ltv / 1e18;
        if (ltv <= 0 || ltv > 1) ltv = null;
      }

      const rewardApr = (m.state?.rewards ?? []).reduce((s: number, r: any) => s + (r.supplyApr ?? 0), 0) * 100;
      const totalSupply = supplyApy + rewardApr;

      const flags: string[] = [];
      if (totalSupply > 25) flags.push("apy-implausible");
      if (rewardApr > supplyApy * 0.7) flags.push("reward-heavy");

      opps.push({
        id: `morpho:${m.uniqueKey}`,
        source: "morpho",
        protocol: "morpho-blue",
        protocolLabel: "Morpho",
        chain: "Ethereum", // refined later if we add chain field
        asset: loanSym,
        exposure,
        apy: totalSupply,
        nativeYield: 0,
        totalApy: totalSupply,
        apyBase: supplyApy,
        apyReward: rewardApr,
        apyMean30d: null,
        tvlUsd: tvl,
        url: `https://app.morpho.org/market?id=${m.uniqueKey}`,
        borrowApy: isFinite(borrowApy) && borrowApy >= 0.01 ? borrowApy : null,
        ltv,
        liquidationThreshold: ltv,
        exitTerms: EXIT_TERMS[loanSym] ?? "instant",
        access: ACCESS_GATE[loanSym] ?? "open",
        updatedAt: now,
        flags,
      });
    }

    if (opps.length < 3) warnings.push(`morpho returned only ${opps.length} markets`);
  } catch (e) {
    warnings.push(`morpho error: ${String(e)}`);
  }

  return { opps, warnings };
}

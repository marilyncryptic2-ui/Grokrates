import { groupOf, safeLtv, gasForChain, MIN_SPREAD, MAX_STEPS, MIN_CARRY_USD, LOOP_MARGIN } from "../config/groups";
import type { ExposureGroup } from "../types";

// ── The greedy route engine (#10) with park-aware optimal stop ──
// At every step the decision is: LOOP (supply best loopable + borrow cheapest)
// or PARK (supply at best rate anywhere and stop). Take whichever produces
// more total yield on the current carry.

export interface PoolLite {
  asset: string;
  venue: string;
  chain: string;
  supplyApy: number;
  borrowApy: number | null;
  poolLtv: number | null;
  loopable: boolean;
}

export interface RouteStep {
  step: number;
  supplyAsset: string;
  supplyVenue: string;
  supplyChain: string;
  supplyApy: number;
  borrowAsset: string;
  borrowVenue: string;
  borrowApy: number;
  spread: number;
  suppliedUsd: number;
  borrowedUsd: number;
  safeLtvUsed: number;
  gasUsd: number;
  isPark?: boolean;
}

export interface RouteResult {
  startAsset: string;
  group: ExposureGroup;
  steps: RouteStep[];
  totalSuppliedUsd: number;
  totalBorrowedUsd: number;
  grossYieldUsd: number;
  borrowCostUsd: number;
  gasUsd: number;
  netUsd: number;
  netApy: number;
  bestPassiveApy: number;
  bestPassiveVenue: string;
  show: "route" | "passive";
}

function bestLoopableSupply(asset: string, pools: PoolLite[]): PoolLite | null {
  const cands = pools.filter(
    (p) => p.asset === asset && p.loopable && p.poolLtv != null && p.poolLtv > 0
  );
  if (!cands.length) return null;
  return cands.reduce((a, b) => (b.supplyApy > a.supplyApy ? b : a));
}

const MIN_VALID_BORROW = 0.01;
function cheapestBorrowAt(
  venue: string, chain: string, group: ExposureGroup, _supplyAsset: string, pools: PoolLite[]
): PoolLite | null {
  const cands = pools.filter(
    (p) => p.venue === venue && p.chain === chain &&
      p.borrowApy != null && p.borrowApy >= MIN_VALID_BORROW &&
      groupOf(p.asset) === group
  );
  if (!cands.length) return null;
  return cands.reduce((a, b) => ((b.borrowApy ?? 99) < (a.borrowApy ?? 99) ? b : a));
}

function bestSupplyAnywhere(asset: string, group: ExposureGroup, pools: PoolLite[]): PoolLite | null {
  const cands = pools.filter((p) => p.asset === asset && groupOf(p.asset) === group);
  if (!cands.length) return null;
  return cands.reduce((a, b) => (b.supplyApy > a.supplyApy ? b : a));
}

function bestPassiveInGroup(group: ExposureGroup, pools: PoolLite[]): { apy: number; venue: string; asset: string } {
  const cands = pools.filter((p) => groupOf(p.asset) === group);
  if (!cands.length) return { apy: 0, venue: "—", asset: "—" };
  const best = cands.reduce((a, b) => (b.supplyApy > a.supplyApy ? b : a));
  return { apy: best.supplyApy, venue: best.venue, asset: best.asset };
}

/**
 * Annual $ yield if we park `carry` now at the best rate for `holding`.
 */
function parkNowYield(holding: string, group: ExposureGroup, carry: number, pools: PoolLite[]): number {
  const park = bestSupplyAnywhere(holding, group, pools);
  if (!park || park.supplyApy <= 0) return 0;
  return carry * (park.supplyApy / 100);
}

/**
 * Annual $ yield if we take ONE more loop step then park the residual.
 * Returns null if a loop is not possible (no venue, no borrow, spread too thin).
 */
function loopOnceThenParkYield(
  holding: string,
  group: ExposureGroup,
  carry: number,
  pools: PoolLite[]
): { yieldUsd: number; supply: PoolLite; borrow: PoolLite; sLtv: number; residual: number } | null {
  const supply = bestLoopableSupply(holding, pools);
  if (!supply || supply.poolLtv == null) return null;
  const borrow = cheapestBorrowAt(supply.venue, supply.chain, group, holding, pools);
  if (!borrow || borrow.borrowApy == null) return null;

  const spread = supply.supplyApy - borrow.borrowApy;
  if (spread < MIN_SPREAD) return null;

  const sLtv = safeLtv(supply.poolLtv, group);
  if (sLtv <= 0) return null;
  const residual = carry * sLtv;

  // Yield from supplying the current carry at the loopable rate
  const supplyEarn = carry * (supply.supplyApy / 100);
  // Cost of borrowing the residual
  const borrowCost = residual * (borrow.borrowApy / 100);
  // Park the residual at the best rate for the borrowed asset
  const residualPark = bestSupplyAnywhere(borrow.asset, group, pools);
  const parkEarn = residual * ((residualPark?.supplyApy ?? 0) / 100);

  return {
    yieldUsd: supplyEarn + parkEarn - borrowCost,
    supply,
    borrow,
    sLtv,
    residual,
  };
}

export function buildRoute(startAsset: string, capitalUsd: number, pools: PoolLite[]): RouteResult | null {
  const A = startAsset.toUpperCase();
  const group = groupOf(A);
  if (!group) return null;

  const steps: RouteStep[] = [];
  let holding = A;
  let carry = capitalUsd;

  for (let i = 1; i <= MAX_STEPS; i++) {
    if (carry < MIN_CARRY_USD) break;

    // Decision: park everything now, or take one more loop then park residual?
    const parkYield = parkNowYield(holding, group, carry, pools);
    const loopOpt = loopOnceThenParkYield(holding, group, carry, pools);

    // Prefer loop only when it strictly beats parking now.
    // If loop is impossible or worse, stop and park.
    if (!loopOpt || loopOpt.yieldUsd <= parkYield) {
      break;
    }

    const { supply, borrow, sLtv, residual } = loopOpt;
    const gas = gasForChain(supply.chain);
    const spread = supply.supplyApy - (borrow.borrowApy ?? 0);

    steps.push({
      step: i,
      supplyAsset: holding,
      supplyVenue: supply.venue,
      supplyChain: supply.chain,
      supplyApy: supply.supplyApy,
      borrowAsset: borrow.asset,
      borrowVenue: borrow.venue,
      borrowApy: borrow.borrowApy ?? 0,
      spread: round2(spread),
      suppliedUsd: Math.round(carry),
      borrowedUsd: Math.round(residual),
      safeLtvUsed: round2(sLtv),
      gasUsd: gas,
    });

    holding = borrow.asset;
    carry = residual;
  }

  // FINAL PARK STEP — always park whatever we still hold (if we have any steps
  // or even if we never looped, the honesty gate / passive path handles pure passive).
  if (steps.length > 0 && carry >= MIN_CARRY_USD) {
    const park = bestSupplyAnywhere(holding, group, pools);
    if (park && park.supplyApy > 0) {
      steps.push({
        step: steps.length + 1,
        supplyAsset: holding,
        supplyVenue: park.venue,
        supplyChain: park.chain,
        supplyApy: park.supplyApy,
        borrowAsset: "—",
        borrowVenue: "—",
        borrowApy: 0,
        spread: 0,
        suppliedUsd: Math.round(carry),
        borrowedUsd: 0,
        safeLtvUsed: 0,
        gasUsd: gasForChain(park.chain),
        isPark: true,
      });
    }
  }

  const passive = bestPassiveInGroup(group, pools);

  if (!steps.length) {
    return {
      startAsset: A, group, steps: [],
      totalSuppliedUsd: 0, totalBorrowedUsd: 0, grossYieldUsd: 0, borrowCostUsd: 0,
      gasUsd: 0, netUsd: 0, netApy: 0,
      bestPassiveApy: passive.apy, bestPassiveVenue: `${passive.asset} · ${passive.venue}`, show: "passive",
    };
  }

  const totalSupplied = steps.reduce((s, x) => s + x.suppliedUsd, 0);
  const totalBorrowed = steps.reduce((s, x) => s + x.borrowedUsd, 0);
  const grossYield = steps.reduce((s, x) => s + x.suppliedUsd * (x.supplyApy / 100), 0);
  const borrowCost = steps.reduce((s, x) => s + x.borrowedUsd * (x.borrowApy / 100), 0);
  const gas = steps.reduce((s, x) => s + x.gasUsd, 0);
  const net = grossYield - borrowCost;
  const netApy = (net / capitalUsd) * 100;

  return {
    startAsset: A, group, steps,
    totalSuppliedUsd: Math.round(totalSupplied),
    totalBorrowedUsd: Math.round(totalBorrowed),
    grossYieldUsd: round2(grossYield),
    borrowCostUsd: round2(borrowCost),
    gasUsd: round2(gas),
    netUsd: round2(net),
    netApy: round2(netApy),
    bestPassiveApy: passive.apy,
    bestPassiveVenue: `${passive.asset} · ${passive.venue}`,
    show: netApy > passive.apy + LOOP_MARGIN ? "route" : "passive",
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Loop math v2. Pure functions, unit-tested.
//
// KEY FIX vs v1: for yield-bearing collateral, the levered rate is the
// asset's TOTAL yield (native token yield + venue supply APY), not the
// venue supply APY alone — Aave pays ~0% on wstETH; the 2.2% lives in
// the token. netAPY(L) = totalYield*L − borrowAPY*(L−1).
//
// "Safe leverage" targets health factor HF against the liquidation
// threshold LT: utilizedLTV(L) = (L−1)/L, HF = LT/utilizedLTV
//   => L_safe = 1 / (1 − LT/HF), capped at L_max = 1/(1−LTV).

import type { LoopStage } from "../types";

export interface LoopInputs {
  totalYield: number;           // percent — native + venue supply
  borrowApy: number;            // percent
  ltv: number;                  // 0..1
  liquidationThreshold: number; // 0..1
  targetHealthFactor?: number;
}

export interface LoopOutputs {
  maxLeverage: number;
  safeLeverage: number;
  netApyAtSafe: number;
  netApyAtMax: number;
  liquidationBufferPct: number;
  breakEvenBorrowApy: number;
  profitable: boolean;
  stages: LoopStage[];          // per-cycle build toward safe leverage, per $10k
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function loopApy(totalYield: number, borrowApy: number, L: number): number {
  return totalYield * L - borrowApy * (L - 1);
}

export function maxLeverage(ltv: number): number {
  return ltv > 0 && ltv < 1 ? 1 / (1 - ltv) : 1;
}

export function safeLeverage(lt: number, targetHF: number): number {
  const utilized = lt / targetHF;
  if (utilized <= 0) return 1;
  if (utilized >= 1) return Infinity;
  return 1 / (1 - utilized);
}

export function liquidationBufferPct(L: number, lt: number): number {
  if (L <= 1) return 100;
  const utilized = (L - 1) / L;
  return Math.max(0, (1 - utilized / lt) * 100);
}

// Build the cycle-by-cycle table: each cycle borrows ltvPerCycle of the
// last deposit and redeposits, converging on target leverage. We cap at
// 6 displayed cycles and end with the final position.
export function buildStages(targetL: number, ltv: number, lt: number): LoopStage[] {
  const stages: LoopStage[] = [];
  const P = 10_000;
  let deposited = P;
  let borrowed = 0;
  // Per-cycle borrow fraction chosen so the series converges to targetL:
  // targetL = 1/(1-f) => f = 1 - 1/targetL
  const f = Math.max(0, Math.min(ltv, 1 - 1 / targetL));
  let lastDeposit = P;
  for (let c = 1; c <= 6; c++) {
    const draw = lastDeposit * f;
    if (draw < P * 0.005) break;
    borrowed += draw;
    deposited += draw;
    lastDeposit = draw;
    const cumLtv = borrowed / deposited;
    stages.push({
      cycle: c,
      deposited: Math.round(deposited),
      borrowed: Math.round(borrowed),
      cumulativeLtv: round2(cumLtv * 100) / 100,
      bufferPts: round2((lt - cumLtv) * 100),
    });
  }
  // Final converged position
  const finalDeposited = Math.round(P * targetL);
  const finalBorrowed = Math.round(P * (targetL - 1));
  const finalLtv = finalBorrowed / finalDeposited;
  stages.push({
    cycle: 0, // 0 = "final"
    deposited: finalDeposited,
    borrowed: finalBorrowed,
    cumulativeLtv: round2(finalLtv * 100) / 100,
    bufferPts: round2((lt - finalLtv) * 100),
  });
  return stages;
}

export const MIN_LIQ_BUFFER = 0.05; // hard floor: position stays >=5pts below liquidation threshold

export function computeLoop(i: LoopInputs): LoopOutputs {
  const targetHF = i.targetHealthFactor ?? 1.25;
  const maxL = maxLeverage(i.ltv);
  // Two safety constraints, take whichever is MORE conservative:
  //  (a) target health factor against the liquidation threshold
  //  (b) hard 5-point buffer: utilized LTV <= (LT - 0.05)
  // Leverage where utilized LTV = X is L = 1/(1-X).
  const hfLeverage = safeLeverage(i.liquidationThreshold, targetHF);
  const bufferCap = Math.max(0, i.liquidationThreshold - MIN_LIQ_BUFFER);
  const bufferLeverage = bufferCap > 0 && bufferCap < 1 ? 1 / (1 - bufferCap) : Infinity;
  const safeL = Math.min(hfLeverage, bufferLeverage, maxL);
  return {
    maxLeverage: round2(maxL),
    safeLeverage: round2(safeL),
    netApyAtSafe: round2(loopApy(i.totalYield, i.borrowApy, safeL)),
    netApyAtMax: round2(loopApy(i.totalYield, i.borrowApy, maxL)),
    liquidationBufferPct: round2(liquidationBufferPct(safeL, i.liquidationThreshold)),
    breakEvenBorrowApy: round2(i.totalYield),
    profitable: i.borrowApy < i.totalYield,
    stages: buildStages(safeL, i.ltv, i.liquidationThreshold),
  };
}

// Delta-neutral: capital split between yield leg and short margin at k.
// net = (yield + funding) * k/(k+1). Funding is 30d mean annualized.
export function deltaNeutralApy(totalYield: number, funding30dPct: number, k: number): number {
  return round2((totalYield + funding30dPct) * (k / (k + 1)));
}

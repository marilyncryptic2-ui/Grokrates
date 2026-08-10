import { test } from "node:test";
import assert from "node:assert/strict";
import { loopApy, maxLeverage, safeLeverage, computeLoop, buildStages, deltaNeutralApy } from "../lib/strategies/looping.ts";

test("max leverage from LTV", () => {
  assert.ok(Math.abs(maxLeverage(0.8) - 5) < 1e-9);
  assert.ok(Math.abs(maxLeverage(0.935) - 15.3846) < 0.001);
  assert.equal(maxLeverage(0), 1);
});

test("loop APY uses total yield (native fix)", () => {
  // wstETH: venue ~0%, native 2.2% -> totalYield 2.2. Borrow ETH 1.9%, 4x:
  // 2.2*4 - 1.9*3 = 8.8 - 5.7 = 3.1 — a real number, not garbage from 0.00001%.
  assert.ok(Math.abs(loopApy(2.2, 1.9, 4) - 3.1) < 1e-9);
});

test("safe leverage hits target HF", () => {
  const L = safeLeverage(0.955, 1.25); // Aave e-mode wstETH LT
  const utilized = (L - 1) / L;
  assert.ok(Math.abs(0.955 / utilized - 1.25) < 1e-6);
});

test("stage table converges to target leverage and buffers shrink", () => {
  const stages = buildStages(4, 0.935, 0.955);
  const final = stages[stages.length - 1];
  assert.equal(final.cycle, 0);
  assert.ok(Math.abs(final.deposited - 40000) < 1);
  assert.ok(Math.abs(final.borrowed - 30000) < 1);
  // Buffers monotonically shrink across build cycles.
  const cycles = stages.filter((s) => s.cycle > 0);
  for (let i = 1; i < cycles.length; i++) assert.ok(cycles[i].bufferPts <= cycles[i - 1].bufferPts);
  assert.ok(final.bufferPts > 0);
});

test("computeLoop e-mode wstETH realistic", () => {
  const r = computeLoop({ totalYield: 2.2, borrowApy: 1.9, ltv: 0.935, liquidationThreshold: 0.955 });
  assert.ok(r.profitable);
  assert.ok(r.safeLeverage > 3 && r.safeLeverage < 5.5);
  assert.ok(r.netApyAtSafe > 2.2, "loop must beat holding");
  assert.equal(r.breakEvenBorrowApy, 2.2);
  assert.ok(r.stages.length >= 3);
});

test("unprofitable loop flagged", () => {
  const r = computeLoop({ totalYield: 2, borrowApy: 3.5, ltv: 0.9, liquidationThreshold: 0.93 });
  assert.equal(r.profitable, false);
});

test("5% buffer floor caps leverage below liquidation threshold", () => {
  // Tight LT with a high HF that would otherwise push right up near LT.
  const r = computeLoop({ totalYield: 6, borrowApy: 2, ltv: 0.97, liquidationThreshold: 0.98, targetHealthFactor: 1.02 });
  // Utilized LTV at safe leverage must be <= LT - 0.05 = 0.93.
  const utilized = (r.safeLeverage - 1) / r.safeLeverage;
  assert.ok(utilized <= 0.93 + 0.002, `utilized ${utilized} must respect 5pt floor`);
  assert.ok(r.liquidationBufferPct >= 4.9, `buffer ${r.liquidationBufferPct}% must be >=5%`);
});

test("delta-neutral capital split", () => {
  // (3 + 8) * 3/4 = 8.25
  assert.ok(Math.abs(deltaNeutralApy(3, 8, 3) - 8.25) < 1e-9);
  // negative funding can sink below yield
  assert.ok(deltaNeutralApy(3, -6, 3) < 0);
});

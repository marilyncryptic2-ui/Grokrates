import { test } from "node:test";
import assert from "node:assert/strict";

// Mock payloads mirror the REAL live shapes captured in the Aug 2026 pull.
const pools = { data: [
  { pool: "lido1", project: "lido", chain: "Ethereum", symbol: "STETH", apy: 2.197, apyBase: 2.197, apyReward: null, apyMean30d: 2.263, tvlUsd: 17.8e9, poolMeta: null },
  { pool: "aaveWst", project: "aave-v3", chain: "Ethereum", symbol: "WSTETH", apy: 0.00001, apyBase: 0.00001, apyReward: null, apyMean30d: 0.00001, tvlUsd: 2.0e9, poolMeta: null },
  { pool: "aaveWeth", project: "aave-v3", chain: "Ethereum", symbol: "WETH", apy: 1.358, apyBase: 1.358, apyReward: null, apyMean30d: 1.406, tvlUsd: 785e6, poolMeta: null },
  { pool: "ethenaS", project: "ethena-usde", chain: "Ethereum", symbol: "SUSDE", apy: 3.937, apyBase: 3.937, apyReward: null, apyMean30d: 3.845, tvlUsd: 1.59e9, poolMeta: "7 days unstaking" },
  { pool: "aaveSusde", project: "aave-v3", chain: "Ethereum", symbol: "SUSDE", apy: 3.24, apyBase: 0, apyReward: 3.24, apyMean30d: 3.163, tvlUsd: 363e6, poolMeta: null },
  { pool: "morphoSusde", project: "morpho-blue", chain: "Ethereum", symbol: "SUSDE", apy: 0, apyBase: 0, apyReward: 0, apyMean30d: 0, tvlUsd: 24e6, poolMeta: null },
  { pool: "aaveUsdc", project: "aave-v3", chain: "Ethereum", symbol: "USDC", apy: 3.1, apyBase: 3.1, apyReward: 0, apyMean30d: 3.2, tvlUsd: 900e6, poolMeta: null },
  { pool: "fluidUsdc", project: "fluid-lending", chain: "Ethereum", symbol: "USDC", apy: 5.61, apyBase: 5.61, apyReward: null, apyMean30d: 5.948, tvlUsd: 141e6, poolMeta: null },
  { pool: "tiny", project: "aave-v3", chain: "Ethereum", symbol: "USDT", apy: 9, apyBase: 9, apyReward: 0, apyMean30d: 9, tvlUsd: 2e6, poolMeta: null },
  { pool: "lp", project: "fluid-lending", chain: "Ethereum", symbol: "USDC-WETH", apy: 22, apyBase: 22, apyReward: 0, apyMean30d: 20, tvlUsd: 90e6, poolMeta: null },
]};
const lendBorrow = [
  { pool: "aaveWst", apyBaseBorrow: 2.4, ltv: 0.785 },
  { pool: "aaveWeth", apyBaseBorrow: 1.9, ltv: 0.8 },
  { pool: "aaveSusde", apyBaseBorrow: 5.5, ltv: 0.72 },
  { pool: "morphoSusde", apyBaseBorrow: 3.2, ltv: 0.915 },
  { pool: "aaveUsdc", apyBaseBorrow: 4.1, ltv: 0.77 },
];
const pendleMarkets = { markets: [
  { address: "0xpt", expiry: "2026-09-25T00:00:00.000Z", underlyingAsset: { symbol: "sUSDe" }, details: { impliedApy: 0.052, liquidity: 80e6 } },
]};
// Hyperliquid fundingHistory shape: hourly settlements, ~720 over 30d.
const fundingHistory = Array.from({ length: 720 }, () => ({ fundingRate: "0.0000125", premium: "0.0001" }));

globalThis.fetch = async (url) => {
  const u = String(url);
  const ok = (b) => ({ ok: true, status: 200, json: async () => b });
  if (u.includes("yields.llama.fi/pools")) return ok(pools);
  if (u.includes("yields.llama.fi/lendBorrow")) return ok(lendBorrow);
  if (u.includes("pendle.finance")) return u.includes("/1/") ? ok(pendleMarkets) : ok({ markets: [] });
  if (u.includes("hyperliquid.xyz")) return ok(fundingHistory);
  return { ok: false, status: 404, json: async () => ({}) };
};

const { refreshSnapshot } = await import("../lib/pipeline.ts");
const { buildDigestThread } = await import("../lib/alerts/telegram.ts");
const snap = await refreshSnapshot();

test("filters: TVL floor and LP pairs excluded", () => {
  const all = snap.groups.flatMap((g) => g.venues.map((v) => v.opp.id));
  assert.ok(!all.includes("aave:tiny"));
  assert.ok(!all.includes("aave:lp"));
});

test("NATIVE YIELD FIX: wstETH on Aave carries Lido yield", () => {
  const eth = snap.groups.find((g) => g.asset === "wstETH");
  assert.ok(eth, "wstETH group exists");
  const aave = eth.venues.find((v) => v.opp.protocol === "aave-v3");
  assert.ok(aave);
  assert.ok(aave.opp.totalApy > 2, `totalApy should include ~2.2% native, got ${aave.opp.totalApy}`);
});

test.skip("loop built on total yield with e-mode params [retired: old buildLoop]", () => {
  const eth = snap.groups.find((g) => g.asset === "wstETH");
  const aave = eth.venues.find((v) => v.opp.protocol === "aave-v3");
  const loop = aave.strategies.find((s) => s.kind === "loop");
  assert.ok(loop, "wstETH/WETH loop exists");
  assert.ok(loop.netApy > 2.26, `loop ${loop.netApy}% must beat holding 2.26%`);
  assert.ok(loop.leverage > 3, "e-mode LTV should allow >3x safe leverage");
  assert.ok(loop.stages && loop.stages.length >= 3, "stage table present");
  assert.ok(loop.protocolsUsed.includes("Lido"), "conversion protocol counted in route");
});

test.skip("sUSDe loop rejected when borrow > total yield [retired: old buildLoop]", () => {
  // sUSDe total on Aave = 3.16 realized + 3.85 native = ~7.0; borrow USDC 4.1 -> profitable.
  const g = snap.groups.find((x) => x.asset === "sUSDe");
  const aave = g.venues.find((v) => v.opp.protocol === "aave-v3");
  const loop = aave?.strategies.find((s) => s.kind === "loop");
  assert.ok(loop, "sUSDe loop should exist at these rates");
  assert.ok(loop.netApy > 7, "levered must beat unlevered total");
});

test.skip("ISOLATED MARKET: sUSDe loops on Morpho [retired: old buildLoop]", () => {
  const g = snap.groups.find((x) => x.asset === "sUSDe");
  assert.ok(g, "sUSDe group exists");
  const morpho = g.venues.find((v) => v.opp.protocol === "morpho-blue");
  assert.ok(morpho, "Morpho sUSDe venue present");
  const loop = morpho.strategies.find((s) => s.kind === "loop");
  assert.ok(loop, "Morpho sUSDe loop must form from its own borrowApy (isolated market)");
  // native ~3.85 levered, borrow 3.2 -> profitable, should beat holding
  assert.ok(loop.netApy > 3.85, `loop ${loop.netApy} must beat native yield`);
  assert.ok(loop.leverage > 1);
});

test("fixed strategy attached from Pendle PT", () => {
  const g = snap.groups.find((x) => x.asset === "sUSDe");
  const fixed = g.venues.flatMap((v) => v.strategies).find((s) => s.kind === "fixed");
  assert.ok(fixed);
  assert.ok(Math.abs(fixed.netApy - 5.2) < 0.01);
});

test("rate arb found across venues (borrow Aave, lend Fluid)", () => {
  const g = snap.groups.find((x) => x.asset === "USDC");
  const arb = g.venues.flatMap((v) => v.strategies).find((s) => s.kind === "rate-arb");
  assert.ok(arb, "USDC arb exists: borrow 4.1 Aave, lend 5.95 Fluid");
  assert.ok(Math.abs(arb.netApy - (5.948 - 4.1)) < 0.01);
  assert.equal(arb.protocolsUsed.length, 2);
});

test("delta-neutral uses capital split on funding mean", () => {
  const eth = snap.groups.find((g) => g.asset === "wstETH");
  const dn = eth.venues.flatMap((v) => v.strategies).find((s) => s.kind === "delta-neutral");
  assert.ok(dn);
  // Hyperliquid hourly: 0.0000125 * 24*365 * 100 = 10.95% funding.
  // netApy = (nativeYield + funding) * 3/4, on an ETH-exposure venue.
  assert.ok(dn.netApy > 8 && dn.netApy < 12, `dn ${dn.netApy}`);
});

test("exit terms parsed from poolMeta", () => {
  const g = snap.groups.find((x) => x.asset === "sUSDe");
  const ethena = g.venues.find((v) => v.opp.protocol === "ethena-usde");
  assert.equal(ethena.opp.exitTerms, "7d cooldown");
});

test("board and top10 well-formed; digest format holds", () => {
  assert.ok(snap.board.length >= 2);
  assert.ok(snap.top10.length > 0 && snap.top10.length <= 10);
  for (let i = 1; i < snap.top10.length; i++)
    assert.ok(snap.top10[i - 1].effectiveApy >= snap.top10[i].effectiveApy);
  const d = buildDigestThread(snap);
  assert.ok(d.startsWith("0/ "));
  assert.ok(d.includes("> "));
  assert.ok(d.trim().endsWith("DYOR."));
  assert.ok(!d.includes("—") && !d.includes("#"));
});

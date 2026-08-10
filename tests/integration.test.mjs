import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSnapshotFromData } from "../lib/engine.ts";

function opp(asset, protocol, protocolLabel, chain, apy, nativeYield, borrowApy, ltv, tvl, exposure) {
  return {
    id: `${protocol}-${asset}-${chain}`, source: "aave", protocol, protocolLabel, chain,
    asset, exposure, apy, nativeYield, totalApy: apy + nativeYield, apyBase: apy, apyReward: 0,
    apyMean30d: apy, tvlUsd: tvl, url: null, borrowApy, ltv, liquidationThreshold: null,
    exitTerms: "instant", access: "open", updatedAt: new Date().toISOString(), flags: [],
  };
}

const opps = [
  opp("USDC","aave-v3","Aave v3","Ethereum",3.4,0,3.0,0.90,900e6,"USD"),
  opp("USDC","morpho-blue","Morpho","Base",5.5,0,2.5,0.90,120e6,"USD"),
  opp("USDT","fluid","Fluid","Ethereum",5.1,0,3.1,0.90,80e6,"USD"),
  opp("USDS","sky","Sky","Ethereum",7.1,0,null,null,4748e6,"USD"),
  opp("WSTETH","aave-v3","Aave v3","Ethereum",0.06,2.2,2.0,0.93,2000e6,"ETH"),
  opp("WETH","aave-v3","Aave v3","Ethereum",1.9,0,1.6,0.82,1500e6,"ETH"),
  opp("WSTETH","lido","Lido","Ethereum",0,2.9,null,null,20000e6,"ETH"),
];

test("INTEGRATION: real-shaped data flows through to routes", () => {
  const snap = buildSnapshotFromData(opps, {}, []);
  assert.ok(Array.isArray(snap.routes), "snapshot has routes array");
  assert.ok(snap.routes.length >= 1, "at least one route produced");
});

test("INTEGRATION: USD route beats passive and shows", () => {
  const snap = buildSnapshotFromData(opps, {}, []);
  const usd = snap.routes.find((r) => r.group === "USD");
  assert.ok(usd, "USD route exists");
  assert.equal(usd.show, "route");
  assert.ok(usd.netApy > usd.bestPassiveApy, "route net beats passive");
});

test("INTEGRATION: savings venue (Sky) never used as a loop step", () => {
  const snap = buildSnapshotFromData(opps, {}, []);
  const usd = snap.routes.find((r) => r.group === "USD");
  assert.ok(usd.steps.every((s) => s.supplyVenue !== "Sky" && s.borrowVenue !== "Sky"),
    "Sky is savings — not loopable");
});

test("INTEGRATION: ETH shows passive when loop loses to Lido staking", () => {
  const snap = buildSnapshotFromData(opps, {}, []);
  const eth = snap.routes.find((r) => r.group === "ETH");
  assert.ok(eth, "ETH route exists");
  assert.equal(eth.show, "passive", "loop < Lido passive -> show passive");
  assert.ok(eth.bestPassiveApy >= 2.9);
});

import { effectiveLtv } from "../lib/config/groups.ts";

test("EMODE: correlated pairs use real e-mode LTV, not standard", () => {
  assert.equal(effectiveLtv("aave-v3","WSTETH",0.80), 0.935);
  assert.equal(effectiveLtv("morpho-blue","USDC",0.86), 0.915);
});

test("EMODE: unknown asset/protocol falls back to live standard LTV", () => {
  assert.equal(effectiveLtv("aave-v3","RANDOMTOKEN",0.77), 0.77);
  assert.equal(effectiveLtv("some-new-dex","USDC",0.70), 0.70);
});

test("EMODE: e-mode LTV lifts achievable leverage on correlated pairs", () => {
  const snap = buildSnapshotFromData([
    opp("WSTETH","aave-v3","Aave v3","Ethereum",0.06,3.0,2.0,0.80,2000e6,"ETH"),
    opp("WETH","aave-v3","Aave v3","Ethereum",1.9,0,1.6,0.80,1500e6,"ETH"),
  ], {}, []);
  const eth = snap.routes.find((r) => r.group === "ETH");
  // With e-mode 0.935 (not standard 0.80), step 1 borrows 0.935-0.10=0.835 of collateral
  assert.ok(eth && eth.steps.length > 0);
  assert.equal(eth.steps[0].safeLtvUsed, 0.84); // 0.935 - 0.10 rounded
});

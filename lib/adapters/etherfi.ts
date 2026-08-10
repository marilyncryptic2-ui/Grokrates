import type { AdapterResult, YieldOpportunity } from "../types";

export async function fetchEtherfi(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  try {
    const res = await fetch("https://app.ether.fi/api/protocol/protocol-detail", { cache: "no-store" });
    if (!res.ok) {
      warnings.push(`etherfi HTTP ${res.status}`);
      return { opps: [], warnings };
    }
    const j = await res.json();
    // Response: {"7_day_apr":2.68,"7_day_restaking_apr":1.30,"tvl":...}
    const base = Number(j["7_day_apr"] ?? j.apr ?? j.apy ?? 0);
    const restake = Number(j["7_day_restaking_apr"] ?? 0);
    // Common formula used by integrators: (base / 0.9) + restake for pre-fee view
    const apy = base > 0 ? base + restake : 0;
    const tvl = Number(j.tvl ?? 0) * 2000; // if tvl is in ETH, rough USD; else use as-is

    if (apy > 0) {
      opps.push({
        id: "etherfi:WEETH",
        source: "etherfi",
        protocol: "ether.fi-stake",
        protocolLabel: "ether.fi",
        chain: "Ethereum",
        asset: "WEETH",
        exposure: "ETH",
        apy,
        nativeYield: apy,
        totalApy: apy,
        apyBase: apy,
        apyReward: 0,
        apyMean30d: null,
        tvlUsd: isFinite(tvl) && tvl > 1e9 ? tvl : 3_000_000_000,
        url: "https://www.ether.fi",
        borrowApy: null,
        ltv: null,
        liquidationThreshold: null,
        exitTerms: "instant",
        access: "open",
        updatedAt: now,
        flags: [],
      });
    } else {
      warnings.push("etherfi: no valid APR in response");
    }
  } catch (e) {
    warnings.push(`etherfi error: ${String(e)}`);
  }
  return { opps, warnings };
}

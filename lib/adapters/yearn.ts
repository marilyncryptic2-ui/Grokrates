import type { AdapterResult, YieldOpportunity } from "../types";
import { exposureOf, ACCESS_GATE, EXIT_TERMS, TVL_FLOOR_USD, MIN_APY } from "../config/curation";

const URL = "https://ydaemon.yearn.fi/1/vaults/all";

export async function fetchYearn(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  try {
    const res = await fetch(URL, { cache: "no-store" });
    if (!res.ok) {
      warnings.push(`yearn HTTP ${res.status}`);
      return { opps: [], warnings };
    }
    const vaults = await res.json();
    const list = Array.isArray(vaults) ? vaults : [];

    for (const v of list) {
      if (v.endorsed === false) continue;
      const sym = (v.token?.symbol || v.display_name || v.symbol || "").toUpperCase();
      if (!sym) continue;
      const asset = sym.replace(/^YV/, "").replace(/^Y/, "");
      const exposure = exposureOf(asset);
      if (!exposure) continue;

      const apy = (v.apy?.net_apy ?? v.apy?.net ?? v.apr?.netAPR ?? 0) * 100;
      const tvl = v.tvl?.tvl ?? v.tvl?.total_assets ?? 0;

      if (!isFinite(apy) || apy < MIN_APY) continue;
      if (!isFinite(tvl) || tvl < TVL_FLOOR_USD) continue;

      opps.push({
        id: `yearn:${v.address}`,
        source: "yearn",
        protocol: "yearn-finance",
        protocolLabel: "Yearn",
        chain: "Ethereum",
        asset,
        exposure,
        apy,
        nativeYield: 0,
        totalApy: apy,
        apyBase: apy,
        apyReward: 0,
        apyMean30d: v.apy?.points?.month_ago ? v.apy.points.month_ago * 100 : null,
        tvlUsd: tvl,
        url: `https://yearn.fi/vaults/1/${v.address}`,
        borrowApy: null,
        ltv: null,
        liquidationThreshold: null,
        exitTerms: EXIT_TERMS[asset] ?? "instant",
        access: ACCESS_GATE[asset] ?? "open",
        updatedAt: now,
        flags: apy > 25 ? ["apy-implausible"] : [],
      });
    }
  } catch (e) {
    warnings.push(`yearn error: ${String(e)}`);
  }
  return { opps, warnings };
}

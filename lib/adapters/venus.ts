import type { AdapterResult, YieldOpportunity } from "../types";
import { exposureOf, ACCESS_GATE, EXIT_TERMS, TVL_FLOOR_USD, MIN_APY } from "../config/curation";

const URL = "https://api.venus.io/markets?chainId=56";

export async function fetchVenus(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  try {
    const res = await fetch(URL, {
      headers: { "accept-version": "stable" },
      cache: "no-store",
    });
    if (!res.ok) {
      warnings.push(`venus HTTP ${res.status}`);
      return { opps: [], warnings };
    }
    const json = await res.json();
    const markets = json?.result ?? json?.data ?? json?.markets ?? [];

    for (const m of markets) {
      const sym = (m.underlyingSymbol || m.symbol || "").toUpperCase().replace(/^V/, "");
      if (!sym) continue;
      const asset = sym === "WBNB" ? "BNB" : sym === "BTCB" ? "WBTC" : sym;
      // Map to our groups; BNB not in correlation groups so skip unknown
      const exposure = exposureOf(asset) ?? (["USDT", "USDC", "DAI"].includes(asset) ? "USD" : null);
      if (!exposure) continue;

      const supplyApy = parseFloat(m.supplyApy ?? m.supplyAPY ?? "0");
      const borrowApy = parseFloat(m.borrowApy ?? m.borrowAPY ?? "0");
      const tvl = parseFloat(m.totalSupplyUsd ?? m.liquidityCents ? Number(m.liquidityCents) / 100 : "0") || 0;

      if (!isFinite(supplyApy) || supplyApy < MIN_APY) continue;
      if (tvl > 0 && tvl < TVL_FLOOR_USD) continue;

      const cf = m.collateralFactorMantissa ? Number(m.collateralFactorMantissa) / 1e18 : null;

      opps.push({
        id: `venus:${m.address || asset}`,
        source: "venus",
        protocol: "venus-core-pool",
        protocolLabel: "Venus",
        chain: "BSC",
        asset,
        exposure,
        apy: supplyApy,
        nativeYield: 0,
        totalApy: supplyApy,
        apyBase: supplyApy,
        apyReward: parseFloat(m.supplyXvsApy ?? "0") || 0,
        apyMean30d: null,
        tvlUsd: tvl || 50_000_000,
        url: "https://venus.io",
        borrowApy: isFinite(borrowApy) && borrowApy >= 0.01 ? borrowApy : null,
        ltv: cf,
        liquidationThreshold: cf,
        exitTerms: EXIT_TERMS[asset] ?? "instant",
        access: ACCESS_GATE[asset] ?? "open",
        updatedAt: now,
        flags: supplyApy > 25 ? ["apy-implausible"] : [],
      });
    }
  } catch (e) {
    warnings.push(`venus error: ${String(e)}`);
  }
  return { opps, warnings };
}

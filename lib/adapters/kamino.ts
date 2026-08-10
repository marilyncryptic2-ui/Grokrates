import type { AdapterResult, YieldOpportunity } from "../types";
import { exposureOf, ACCESS_GATE, EXIT_TERMS, TVL_FLOOR_USD, MIN_APY } from "../config/curation";

const BASE = "https://api.kamino.finance";

export async function fetchKamino(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  try {
    const marketsRes = await fetch(`${BASE}/v2/kamino-market`, { cache: "no-store" });
    if (!marketsRes.ok) {
      warnings.push(`kamino markets HTTP ${marketsRes.status}`);
      return { opps: [], warnings };
    }
    const markets = await marketsRes.json();
    const list = Array.isArray(markets) ? markets : markets?.data ?? [];

    for (const market of list.slice(0, 20)) {
      const marketId = market.lendingMarket || market.address || market.pubkey;
      if (!marketId) continue;
      try {
        const res = await fetch(`${BASE}/kamino-market/${marketId}/reserves/metrics`, { cache: "no-store" });
        if (!res.ok) continue;
        const reserves = await res.json();
        const items = Array.isArray(reserves) ? reserves : reserves?.data ?? reserves?.reserves ?? [];
        for (const r of items) {
          const sym = (r.liquidityToken || r.symbol || r.tokenSymbol || "").toUpperCase();
          if (!sym) continue;
          const asset = sym === "WSOL" ? "SOL" : sym;
          const exposure = exposureOf(asset);
          if (!exposure) continue;

          const supplyApy = (r.supplyApy ?? r.supplyAPY ?? 0) * (r.supplyApy > 1 ? 1 : 100);
          const borrowApy = (r.borrowApy ?? r.borrowAPY ?? 0) * (r.borrowApy > 1 ? 1 : 100);
          const tvl = r.totalSupplyUsd ?? r.depositTvl ?? r.tvl ?? 0;

          if (!isFinite(supplyApy) || supplyApy < MIN_APY) continue;
          if (!isFinite(tvl) || tvl < TVL_FLOOR_USD) continue;

          opps.push({
            id: `kamino:${marketId}:${asset}`,
            source: "kamino",
            protocol: "kamino-lend",
            protocolLabel: "Kamino",
            chain: "Solana",
            asset,
            exposure,
            apy: supplyApy,
            nativeYield: 0,
            totalApy: supplyApy,
            apyBase: supplyApy,
            apyReward: 0,
            apyMean30d: null,
            tvlUsd: tvl,
            url: "https://app.kamino.finance",
            borrowApy: isFinite(borrowApy) && borrowApy >= 0.01 ? borrowApy : null,
            ltv: r.ltv ?? r.liquidationLtv ?? null,
            liquidationThreshold: r.liquidationThreshold ?? null,
            exitTerms: EXIT_TERMS[asset] ?? "instant",
            access: ACCESS_GATE[asset] ?? "open",
            updatedAt: now,
            flags: supplyApy > 25 ? ["apy-implausible"] : [],
          });
        }
      } catch {
        // skip individual market
      }
    }
    if (opps.length === 0) warnings.push("kamino returned no reserves");
  } catch (e) {
    warnings.push(`kamino error: ${String(e)}`);
  }
  return { opps, warnings };
}

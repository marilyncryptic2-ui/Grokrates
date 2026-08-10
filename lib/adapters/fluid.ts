import type { AdapterResult, YieldOpportunity } from "../types";
import { exposureOf, ACCESS_GATE, EXIT_TERMS, TVL_FLOOR_USD, MIN_APY } from "../config/curation";

const BASE = "https://api.fluid.instadapp.io";

// Fluid lending tokens endpoint (chainId 1 = Ethereum). Extend as needed.
const CHAINS = [1, 42161, 8453];

function normalize(sym: string): string {
  const s = sym.toUpperCase().replace(/^F/, ""); // fUSDC → USDC
  if (s === "WETH") return "WETH";
  if (s === "USDC") return "USDC";
  if (s === "USDT") return "USDT";
  if (s === "DAI") return "DAI";
  if (s === "USDS") return "USDS";
  return s;
}

export async function fetchFluid(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  for (const chainId of CHAINS) {
    try {
      const res = await fetch(`${BASE}/v2/lending/${chainId}/tokens`, { cache: "no-store" });
      if (!res.ok) {
        warnings.push(`fluid chain ${chainId} HTTP ${res.status}`);
        continue;
      }
      const data = await res.json();
      const tokens = Array.isArray(data) ? data : data?.data ?? data?.tokens ?? [];

      for (const t of tokens) {
        const rawSym = t.symbol || t.asset?.symbol || t.name;
        if (!rawSym) continue;
        const asset = normalize(String(rawSym));
        const exposure = exposureOf(asset);
        if (!exposure) continue;

        // Fluid returns rates in various shapes. Prefer totalRate then supplyRate.
        const supplyRate = parseFloat(
          t.totalRate ?? t.supplyRate ?? t.supply_rate ?? t.apy ?? "0"
        );
        // Some endpoints use basis points
        const supplyApy = supplyRate > 100 ? supplyRate / 100 : supplyRate;
        if (!isFinite(supplyApy) || supplyApy < MIN_APY) continue;

        const tvl = parseFloat(t.totalSupplyUsd ?? t.tvlUsd ?? t.totalSupply ?? t.liquidity ?? "0");
        if (!isFinite(tvl) || tvl < TVL_FLOOR_USD) continue;

        const borrowRate = parseFloat(t.borrowRate ?? t.borrow_rate ?? "0");
        const borrowApy = borrowRate > 100 ? borrowRate / 100 : borrowRate;
        const validBorrow = isFinite(borrowApy) && borrowApy >= 0.01 ? borrowApy : null;

        const chainName = chainId === 1 ? "Ethereum" : chainId === 42161 ? "Arbitrum" : chainId === 8453 ? "Base" : String(chainId);

        opps.push({
          id: `fluid:${chainId}:${asset}`,
          source: "fluid",
          protocol: "fluid-lending",
          protocolLabel: "Fluid",
          chain: chainName,
          asset,
          exposure,
          apy: supplyApy,
          nativeYield: 0,
          totalApy: supplyApy,
          apyBase: supplyApy,
          apyReward: 0,
          apyMean30d: null,
          tvlUsd: tvl,
          url: "https://fluid.io",
          borrowApy: validBorrow,
          ltv: null, // Fluid vault LTV comes from vault endpoints; leave null for now
          liquidationThreshold: null,
          exitTerms: EXIT_TERMS[asset] ?? "instant",
          access: ACCESS_GATE[asset] ?? "open",
          updatedAt: now,
          flags: supplyApy > 25 ? ["apy-implausible"] : [],
        });
      }
    } catch (e) {
      warnings.push(`fluid chain ${chainId}: ${String(e)}`);
    }
  }

  if (opps.length === 0) warnings.push("fluid returned no pools");
  return { opps, warnings };
}

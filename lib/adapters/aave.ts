import type { AdapterResult, YieldOpportunity } from "../types";
import { exposureOf, ACCESS_GATE, EXIT_TERMS, TVL_FLOOR_USD, MIN_APY } from "../config/curation";

const AAVE_GQL = "https://api.v3.aave.com/graphql";

// Major chains we care about. Aave GraphQL accepts chainIds list.
const CHAIN_IDS = [1, 8453, 42161, 10, 137, 43114, 56, 59144, 534352, 100, 146, 143, 9745, 5000];

const QUERY = `
query Markets($chainIds: [Int!]!) {
  markets(request: { chainIds: $chainIds }) {
    name
    address
    chain { name chainId }
    reserves {
      underlyingToken { symbol decimals }
      size { usd amount { value } }
      supplyInfo {
        apy { formatted value }
        maxLTV { formatted value }
        liquidationThreshold { formatted value }
        canBeCollateral
      }
      borrowInfo {
        apy { formatted value }
      }
      isFrozen
      isPaused
    }
  }
}`;

function normalizeAsset(symbol: string): string {
  const s = symbol.toUpperCase().trim();
  // Common Aave aliases
  if (s === "WETH") return "WETH";
  if (s === "ETH") return "ETH";
  if (s === "WSTETH") return "WSTETH";
  if (s === "WEETH") return "WEETH";
  if (s === "RETH") return "RETH";
  if (s === "CBETH") return "CBETH";
  if (s === "WBTC") return "WBTC";
  if (s === "CBBTC") return "CBBTC";
  if (s === "TBTC") return "TBTC";
  if (s === "LBTC") return "LBTC";
  if (s === "USDC" || s === "USDC.E") return "USDC";
  if (s === "USDT" || s === "USDT.E") return "USDT";
  if (s === "DAI") return "DAI";
  if (s === "USDS") return "USDS";
  if (s === "GHO") return "GHO";
  if (s === "PYUSD") return "PYUSD";
  if (s === "RLUSD") return "RLUSD";
  if (s === "USDE") return "USDE";
  if (s === "SUSDE") return "SUSDE";
  return s;
}

export async function fetchAave(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  try {
    const res = await fetch(AAVE_GQL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { chainIds: CHAIN_IDS } }),
      cache: "no-store",
    });

    if (!res.ok) {
      warnings.push(`aave HTTP ${res.status}`);
      return { opps: [], warnings };
    }

    const json = await res.json();
    if (json.errors?.length) {
      warnings.push(`aave GQL: ${json.errors[0]?.message ?? "unknown"}`);
      return { opps: [], warnings };
    }

    const markets = json.data?.markets ?? [];
    for (const m of markets) {
      const chainName = m.chain?.name ?? "Unknown";
      for (const r of m.reserves ?? []) {
        if (r.isFrozen || r.isPaused) continue;

        const rawSym = r.underlyingToken?.symbol;
        if (!rawSym) continue;
        const asset = normalizeAsset(rawSym);
        const exposure = exposureOf(asset);
        if (!exposure) continue;

        const supplyApy = parseFloat(r.supplyInfo?.apy?.formatted ?? "0");
        if (!isFinite(supplyApy) || supplyApy < MIN_APY) continue;

        const tvl = parseFloat(r.size?.usd ?? "0");
        if (!isFinite(tvl) || tvl < TVL_FLOOR_USD) continue;

        const borrowApyRaw = r.borrowInfo?.apy?.formatted;
        const borrowApy = borrowApyRaw != null ? parseFloat(borrowApyRaw) : null;
        const validBorrow = borrowApy != null && isFinite(borrowApy) && borrowApy >= 0.01 ? borrowApy : null;

        // Standard LTV (e-mode is applied later in engine via effectiveLtv)
        const ltvRaw = parseFloat(r.supplyInfo?.maxLTV?.value ?? r.supplyInfo?.maxLTV?.formatted ?? "0");
        // Aave returns LTV as 0.75 or as "75.00". Normalize to 0–1.
        let ltv: number | null = null;
        if (isFinite(ltvRaw)) {
          ltv = ltvRaw > 1 ? ltvRaw / 100 : ltvRaw;
          if (ltv <= 0 || ltv > 1) ltv = null;
        }

        const ltRaw = parseFloat(r.supplyInfo?.liquidationThreshold?.value ?? r.supplyInfo?.liquidationThreshold?.formatted ?? "0");
        let lt: number | null = null;
        if (isFinite(ltRaw)) {
          lt = ltRaw > 1 ? ltRaw / 100 : ltRaw;
          if (lt <= 0 || lt > 1) lt = null;
        }

        const flags: string[] = [];
        if (supplyApy > 25) flags.push("apy-implausible");

        opps.push({
          id: `aave:${m.address}:${asset}:${chainName}`,
          source: "aave",
          protocol: "aave-v3",
          protocolLabel: "Aave v3",
          chain: chainName,
          asset,
          exposure,
          apy: supplyApy,
          nativeYield: 0, // native yield attached later by pipeline if needed
          totalApy: supplyApy,
          apyBase: supplyApy,
          apyReward: 0,
          apyMean30d: null,
          tvlUsd: tvl,
          url: `https://app.aave.com/markets/?marketName=proto_${chainName.toLowerCase().replace(/\s+/g, "")}_v3`,
          borrowApy: validBorrow,
          ltv,
          liquidationThreshold: lt,
          exitTerms: EXIT_TERMS[asset] ?? "instant",
          access: ACCESS_GATE[asset] ?? "open",
          updatedAt: now,
          flags,
        });
      }
    }

    if (opps.length < 5) warnings.push(`aave returned only ${opps.length} pools`);
  } catch (e) {
    warnings.push(`aave error: ${String(e)}`);
  }

  return { opps, warnings };
}

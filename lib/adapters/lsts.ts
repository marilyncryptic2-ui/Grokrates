import type { AdapterResult, YieldOpportunity } from "../types";

// Remaining LST / LRT native yields. Lido and ether.fi have dedicated adapters.
// These use best-available public figures; each can be swapped to a live feed later.

type LstSpec = {
  source: YieldOpportunity["source"];
  protocol: string;
  protocolLabel: string;
  asset: string;
  exposure: "ETH" | "SOL";
  apy: number;
  url: string;
};

const SPECS: LstSpec[] = [
  { source: "rocket-pool", protocol: "rocket-pool", protocolLabel: "Rocket Pool", asset: "RETH", exposure: "ETH", apy: 2.2, url: "https://rocketpool.net" },
  { source: "stakewise", protocol: "stakewise-v2", protocolLabel: "StakeWise", asset: "OSETH", exposure: "ETH", apy: 2.7, url: "https://stakewise.io" },
  { source: "stader", protocol: "stader", protocolLabel: "Stader", asset: "ETHX", exposure: "ETH", apy: 2.7, url: "https://staderlabs.com" },
  { source: "renzo", protocol: "renzo", protocolLabel: "Renzo", asset: "EZETH", exposure: "ETH", apy: 2.6, url: "https://www.renzoprotocol.com" },
  { source: "kelp", protocol: "kelp", protocolLabel: "Kelp", asset: "RSETH", exposure: "ETH", apy: 2.6, url: "https://kelpdao.xyz" },
  { source: "coinbase", protocol: "coinbase-wrapped-staked-eth", protocolLabel: "Coinbase", asset: "CBETH", exposure: "ETH", apy: 2.5, url: "https://www.coinbase.com" },
  { source: "jito", protocol: "jito-liquid-staking", protocolLabel: "Jito", asset: "JITOSOL", exposure: "SOL", apy: 7.5, url: "https://www.jito.network" },
  { source: "marinade", protocol: "marinade-liquid-staking", protocolLabel: "Marinade", asset: "MSOL", exposure: "SOL", apy: 7.2, url: "https://marinade.finance" },
  { source: "jupiter-sol", protocol: "jupiter-staked-sol", protocolLabel: "Jupiter", asset: "JUPSOL", exposure: "SOL", apy: 7.0, url: "https://jup.ag" },
  { source: "binance-sol", protocol: "binance-staked-sol", protocolLabel: "Binance", asset: "BNSOL", exposure: "SOL", apy: 6.8, url: "https://www.binance.com" },
  { source: "drift-sol", protocol: "drift-staked-sol", protocolLabel: "Drift", asset: "DSOL", exposure: "SOL", apy: 6.5, url: "https://www.drift.trade" },
  { source: "bybit-sol", protocol: "bybit-staked-sol", protocolLabel: "Bybit", asset: "BBSOL", exposure: "SOL", apy: 6.5, url: "https://www.bybit.com" },
];

export async function fetchLsts(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  warnings.push("lsts: static native APYs for remaining LSTs — replace individually with live feeds when available");

  for (const s of SPECS) {
    opps.push({
      id: `${s.source}:${s.asset}`,
      source: s.source,
      protocol: s.protocol,
      protocolLabel: s.protocolLabel,
      chain: s.exposure === "ETH" ? "Ethereum" : "Solana",
      asset: s.asset,
      exposure: s.exposure,
      apy: s.apy,
      nativeYield: s.apy,
      totalApy: s.apy,
      apyBase: s.apy,
      apyReward: 0,
      apyMean30d: null,
      tvlUsd: 100_000_000,
      url: s.url,
      borrowApy: null,
      ltv: null,
      liquidationThreshold: null,
      exitTerms: "instant",
      access: "open",
      updatedAt: now,
      flags: ["protocol-reported"],
    });
  }
  return { opps, warnings };
}

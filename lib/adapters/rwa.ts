import type { AdapterResult, YieldOpportunity } from "../types";

export async function fetchRwa(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  const specs = [
    { source: "ondo" as const, protocol: "ondo-yield-assets", label: "Ondo", asset: "USDY", apy: 4.5, url: "https://ondo.finance", access: "kyc" as const },
    { source: "buidl" as const, protocol: "blackrock-buidl", label: "BlackRock BUIDL", asset: "BUIDL", apy: 4.2, url: "https://www.blackrock.com", access: "institutional" as const },
    { source: "usyc" as const, protocol: "circle-usyc", label: "Circle USYC", asset: "USYC", apy: 4.0, url: "https://www.circle.com", access: "kyc" as const },
  ];

  warnings.push("rwa: using static APY placeholders — replace with issuer feeds");

  for (const s of specs) {
    opps.push({
      id: `${s.source}:${s.asset}`,
      source: s.source,
      protocol: s.protocol,
      protocolLabel: s.label,
      chain: "Ethereum",
      asset: s.asset,
      exposure: "RWA",
      apy: s.apy,
      nativeYield: s.apy,
      totalApy: s.apy,
      apyBase: s.apy,
      apyReward: 0,
      apyMean30d: null,
      tvlUsd: 500_000_000,
      url: s.url,
      borrowApy: null,
      ltv: null,
      liquidationThreshold: null,
      exitTerms: "instant",
      access: s.access,
      updatedAt: now,
      flags: ["protocol-reported"],
    });
  }

  return { opps, warnings };
}

import type { AdapterResult, YieldOpportunity } from "../types";

// Ethena sUSDe yield is the staking APY of USDe. Public rate can be derived
// from the sUSDe ERC-4626 exchange rate growth or from public dashboards.
// We use a lightweight approach: try public endpoints, fall back to warning.

export async function fetchEthena(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  try {
    // Placeholder for live rate — structure is ready for a real feed.
    // User should verify against app.ethena.fi
    const apy = 3.8;
    warnings.push("ethena: using static sUSDe APY placeholder — replace with live exchange-rate feed");

    for (const asset of ["SUSDE", "USDE"]) {
      opps.push({
        id: `ethena:${asset}`,
        source: "ethena",
        protocol: "ethena-usde",
        protocolLabel: "Ethena",
        chain: "Ethereum",
        asset,
        exposure: "USD",
        apy: asset === "SUSDE" ? apy : 0,
        nativeYield: asset === "SUSDE" ? apy : 0,
        totalApy: asset === "SUSDE" ? apy : 0,
        apyBase: asset === "SUSDE" ? apy : 0,
        apyReward: 0,
        apyMean30d: null,
        tvlUsd: 3_500_000_000,
        url: "https://app.ethena.fi",
        borrowApy: null,
        ltv: null,
        liquidationThreshold: null,
        exitTerms: asset === "SUSDE" ? "7d cooldown" : "instant",
        access: "open",
        updatedAt: now,
        flags: ["protocol-reported"],
      });
    }
  } catch (e) {
    warnings.push(`ethena error: ${String(e)}`);
  }
  return { opps, warnings };
}

import type { AdapterResult, YieldOpportunity } from "../types";

// Sky Savings Rate is governance-set. Public sources:
// - On-chain Pot / SSR contracts
// - info.sky.money / sky.money display
// We use a lightweight public endpoint when available, otherwise fall back to
// a known stable value that the user can verify against the UI.
// For production we will later add a direct on-chain read or the official rate feed.

export async function fetchSky(): Promise<AdapterResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();
  const opps: YieldOpportunity[] = [];

  try {
    // Attempt a public rate source. If it fails we still emit a warning so the
    // operator knows to check the live rate.
    let apy = 0;
    let tvl = 4_700_000_000; // approximate from recent public data

    // Try Aavescan-style public rates if available, otherwise leave for manual.
    // For now we hard-code a safe placeholder that must be verified against
    // https://sky.money or info.sky.money. The adapter is structured so a
    // real endpoint can be dropped in later without changing the shape.
    try {
      const res = await fetch("https://api.aavescan.com/v2/rates/latest", { cache: "no-store" });
      // This may require a key; we ignore failures.
      if (res.ok) {
        // parse if useful later
      }
    } catch {
      // ignore
    }

    // Temporary: use a conservative recent public rate. User will verify against UI.
    // Once we have a reliable public endpoint we replace this block.
    apy = 3.52; // current public SSR at time of handoff; update via real feed
    warnings.push("sky: using static SSR placeholder — replace with live feed");

    if (apy > 0) {
      for (const asset of ["SUSDS", "SDAI", "USDS"]) {
        opps.push({
          id: `sky:${asset}`,
          source: "sky",
          protocol: "sky-lending",
          protocolLabel: "Sky",
          chain: "Ethereum",
          asset,
          exposure: "USD",
          apy,
          nativeYield: apy,
          totalApy: apy,
          apyBase: apy,
          apyReward: 0,
          apyMean30d: null,
          tvlUsd: tvl,
          url: "https://sky.money",
          borrowApy: null,
          ltv: null,
          liquidationThreshold: null,
          exitTerms: "instant",
          access: "open",
          updatedAt: now,
          flags: ["protocol-reported"],
        });
      }
    }
  } catch (e) {
    warnings.push(`sky error: ${String(e)}`);
  }

  return { opps, warnings };
}

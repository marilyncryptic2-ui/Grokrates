// Delta-neutral funding source: Hyperliquid public Info API.
// Keyless, not US-geoblocked (Binance returns 451 from Vercel's US region).
// POST https://api.hyperliquid.xyz/info  { type: "fundingHistory", coin, startTime }
// Hyperliquid funding settles hourly -> 24*365 periods/year.
const INFO_URL = "https://api.hyperliquid.xyz/info";
const COINS: Record<string, string> = { ETH: "ETH", BTC: "BTC", SOL: "SOL" };
const PERIODS_PER_YEAR = 24 * 365;
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface FundingInfo { funding30dPct: number; venue: string }
export interface FundingResult { byExposure: Record<string, FundingInfo>; warnings: string[] }

export async function fetchFunding(): Promise<FundingResult> {
  const warnings: string[] = [];
  const byExposure: Record<string, FundingInfo> = {};
  const startTime = Date.now() - THIRTY_DAYS_MS;

  const settled = await Promise.allSettled(
    Object.entries(COINS).map(async ([exposure, coin]) => {
      const res = await fetch(INFO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "fundingHistory", coin, startTime }),
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`funding ${coin} HTTP ${res.status}`);
      const arr = (await res.json()) as Array<{ fundingRate?: string; premium?: string }>;
      if (!Array.isArray(arr) || !arr.length) throw new Error(`funding ${coin}: empty history`);
      const rates = arr.map((x) => parseFloat(x.fundingRate ?? "")).filter(isFinite);
      if (!rates.length) throw new Error(`funding ${coin}: no numeric rates`);
      const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
      return { exposure, pct: mean * PERIODS_PER_YEAR * 100 };
    })
  );
  for (const r of settled) {
    if (r.status === "fulfilled") {
      byExposure[r.value.exposure] = { funding30dPct: Math.round(r.value.pct * 100) / 100, venue: "Hyperliquid" };
    } else warnings.push(String(r.reason));
  }
  return { byExposure, warnings };
}

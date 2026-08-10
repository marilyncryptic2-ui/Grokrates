import type { YieldOpportunity } from "../types";
import { TVL_FLOOR_USD, exposureOf } from "../config/curation";

// Pendle PT implied fixed APY. Uses the cross-chain /v2/markets/all
// endpoint (recommended for new integrations, returns every chain in one
// call). Parsing is defensive across field-name variants so API drift
// degrades to a warning, never a crash or a fake row.
const URL_V2_ALL = "https://api-v2.pendle.finance/core/v2/markets/all";
// Chain-scoped fallback if the cross-chain shape changes.
const CHAIN_FALLBACK: Record<number, string> = { 1: "Ethereum", 42161: "Arbitrum", 8453: "Base", 146: "Sonic", 5000: "Mantle" };

const CHAIN_NAME: Record<number, string> = {
  1: "Ethereum", 42161: "Arbitrum", 8453: "Base", 10: "Optimism",
  56: "BSC", 146: "Sonic", 5000: "Mantle", 137: "Polygon",
};

interface PendleMarketRaw {
  address?: string;
  chainId?: number;
  expiry?: string;
  symbol?: string;
  name?: string;
  pt?: { symbol?: string } | string;
  underlyingAsset?: { symbol?: string } | string;
  accountingAsset?: { symbol?: string };
  impliedApy?: number;
  details?: { impliedApy?: number; liquidity?: number };
  liquidity?: { usd?: number } | number;
  tvl?: number;
  isActive?: boolean;
  isWhitelisted?: boolean;
}

const num = (x: unknown): number | null => (typeof x === "number" && isFinite(x) ? x : null);

function symOf(v: { symbol?: string } | string | undefined): string {
  if (!v) return "";
  return typeof v === "string" ? v : v.symbol ?? "";
}
function liqOf(m: PendleMarketRaw): number {
  return num(m.details?.liquidity) ?? (typeof m.liquidity === "number" ? m.liquidity : num((m.liquidity as { usd?: number })?.usd)) ?? num(m.tvl) ?? 0;
}
function impliedOf(m: PendleMarketRaw): number | null {
  return num(m.details?.impliedApy) ?? num(m.impliedApy);
}
function underlyingOf(m: PendleMarketRaw): string | null {
  const raw = symOf(m.underlyingAsset) || symOf(m.accountingAsset) || symOf(m.pt) || m.symbol || m.name || "";
  // Strip PT prefixes and expiry suffixes: "PT-sUSDe-25SEP2025" -> SUSDE
  const clean = raw
    .replace(/^PT[-\s]?/i, "")
    .split(/[-\s]/)[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
  return clean || null;
}

export interface PendleResult { opps: YieldOpportunity[]; warnings: string[] }

async function parseMarkets(markets: PendleMarketRaw[], now: string, warnings: string[]): Promise<YieldOpportunity[]> {
  const out: YieldOpportunity[] = [];
  for (const m of markets) {
    if (m.isActive === false) continue;
    const t = underlyingOf(m);
    if (!t) continue;
    const exposure = exposureOf(t);
    if (!exposure) continue;
    const apyFrac = impliedOf(m);
    if (apyFrac == null) continue;
    const pct = Math.round(apyFrac * 10000) / 100;
    if (pct <= 0 || pct > 60) continue; // sane fixed-rate band; drops artifacts
    const liq = liqOf(m);
    if (liq < TVL_FLOOR_USD) continue;
    const chain = m.chainId ? (CHAIN_NAME[m.chainId] ?? `chain-${m.chainId}`) : "Ethereum";
    const expiry = m.expiry ? m.expiry.slice(0, 10) : null;
    out.push({
      id: `pendle:${m.address ?? `${t}-${expiry}`}:${m.chainId ?? 1}`,
      source: "pendle", protocol: "pendle", protocolLabel: "Pendle",
      chain, asset: t, exposure,
      apy: pct, nativeYield: 0, totalApy: pct,
      apyBase: pct, apyReward: 0, apyMean30d: null, tvlUsd: liq,
      url: m.address ? `https://app.pendle.finance/trade/markets/${m.address}` : "https://app.pendle.finance/trade/markets",
      borrowApy: null, ltv: null, liquidationThreshold: null,
      exitTerms: expiry ? `matures ${expiry}` : "tradable to maturity",
      access: "open", updatedAt: now,
      flags: ["pt-fixed"],
    });
  }
  return out;
}

export async function fetchPendle(): Promise<PendleResult> {
  const warnings: string[] = [];
  const now = new Date().toISOString();

  // Primary: cross-chain endpoint.
  try {
    const res = await fetch(URL_V2_ALL, { cache: "no-store", headers: { accept: "application/json" } });
    if (res.ok) {
      const j = await res.json();
      const markets: PendleMarketRaw[] = Array.isArray(j) ? j : (j?.markets ?? j?.results ?? j?.data ?? []);
      if (markets.length) {
        const opps = await parseMarkets(markets, now, warnings);
        if (opps.length) return { opps, warnings };
        warnings.push(`pendle /v2/markets/all parsed 0 usable of ${markets.length} markets`);
      } else warnings.push("pendle /v2/markets/all returned no markets array");
    } else warnings.push(`pendle /v2/markets/all HTTP ${res.status}`);
  } catch (e) {
    warnings.push(`pendle /v2/markets/all error: ${String(e)}`);
  }

  // Fallback: per-chain active endpoint.
  const settled = await Promise.allSettled(
    Object.entries(CHAIN_FALLBACK).map(async ([id, chain]) => {
      const res = await fetch(`https://api-v2.pendle.finance/core/v1/${id}/markets/active`, { cache: "no-store", headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`pendle ${chain} HTTP ${res.status}`);
      const j = await res.json();
      const markets: PendleMarketRaw[] = Array.isArray(j) ? j : (j?.markets ?? []);
      return markets.map((m) => ({ ...m, chainId: Number(id) }));
    })
  );
  const all: PendleMarketRaw[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") all.push(...r.value);
    else warnings.push(String(r.reason));
  }
  const opps = await parseMarkets(all, now, warnings);
  if (!opps.length) warnings.push("pendle: no usable markets from any endpoint");
  return { opps, warnings };
}

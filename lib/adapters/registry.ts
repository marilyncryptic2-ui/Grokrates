import type { RegistryProtocol, YieldOpportunity } from "../types";
import { TVL_FLOOR_USD, exposureOf } from "../config/curation";
import { loadRegistry } from "../store";

// Admin-added protocols. Two types work without code:
//  - llama-slug: adds a slug beyond the built-in allowlist (handled in
//    pipeline by extending the allowlist at runtime)
//  - generic-rest: endpoint + JSON dot-path mapping to fields
// Everything from here is flagged protocol-reported and inactive until
// previewed and switched live in /admin.

function dig(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

export interface RegistryResult { opps: YieldOpportunity[]; extraSlugs: Record<string, string>; warnings: string[] }

export async function fetchRegistry(includeInactive = false): Promise<RegistryResult> {
  const warnings: string[] = [];
  const opps: YieldOpportunity[] = [];
  const extraSlugs: Record<string, string> = {};
  const registry = await loadRegistry();
  const now = new Date().toISOString();

  for (const proto of registry) {
    if (!proto.active && !includeInactive) continue;
    if (proto.type === "llama-slug" && proto.llamaSlug) {
      extraSlugs[proto.llamaSlug] = proto.name;
      continue;
    }
    if (proto.type !== "generic-rest" || !proto.apiUrl || !proto.map) continue;
    try {
      const res = await fetch(proto.apiUrl, {
        headers: proto.apiKey ? { Authorization: `Bearer ${proto.apiKey}` } : {},
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const list = dig(json, proto.map.list);
      if (!Array.isArray(list)) throw new Error(`map.list path "${proto.map.list}" is not an array`);
      for (const item of list) {
        const symbol = String(dig(item, proto.map.symbol) ?? "").toUpperCase();
        const apy = Number(dig(item, proto.map.apyPct));
        const tvl = Number(dig(item, proto.map.tvlUsd));
        const chain = proto.map.chain ? String(dig(item, proto.map.chain) ?? "Unknown") : "Unknown";
        const exposure = exposureOf(symbol);
        if (!exposure || !isFinite(apy) || !isFinite(tvl) || tvl < TVL_FLOOR_USD) continue;
        opps.push({
          id: `registry:${proto.id}:${symbol}:${chain}`,
          source: "registry", protocol: proto.id, protocolLabel: proto.name,
          chain, asset: symbol, exposure,
          apy, nativeYield: 0, totalApy: apy,
          apyBase: apy, apyReward: 0, apyMean30d: null, tvlUsd: tvl,
          url: proto.website || null,
          borrowApy: null, ltv: null, liquidationThreshold: null,
          exitTerms: "instant", access: "open", updatedAt: now,
          flags: ["protocol-reported"],
        });
      }
    } catch (e) {
      warnings.push(`registry adapter ${proto.name}: ${String(e)}`);
    }
  }
  return { opps, extraSlugs, warnings };
}

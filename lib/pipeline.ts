import type { Snapshot, YieldOpportunity } from "./types";
import { fetchAave } from "./adapters/aave";
import { fetchMorpho } from "./adapters/morpho";
import { fetchFluid } from "./adapters/fluid";
import { fetchLido } from "./adapters/lido";
import { fetchSky } from "./adapters/sky";
import { fetchEthena } from "./adapters/ethena";
import { fetchEtherfi } from "./adapters/etherfi";
import { fetchLsts } from "./adapters/lsts";
import { fetchRwa } from "./adapters/rwa";
import { fetchKamino } from "./adapters/kamino";
import { fetchVenus } from "./adapters/venus";
import { fetchYearn } from "./adapters/yearn";
import { fetchCompound } from "./adapters/compound";
import { fetchSpark } from "./adapters/spark";
import { fetchEuler } from "./adapters/euler";
import { fetchSilo } from "./adapters/silo";
import { fetchDolomite } from "./adapters/dolomite";
import { fetchGearbox } from "./adapters/gearbox";
import { fetchPendle } from "./adapters/pendle";
import { fetchFunding } from "./adapters/funding";
import { fetchRegistry } from "./adapters/registry";
import { buildSnapshotFromData } from "./engine";
import { loadSnapshot, saveSnapshot, snapshotAgeHours } from "./store";
import { sendTelegram } from "./alerts/telegram";

// Direct protocol adapters only. DefiLlama removed.

export async function refreshSnapshot(): Promise<Snapshot> {
  const warnings: string[] = [];

  const registry = await fetchRegistry().catch((e) => {
    warnings.push(`registry: ${String(e)}`);
    return { opps: [] as YieldOpportunity[], extraSlugs: {}, warnings: [] as string[] };
  });
  warnings.push(...(registry.warnings ?? []));

  const results = await Promise.allSettled([
    fetchAave(),
    fetchMorpho(),
    fetchFluid(),
    fetchLido(),
    fetchSky(),
    fetchEthena(),
    fetchEtherfi(),
    fetchLsts(),
    fetchRwa(),
    fetchKamino(),
    fetchVenus(),
    fetchYearn(),
    fetchCompound(),
    fetchSpark(),
    fetchEuler(),
    fetchSilo(),
    fetchDolomite(),
    fetchGearbox(),
    fetchPendle(),
    fetchFunding(),
  ]);

  const names = [
    "aave", "morpho", "fluid", "lido", "sky", "ethena", "etherfi", "lsts", "rwa",
    "kamino", "venus", "yearn",
    "compound", "spark", "euler", "silo", "dolomite", "gearbox",
    "pendle", "funding",
  ];

  const opps: YieldOpportunity[] = [...(registry.opps ?? [])];
  let funding: Record<string, any> = {};

    results.forEach((r, i) => {
    const name = names[i];
    if (r.status === "fulfilled") {
      if (name === "funding") {
        const fr = r.value as { byExposure?: Record<string, any>; warnings?: string[] };
        funding = fr.byExposure ?? {};
        warnings.push(...(fr.warnings ?? []));
      } else {
        const ar = r.value as { opps?: YieldOpportunity[]; warnings?: string[] };
        opps.push(...(ar.opps ?? []));
        warnings.push(...(ar.warnings ?? []));
      }
    } else {
      warnings.push(`${name} FAILED: ${String(r.reason)}`);
    }
  });

  // Attach native yields onto venue pools of the same asset
  const nativeMap = new Map<string, number>();
  const nativeSources = new Set([
    "lido", "sky", "ethena", "etherfi", "rocket-pool", "stakewise", "stader",
    "renzo", "kelp", "coinbase", "jito", "marinade", "jupiter-sol",
    "binance-sol", "drift-sol", "bybit-sol", "ondo", "buidl", "usyc",
  ]);
  for (const o of opps) {
    if (o.nativeYield > 0 && nativeSources.has(o.source)) {
      nativeMap.set(o.asset, Math.max(nativeMap.get(o.asset) ?? 0, o.nativeYield));
    }
  }
  for (const o of opps) {
    if (o.nativeYield === 0 && nativeMap.has(o.asset)) {
      const n = nativeMap.get(o.asset)!;
      o.nativeYield = n;
      o.totalApy = o.apy + n;
    }
  }

  const snapshot = buildSnapshotFromData(opps, funding, warnings);
  await saveSnapshot(snapshot).catch((e) => warnings.push(`store: ${String(e)}`));
  if (warnings.length) {
    await sendTelegram(
      `YieldBoard warnings (${warnings.length}):\n${warnings.slice(0, 12).join("\n")}`
    ).catch(() => {});
  }
  return snapshot;
}

let inflight: Promise<Snapshot> | null = null;

export async function getSnapshot(): Promise<Snapshot & { stale: boolean }> {
  const cached = await loadSnapshot();
  if (cached && snapshotAgeHours(cached) < 2.5) {
    return { ...cached, stale: false };
  }
  if (cached && !inflight) {
    inflight = refreshSnapshot().finally(() => { inflight = null; });
    return { ...cached, stale: true };
  }
  if (inflight) return { ...(await inflight), stale: false };
  inflight = refreshSnapshot().finally(() => { inflight = null; });
  return { ...(await inflight), stale: false };
}

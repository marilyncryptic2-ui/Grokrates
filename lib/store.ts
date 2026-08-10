import { Redis } from "@upstash/redis";
import type { RegistryProtocol, Snapshot } from "./types";

// Storage: Upstash when configured (persistent snapshots, history
// archive, admin registry), in-memory fallback otherwise. The site is
// fully functional without Redis — it just computes on demand and the
// history archive starts counting only once Redis is added.

const SNAP_KEY = "yb:snapshot:v2";
const HIST_KEY = "yb:history:v2";       // list of {t, entries} (trimmed)
const REG_KEY = "yb:registry:v1";

function redis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}

let memSnapshot: Snapshot | null = null;
let memRegistry: RegistryProtocol[] = [];

export async function saveSnapshot(s: Snapshot): Promise<void> {
  memSnapshot = s;
  const r = redis();
  if (!r) return;
  await r.set(SNAP_KEY, JSON.stringify(s));
  // History archive: one compact point per refresh — asset best rates +
  // best strategy rates. Powers "what changed" and durability later.
  const point = {
    t: s.updatedAt,
    a: s.groups.map((g) => ({
      n: g.asset,
      base: g.apyRange[1],
      strat: Math.max(0, ...g.venues.flatMap((v) => v.strategies.map((x) => x.netApy))),
    })),
  };
  await r.rpush(HIST_KEY, JSON.stringify(point));
  await r.ltrim(HIST_KEY, -2160, -1); // ~180 days at 12 points/day
}

export async function loadSnapshot(): Promise<Snapshot | null> {
  const r = redis();
  if (r) {
    const raw = await r.get<string | Snapshot>(SNAP_KEY);
    if (raw) return typeof raw === "string" ? (JSON.parse(raw) as Snapshot) : raw;
  }
  return memSnapshot;
}

export function snapshotAgeHours(s: Snapshot): number {
  return (Date.now() - new Date(s.updatedAt).getTime()) / 36e5;
}

export async function loadRegistry(): Promise<RegistryProtocol[]> {
  const r = redis();
  if (r) {
    const raw = await r.get<string | RegistryProtocol[]>(REG_KEY);
    if (raw) return typeof raw === "string" ? JSON.parse(raw) : raw;
    return [];
  }
  return memRegistry;
}

export async function saveRegistry(reg: RegistryProtocol[]): Promise<void> {
  memRegistry = reg;
  const r = redis();
  if (r) await r.set(REG_KEY, JSON.stringify(reg));
}

export const hasPersistentStore = () => redis() !== null;

import type { AdapterResult } from "../types";
export async function fetchGearbox(): Promise<AdapterResult> {
  return { opps: [], warnings: ["gearbox: scaffolded"] };
}

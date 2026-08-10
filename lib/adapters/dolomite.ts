import type { AdapterResult } from "../types";
export async function fetchDolomite(): Promise<AdapterResult> {
  return { opps: [], warnings: ["dolomite: scaffolded"] };
}

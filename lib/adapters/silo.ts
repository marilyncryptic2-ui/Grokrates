import type { AdapterResult } from "../types";
export async function fetchSilo(): Promise<AdapterResult> {
  return { opps: [], warnings: ["silo: scaffolded"] };
}

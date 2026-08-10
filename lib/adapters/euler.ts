import type { AdapterResult } from "../types";

export async function fetchEuler(): Promise<AdapterResult> {
  return { opps: [], warnings: ["euler: scaffolded — needs Euler V3 API / lens integration"] };
}

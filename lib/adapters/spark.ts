import type { AdapterResult, YieldOpportunity } from "../types";

// Spark is an Aave v3 fork. For now we rely on the Aave adapter covering
// the shared markets. A dedicated Spark endpoint can be added later if
// Spark-specific markets diverge.

export async function fetchSpark(): Promise<AdapterResult> {
  return { opps: [], warnings: ["spark: covered via Aave adapter for shared markets"] };
}

import type { AdapterResult, YieldOpportunity } from "../types";
import { exposureOf, ACCESS_GATE, EXIT_TERMS, TVL_FLOOR_USD, MIN_APY } from "../config/curation";

// Compound v3 (Comet) — rates come from on-chain view functions.
// Without a reliable public REST aggregator we keep a structured stub
// that can be filled with multi-call results or a public indexer later.

export async function fetchCompound(): Promise<AdapterResult> {
  const warnings: string[] = [];
  // TODO: implement via Comet getSupplyRate / getBorrowRate multi-calls
  // or a public indexer once available.
  warnings.push("compound: adapter scaffolded — needs on-chain rate reads");
  return { opps: [], warnings };
}

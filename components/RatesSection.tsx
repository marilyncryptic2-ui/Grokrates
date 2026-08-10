"use client";
import type { AssetGroupRow } from "@/lib/types";
import { CapitalProvider, CapitalSelector } from "./CapitalContext";
import { RatesTable } from "./RatesTable";

// Client wrapper so the deposit selector and the table share capital state.
export function RatesSection({ groups }: { groups: AssetGroupRow[] }) {
  return (
    <CapitalProvider>
      <div className="rates-head">
        <div>
          <h2 className="section-title" style={{ paddingBottom: 4 }}>ALL RATES</h2>
          <p className="section-sub" style={{ margin: 0 }}>
            Token yield plus venue rate, realized over 30 days where history exists.
            Click an asset for every venue; click a strategy for the steps and your dollar return.
          </p>
        </div>
        <CapitalSelector />
      </div>
      <RatesTable groups={groups} />
    </CapitalProvider>
  );
}

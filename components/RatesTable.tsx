"use client";

import { Fragment, useMemo, useState } from "react";
import type { AssetGroupRow, StrategyResult, VenueRow } from "@/lib/types";
import { useCapital, dollarReturn } from "./CapitalContext";

const GROUPS = ["ALL", "ETH", "BTC", "SOL", "USD", "RWA"] as const;

function eff(v: VenueRow): number {
  const o = v.opp;
  const venueReal = o.apyMean30d != null ? o.apyMean30d : o.apy;
  if (o.nativeYield === o.apy && o.totalApy === o.apy) return venueReal;
  return venueReal + o.nativeYield;
}
function stratOf(v: VenueRow, kind: string): StrategyResult | null {
  return v.strategies.find((s) => s.kind === kind) ?? null;
}

// For the collapsed asset row: the best strategy of each kind across ALL
// venues in the group, so fixed/arb show on the headline row even
// when they live on a lower-APY venue than the best base rate.
function bestOfGroup(venues: VenueRow[]): { best: StrategyResult; venue: VenueRow }[] {
  const byKind = new Map<string, { best: StrategyResult; venue: VenueRow }>();
  for (const v of venues) {
    for (const s of v.strategies) {
      const cur = byKind.get(s.kind);
      if (!cur || s.netApy > cur.best.netApy) byKind.set(s.kind, { best: s, venue: v });
    }
  }
  return [...byKind.values()];
}

function StrategyPanel({ s, colSpan }: { s: StrategyResult; colSpan: number }) {
  const { capital } = useCapital();
  const showStages = s.kind === "loop" && s.stages;
  const yearly = dollarReturn(s.netApy, capital);
  // Base = holding without the strategy; extra = what the strategy adds.
  const baseApy = s.kind === "loop" ? s.breakEvenBorrowApy ?? 0 : 0;
  const extra = baseApy > 0 ? yearly - dollarReturn(baseApy, capital) : null;
  return (
    <tr>
      <td className="panel" colSpan={colSpan}>
        <h4>{s.label} · {s.netApy.toFixed(2)}% · {s.protocolsUsed.length} protocol{s.protocolsUsed.length > 1 ? "s" : ""}</h4>

        <div className="dollar-hero">
          <span className="dollar-big">+${yearly.toLocaleString()}<span className="dollar-per">/year</span></span>
          <span className="dollar-sub">on ${capital.toLocaleString()} deposited
            {extra != null && extra > 0 && <> · <span className="dollar-extra">+${extra.toLocaleString()}</span> more than holding</>}
          </span>
        </div>

        {s.kind === "loop" && s.liquidationBufferPct != null && (
          <SafetyBar leverage={s.leverage ?? 1} maxLeverage={s.maxLeverage ?? 1} bufferPct={s.liquidationBufferPct} />
        )}

        <div className="route">Route: {s.protocolsUsed.join(" → ")}</div>
        <ol>{s.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>
        {showStages && (
          <div className="stage-table">
            <table>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Cycle</th>
                  <th>Deposited</th>
                  <th>Borrowed</th>
                  <th>LTV</th>
                  <th>Buffer to liq.</th>
                </tr>
              </thead>
              <tbody>
                {s.stages!.map((st) => (
                  <tr key={st.cycle}>
                    <td style={{ textAlign: "left" }} className={st.cycle === 0 ? "" : "dim"}>
                      {st.cycle === 0 ? `Final (${s.leverage}x)` : st.cycle}
                    </td>
                    <td className="num">${st.deposited.toLocaleString()}</td>
                    <td className="num">${st.borrowed.toLocaleString()}</td>
                    <td className="num">{(st.cumulativeLtv * 100).toFixed(1)}%</td>
                    <td className={`num ${st.bufferPts < 5 ? "buffer-low" : "buffer-ok"}`}>
                      {st.bufferPts.toFixed(1)} pts
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ul className="risks">{s.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
      </td>
    </tr>
  );
}

// Visual safety bar: green safe zone, amber 5pt buffer, red liquidation zone.
function SafetyBar({ leverage, maxLeverage, bufferPct }: { leverage: number; maxLeverage: number; bufferPct: number }) {
  // Position on the bar = how much of max leverage the safe loop uses.
  const usedPct = maxLeverage > 1 ? Math.min(100, (leverage / maxLeverage) * 100) : 50;
  const safeW = Math.max(0, usedPct);
  const bufferW = 8; // visual width of the 5pt cushion band
  const dangerW = Math.max(0, 100 - safeW - bufferW);
  return (
    <div className="safety">
      <div className="safety-head">
        <span className="safety-title">Safety buffer to liquidation</span>
        <span className="safety-val">{bufferPct.toFixed(1)}% cushion</span>
      </div>
      <div className="safety-bar">
        <div className="safety-safe" style={{ width: `${safeW}%` }} />
        <div className="safety-buffer" style={{ width: `${bufferW}%` }} />
        <div className="safety-danger" style={{ width: `${dangerW}%` }} />
      </div>
      <div className="safety-legend">
        <span>Your position ({leverage}x)</span>
        <span>Max {maxLeverage}x</span>
        <span className="safety-liq">Liquidation</span>
      </div>
    </div>
  );
}

function VenueCells({ v, onStrat, active, override }: {
  v: VenueRow;
  onStrat: (kind: string) => void;
  active: string | null;
  override?: Record<string, StrategyResult>; // header: best-of-group per kind
}) {
  const pick = (kind: string) => override?.[kind] ?? stratOf(v, kind);
  const fixed = pick("fixed");
  const arb = pick("rate-arb");
  const cell = (s: StrategyResult | null, kind: string) =>
    s ? (
      <td className="num strat-cell" onClick={(e) => { e.stopPropagation(); onStrat(kind); }}
          title={`${s.label} — click for steps`}
          style={active === kind ? { textDecoration: "underline" } : undefined}>
        {s.netApy.toFixed(1)}%
      </td>
    ) : <td className="num dim">—</td>;
  return (
    <>
      <td className="num apy">{eff(v).toFixed(2)}%</td>
      <td className="num dim">{v.opp.apyMean30d != null ? `${v.opp.apyMean30d.toFixed(2)}%` : "—"}</td>
      {cell(fixed, "fixed")}
      {cell(arb, "rate-arb")}
      <td className="num dim">${(v.opp.tvlUsd / 1e6).toFixed(0)}M</td>
    </>
  );
}

const COLS = 6;

export function RatesTable({ groups }: { groups: AssetGroupRow[] }) {
  const [filter, setFilter] = useState<(typeof GROUPS)[number]>("ALL");
  const [openAsset, setOpenAsset] = useState<string | null>(null);
  const [openPanel, setOpenPanel] = useState<string | null>(null); // `${asset}:${venueId}:${kind}`

  const rows = useMemo(
    () => groups.filter((g) => filter === "ALL" || g.exposure === filter),
    [groups, filter]
  );

  const togglePanel = (key: string) => setOpenPanel((p) => (p === key ? null : key));

  return (
    <div>
      <div className="filters" role="toolbar" aria-label="Filter by asset group">
        {GROUPS.map((g) => (
          <button key={g} className="chip" data-active={filter === g} onClick={() => setFilter(g)}>
            {g}
          </button>
        ))}
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Asset / venue</th>
              <th>APY</th>
              <th>30d venue</th>
              <th>Fixed</th>
              <th>Rate arb</th>
              <th>TVL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => {
              const open = openAsset === g.asset;
              const headPanelKey = (kind: string) => `${g.asset}:head:${kind}`;
              // Best strategy of each kind across every venue in the group.
              const groupBest = bestOfGroup(g.venues);
              const overrideMap: Record<string, StrategyResult> = {};
              const ownerMap: Record<string, VenueRow> = {};
              for (const { best, venue } of groupBest) {
                overrideMap[best.kind] = best;
                ownerMap[best.kind] = venue;
              }
              return (
                <Fragment key={g.asset}>
                  <tr className="asset-row" onClick={() => { setOpenAsset(open ? null : g.asset); setOpenPanel(null); }}>
                    <td>
                      <strong>{g.asset}</strong> <span className="dim">{open ? "▾" : "▸"}</span>
                      <div className="sub">
                        {g.venueCount} venue{g.venueCount > 1 ? "s" : ""}
                        {g.venueCount > 1 && ` · ${g.apyRange[0].toFixed(1)}–${g.apyRange[1].toFixed(1)}%`}
                        {" · "}{g.best.opp.exitTerms}
                        {g.best.opp.access !== "open" && <span className="badge warn">{g.best.opp.access}</span>}
                        {g.best.opp.flags.includes("reward-heavy") && <span className="badge warn">reward-heavy</span>}
                        {g.best.opp.flags.includes("protocol-reported") && <span className="badge warn">protocol-reported</span>}
                      </div>
                    </td>
                    <VenueCells
                      v={g.best}
                      override={overrideMap}
                      active={openPanel?.startsWith(`${g.asset}:head:`) ? openPanel.split(":")[2] : null}
                      onStrat={(kind) => togglePanel(headPanelKey(kind))}
                    />
                  </tr>
                  {openPanel?.startsWith(`${g.asset}:head:`) && (() => {
                    const kind = openPanel.split(":")[2];
                    const s = overrideMap[kind];
                    const owner = ownerMap[kind];
                    return s ? (
                      <>
                        {owner && owner.opp.id !== g.best.opp.id && (
                          <tr><td className="panel" colSpan={COLS} style={{ paddingBottom: 0, color: "var(--muted)", fontSize: 12 }}>
                            This {s.kind === "rate-arb" ? "spread" : s.kind} runs on {owner.opp.protocolLabel} · {owner.opp.chain} (expand {g.asset} to see that venue).
                          </td></tr>
                        )}
                        <StrategyPanel s={s} colSpan={COLS} />
                      </>
                    ) : null;
                  })()}
                  {open && g.venues.map((v) => {
                    const vid = v.opp.id;
                    const panelKey = (kind: string) => `${g.asset}:${vid}:${kind}`;
                    const activeKind = openPanel?.startsWith(`${g.asset}:${vid}:`) ? openPanel.split(`${g.asset}:${vid}:`)[1] : null;
                    return (
                      <Fragment key={vid}>
                        <tr className="venue-row">
                          <td>
                            <a href={v.opp.url ?? "#"} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                              {v.opp.protocolLabel}
                            </a>
                            <span className="dim"> · {v.opp.chain}</span>
                            <div className="sub">{v.opp.exitTerms}
                              {v.opp.access !== "open" && <span className="badge warn">{v.opp.access}</span>}
                            </div>
                          </td>
                          <VenueCells v={v} active={activeKind} onStrat={(kind) => togglePanel(panelKey(kind))} />
                        </tr>
                        {activeKind && (() => {
                          const s = stratOf(v, activeKind);
                          return s ? <StrategyPanel s={s} colSpan={COLS} /> : null;
                        })()}
                      </Fragment>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="section-sub" style={{ paddingTop: 12 }}>No assets in this group passed the filters.</p>}
    </div>
  );
}

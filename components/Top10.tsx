import type { Snapshot } from "@/lib/types";

export function Top10({ entries }: { entries: Snapshot["top10"] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>#</th>
            <th style={{ textAlign: "left" }}>Asset</th>
            <th style={{ textAlign: "left" }}>Venue</th>
            <th style={{ textAlign: "left" }}>Strategy</th>
            <th>Effective APY</th>
            <th>TVL</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={`${e.rank}`}>
              <td className="rank" style={{ textAlign: "left" }}>{e.rank}</td>
              <td style={{ textAlign: "left" }}>
                <a href={e.url ?? "#"} target="_blank" rel="noreferrer">{e.asset}</a>
              </td>
              <td style={{ textAlign: "left" }} className="dim">{e.venue} · {e.chain}</td>
              <td style={{ textAlign: "left" }}>
                {e.strategyLabel
                  ? <span className="badge strategy">{e.strategyLabel}</span>
                  : <span className="badge">base</span>}
              </td>
              <td className="num apy">{e.effectiveApy.toFixed(2)}%</td>
              <td className="num dim">${(e.tvlUsd / 1e6).toFixed(0)}M</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

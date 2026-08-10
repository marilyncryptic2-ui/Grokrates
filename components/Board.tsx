import type { BoardEntry } from "@/lib/types";

export function Board({ entries }: { entries: BoardEntry[] }) {
  return (
    <section className="board" aria-label="Best rate per asset group">
      {entries.map((e) => (
        <article className="board-card" key={e.exposure}>
          <div className="board-asset">{e.exposure}</div>
          <div className="board-chain">
            {e.baseApy != null && e.overlayApy != null && (
              <>
                <span className="board-base">{e.baseApy.toFixed(1)}%</span>
                <span className="board-arrow" aria-hidden>→</span>
              </>
            )}
            <span className="board-best">
              {(e.overlayApy ?? e.baseApy)?.toFixed(1)}%
            </span>
          </div>
          {e.overlayLabel ? (
            <>
              <div className="board-label">{e.overlayLabel}</div>
              <div className="board-venue">{e.overlayVenue}</div>
            </>
          ) : (
            <div className="board-venue">{e.baseVenue}</div>
          )}
        </article>
      ))}
    </section>
  );
}

import { getSnapshot } from "@/lib/pipeline";
import { Board } from "@/components/Board";
import { Top10 } from "@/components/Top10";
import { RatesSection } from "@/components/RatesSection";
import { RoutesSection } from "@/components/RoutesSection";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
}

export default async function Home() {
  const s = await getSnapshot();
  return (
    <main className="wrap">
      <header className="masthead">
        <div className="wordmark">YIELD<span>BOARD</span>
          <span className="buffer-promise">every loop keeps a 5% liquidation buffer</span>
        </div>
        <div className={`updated ${s.stale ? "stale" : ""}`}>
          {s.stale ? "STALE · " : ""}updated {timeAgo(s.updatedAt)} · {s.poolCount} pools
        </div>
      </header>

      <Board entries={s.board} />

      {s.routes && s.routes.length > 0 && <RoutesSection routes={s.routes} />}

      <RatesSection groups={s.groups} />

      <h2 className="section-title">TOP 10 TODAY</h2>
      <p className="section-sub">
        Base rates and strategies compete in one ranking, by realized yield. Every pool holds at least $10M.
      </p>
      <Top10 entries={s.top10} />

      <footer className="footer">
        <p>
          Rates refresh every 2 hours from direct protocol APIs (Aave, Morpho, Fluid, Lido, Sky, Pendle and more). Loop parameters
          use e-mode values where configured and estimates where flagged. Rates marked
          protocol-reported come from the protocol&apos;s own API and are not independently verified.
        </p>
        <p style={{ marginTop: 8 }}>
          Nothing here is financial advice. Smart contract, depeg, and oracle risk apply to every
          venue listed. DYOR.
        </p>
      </footer>
    </main>
  );
}

"use client";
import type { RouteResult } from "@/lib/strategies/route";
import { useCapital, dollarReturn, CapitalProvider, CapitalSelector } from "./CapitalContext";

// The best looping route per correlation group, rendered as a multi-step path.
export function RoutesSection({ routes }: { routes: RouteResult[] }) {
  return (
    <CapitalProvider>
      <div className="rates-head">
        <div>
          <h2 className="section-title" style={{ paddingBottom: 4 }}>BEST LOOPING ROUTES</h2>
          <p className="section-sub" style={{ margin: 0 }}>
            The highest-yield safe loop per asset group, built by rate-shopping every venue.
            Each step supplies where the rate is best and borrows the cheapest correlated asset.
          </p>
        </div>
        <CapitalSelector />
      </div>
      <div className="routes-grid">
        {routes.map((r) => <RouteCard key={r.group} route={r} />)}
      </div>
    </CapitalProvider>
  );
}

function RouteCard({ route }: { route: RouteResult }) {
  const { capital } = useCapital();

  if (route.show === "passive" || route.steps.length === 0) {
    return (
      <div className="route-card">
        <div className="route-card-head">
          <span className="route-group">{route.group}</span>
          <span className="route-passive-tag">just supply</span>
        </div>
        <div className="route-passive-msg">
          Looping isn&apos;t worth it here. Best move: supply{" "}
          <strong>{route.startAsset}</strong> on <strong>{route.bestPassiveVenue}</strong> at{" "}
          <strong className="pos">{route.bestPassiveApy.toFixed(2)}%</strong>.
        </div>
        <div className="route-dollar">
          +${dollarReturn(route.bestPassiveApy, capital).toLocaleString()}<span className="per">/yr on ${capital.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  const yearly = dollarReturn(route.netApy, capital);
  const extra = yearly - dollarReturn(route.bestPassiveApy, capital);

  return (
    <div className="route-card">
      <div className="route-card-head">
        <span className="route-group">{route.group}</span>
        <span className="route-net">{route.netApy.toFixed(2)}% net</span>
      </div>

      <div className="route-dollar">
        +${yearly.toLocaleString()}<span className="per">/yr on ${capital.toLocaleString()}</span>
        <span className="route-gas-tag">+ gas</span>
        {extra > 0 && <span className="route-extra"> · +${extra.toLocaleString()} vs holding</span>}
      </div>

      <ol className="route-steps">
        {route.steps.map((s) => (
          s.isPark ? (
            <li key={s.step} className="rs-park">
              <span className="rs-park-tag">park</span>
              <span className="rs-supply">{s.supplyAsset}</span>
              <span className="rs-at">@ {s.supplyVenue}</span>
              <span className="rs-chain">{s.supplyChain}</span>
              <span className="rs-rate pos">{s.supplyApy.toFixed(2)}%</span>
              <span className="rs-park-note">final hop parked at best rate</span>
            </li>
          ) : (
            <li key={s.step}>
              <span className="rs-supply">{s.supplyAsset}</span>
              <span className="rs-at">@ {s.supplyVenue}</span>
              <span className="rs-chain">{s.supplyChain}</span>
              <span className="rs-rate pos">{s.supplyApy.toFixed(2)}%</span>
              <span className="rs-arrow">→ borrow</span>
              <span className="rs-borrow">{s.borrowAsset}</span>
              <span className="rs-rate neg">{s.borrowApy.toFixed(2)}%</span>
              <span className="rs-spread">+{s.spread.toFixed(1)}%</span>
            </li>
          )
        ))}
      </ol>

      <div className="route-foot">
        <span>gross ${route.grossYieldUsd.toFixed(0)}</span>
        <span>− borrow ${route.borrowCostUsd.toFixed(0)}</span>
        <span className="route-foot-net">= ${route.netUsd.toFixed(0)}/yr before gas</span>
      </div>
      <div className="route-passive-note">
        vs just supplying {route.startAsset} at {route.bestPassiveApy.toFixed(2)}% on {route.bestPassiveVenue}
      </div>
    </div>
  );
}

"use client";
import { createContext, useContext, useState, ReactNode } from "react";

// Deposit-size selector state, shared so every strategy panel shows the
// dollar return for the capital the user picked.
const CAPITAL_OPTIONS = [1000, 5000, 10000, 50000] as const;

const CapitalCtx = createContext<{ capital: number; setCapital: (n: number) => void }>({
  capital: 10000, setCapital: () => {},
});

export function useCapital() { return useContext(CapitalCtx); }

export function CapitalProvider({ children }: { children: ReactNode }) {
  const [capital, setCapital] = useState<number>(10000);
  return <CapitalCtx.Provider value={{ capital, setCapital }}>{children}</CapitalCtx.Provider>;
}

export function CapitalSelector() {
  const { capital, setCapital } = useCapital();
  return (
    <div className="capital-selector">
      <span className="capital-label">See returns on</span>
      {CAPITAL_OPTIONS.map((amt) => (
        <button
          key={amt}
          className="capital-chip"
          data-active={capital === amt}
          onClick={() => setCapital(amt)}
        >
          ${amt.toLocaleString()}
        </button>
      ))}
    </div>
  );
}

// Given a net APY %, the yearly dollar return on the selected capital.
export function dollarReturn(netApyPct: number, capital: number): number {
  return Math.round(capital * (netApyPct / 100));
}

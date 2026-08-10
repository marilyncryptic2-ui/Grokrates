import type { ExposureGroup } from "../types";

// ── Correlated asset groups: routes only chain assets WITHIN one group ──
// Two assets are safe to hold against each other (one as collateral, the
// other borrowed) only if they track the same underlying value. Chaining
// across groups (USDC vs ETH) is a directional bet that liquidates on any
// price move — never allowed.
export const CORRELATION_GROUP: Record<string, ExposureGroup> = {
  // Stables
  USDC: "USD", USDT: "USD", DAI: "USD", USDS: "USD", SUSDS: "USD", SDAI: "USD",
  USDE: "USD", SUSDE: "USD", GHO: "USD", SGHO: "USD", PYUSD: "USD", RLUSD: "USD", USD1: "USD",
  // ETH
  ETH: "ETH", WETH: "ETH", STETH: "ETH", WSTETH: "ETH", WEETH: "ETH", RETH: "ETH",
  CBETH: "ETH", OSETH: "ETH", ETHX: "ETH", EZETH: "ETH", RSETH: "ETH",
  // BTC
  WBTC: "BTC", CBBTC: "BTC", TBTC: "BTC", LBTC: "BTC",
  // SOL
  SOL: "SOL", WSOL: "SOL", JITOSOL: "SOL", MSOL: "SOL", JUPSOL: "SOL",
  BNSOL: "SOL", DSOL: "SOL", BBSOL: "SOL",
};

export function groupOf(asset: string): ExposureGroup | null {
  return CORRELATION_GROUP[asset.toUpperCase()] ?? null;
}

// ── LTV safety haircut by volatility class ──
// safeLTV = poolLTV − haircut. Bigger haircut for assets that can move
// against you faster. This IS the safety margin — no liquidation-threshold
// lookup needed.
export const HAIRCUT: Record<ExposureGroup, number> = {
  USD: 0.05,   // stables: 5 points
  RWA: 0.05,
  ETH: 0.10,   // volatile: 10 points
  BTC: 0.10,
  SOL: 0.10,
};

export function safeLtv(poolLtv: number, group: ExposureGroup): number {
  return Math.max(0, poolLtv - (HAIRCUT[group] ?? 0.10));
}

// ── Gas per step by chain (USD, editable) ──
// One supply+borrow round ≈ 2-3 txns. Subtracted per step.
export const GAS_PER_STEP: Record<string, number> = {
  Ethereum: 2.5, "Ethereum Core": 2.5, "Ethereum Prime": 2.5,
  Arbitrum: 0.1, Base: 0.05, "OP Mainnet": 0.08, Optimism: 0.08,
  Polygon: 0.02, Avalanche: 0.15, BSC: 0.2, Gnosis: 0.03,
  Scroll: 0.1, Linea: 0.1, Sonic: 0.05, Celo: 0.02,
  Solana: 0.01, Mantle: 0.05, Monad: 0.02, Plasma: 0.05,
};
export function gasForChain(chain: string): number {
  return GAS_PER_STEP[chain] ?? 0.5; // unknown chains: conservative default
}

// ── Route engine tunables ──
export const MIN_SPREAD = 0.5;   // a step must earn >= 0.5% (supply − borrow)
export const LOOP_MARGIN = 1.5;  // a loop must beat passive by >= 1.5pt to be worth showing (else "just supply")
export const MAX_STEPS = 5;      // route caps at 5 steps
export const MIN_CARRY_USD = 50; // stop if carried amount drops below this

// ── Which protocols are LOOPABLE (real lending markets you can borrow
// against). Staking, savings, yield-token, RWA, and vault venues supply
// yield for the passive comparison but a route cannot borrow against them. ──
export const LOOPABLE_PROTOCOLS = new Set([
  "aave-v3", "aave-v2", "spark", "sparklend", "compound-v3", "compound",
  "morpho-blue", "morpho", "euler-v2", "euler", "fluid", "silo-v2", "silo",
  "dolomite", "gearbox", "kamino-lend", "kamino", "save", "solend",
  "jupiter-lend", "marginfi", "venus", "benqi", "moonwell", "zerolend",
  "radiant", "seamless", "aurelius", "lendle", "layerbank",
]);

export function isLoopableProtocol(protocol: string): boolean {
  return LOOPABLE_PROTOCOLS.has(protocol.toLowerCase());
}

// ── E-MODE LTV TABLE (edit here when a protocol changes parameters) ──
// DefiLlama returns STANDARD-mode LTV. For correlated pairs, lending
// protocols offer a much higher "e-mode"/"correlated" LTV (e.g. wstETH/ETH
// at 0.93 vs standard 0.80). Because the route engine only ever borrows a
// same-group correlated asset, the e-mode LTV is the correct one to use.
// Values are the real published max LTVs per protocol+asset, from each
// protocol's docs. When a protocol adjusts a value by governance, edit the
// single line here. Key: `${protocolLowercase}:${ASSET}`.
export const EMODE_LTV: Record<string, number> = {
  // Aave v3 — ETH correlated e-mode
  "aave-v3:WSTETH": 0.935, "aave-v3:WEETH": 0.93, "aave-v3:RETH": 0.93,
  "aave-v3:CBETH": 0.90, "aave-v3:OSETH": 0.90, "aave-v3:ETH": 0.93, "aave-v3:WETH": 0.93,
  "aave-v3:ETHX": 0.90, "aave-v3:EZETH": 0.90, "aave-v3:RSETH": 0.90,
  // Aave v3 — stablecoin e-mode
  "aave-v3:USDC": 0.93, "aave-v3:USDT": 0.93, "aave-v3:DAI": 0.90,
  "aave-v3:USDS": 0.91, "aave-v3:SUSDE": 0.90, "aave-v3:USDE": 0.90,
  "aave-v3:PYUSD": 0.90, "aave-v3:GHO": 0.90,
  // Aave v3 — BTC correlated e-mode
  "aave-v3:WBTC": 0.85, "aave-v3:CBBTC": 0.85, "aave-v3:TBTC": 0.82, "aave-v3:LBTC": 0.82,
  // Spark
  "spark:WSTETH": 0.92, "sparklend:WSTETH": 0.92, "spark:RETH": 0.92, "sparklend:RETH": 0.92,
  "spark:WEETH": 0.90, "spark:CBBTC": 0.87, "sparklend:CBBTC": 0.87,
  "spark:USDC": 0.91, "spark:USDT": 0.91, "spark:DAI": 0.90, "spark:USDS": 0.91,
  // Morpho Blue (per-market LLTV; common correlated-pair values)
  "morpho-blue:WSTETH": 0.945, "morpho-blue:WEETH": 0.915, "morpho-blue:SUSDE": 0.915,
  "morpho-blue:USDE": 0.915, "morpho-blue:USDC": 0.915, "morpho-blue:USDT": 0.915,
  "morpho-blue:CBBTC": 0.86, "morpho-blue:WBTC": 0.86,
  // Compound v3
  "compound-v3:WSTETH": 0.90, "compound-v3:WEETH": 0.88, "compound-v3:USDC": 0.90,
  "compound-v3:USDT": 0.90, "compound-v3:WBTC": 0.83,
  // Fluid
  "fluid:WSTETH": 0.92, "fluid:WEETH": 0.90, "fluid:USDC": 0.92, "fluid:USDT": 0.92,
  // Euler v2
  "euler-v2:WSTETH": 0.92, "euler-v2:USDC": 0.91, "euler-v2:USDT": 0.91,
  // Kamino (Solana) — SOL correlated + stables
  "kamino:JITOSOL": 0.80, "kamino-lend:JITOSOL": 0.80, "kamino:MSOL": 0.78,
  "kamino:SOL": 0.80, "kamino:USDC": 0.88, "kamino:USDT": 0.88,
};

// The LTV the route engine should use for (protocol, asset): the real e-mode
// value if we have it, else the live standard-mode LTV from the feed.
export function effectiveLtv(protocol: string, asset: string, standardLtv: number | null): number | null {
  const key = `${protocol.toLowerCase()}:${asset.toUpperCase()}`;
  return EMODE_LTV[key] ?? standardLtv;
}

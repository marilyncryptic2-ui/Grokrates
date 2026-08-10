import type { ExposureGroup } from "../types";

// ═════════════════════════════════════════════════════════════════
// EDITORIAL CONFIG — the curated layer. Verified against live
// DefiLlama data (Aug 2026 pull). Adding an asset or venue is a
// one-line change here; nothing else in the codebase needs touching.
// ═════════════════════════════════════════════════════════════════

export const ASSET_SHORTLIST: Record<ExposureGroup, string[]> = {
  ETH: ["ETH", "WETH", "STETH", "WSTETH", "WEETH", "RETH", "CBETH", "OSETH", "ETHX", "EZETH", "RSETH"],
  BTC: ["WBTC", "CBBTC", "TBTC", "LBTC"],
  SOL: ["SOL", "WSOL", "JITOSOL", "MSOL", "JUPSOL", "BNSOL", "DSOL", "BBSOL"],
  USD: ["USDC", "USDT", "DAI", "USDS", "SUSDS", "SDAI", "USDE", "SUSDE", "GHO", "SGHO", "PYUSD", "RLUSD", "USD1"],
  RWA: ["USDY", "OUSG", "BUIDL", "USTB", "USYC", "USDM", "VBILL", "THBILL"],
};

export const TICKER_TO_EXPOSURE: Record<string, ExposureGroup> = Object.fromEntries(
  (Object.entries(ASSET_SHORTLIST) as [ExposureGroup, string[]][]).flatMap(
    ([g, ts]) => ts.map((t) => [t, g])
  )
) as Record<string, ExposureGroup>;

export function exposureOf(symbol: string): ExposureGroup | null {
  return TICKER_TO_EXPOSURE[symbol.toUpperCase()] ?? null;
}

// Display grouping: wrappers that are the same asset for row purposes.
export const DISPLAY_ALIAS: Record<string, string> = {
  WETH: "ETH", WSOL: "SOL", WSTETH: "wstETH", STETH: "stETH", WEETH: "weETH",
  RETH: "rETH", CBETH: "cbETH", OSETH: "osETH", ETHX: "ETHx", EZETH: "ezETH", RSETH: "rsETH",
  JITOSOL: "jitoSOL", MSOL: "mSOL", JUPSOL: "jupSOL", BNSOL: "bnSOL", DSOL: "dSOL", BBSOL: "bbSOL",
  SUSDE: "sUSDe", USDE: "USDe", SUSDS: "sUSDS", SDAI: "sDAI", SGHO: "sGHO",
  CBBTC: "cbBTC", TBTC: "tBTC", WBTC: "wBTC", LBTC: "LBTC",
};
export function displayName(t: string): string { return DISPLAY_ALIAS[t.toUpperCase()] ?? t.toUpperCase(); }

// ── PROTOCOL ALLOWLIST — slugs VERIFIED against live /pools data ──
export const PROTOCOL_ALLOWLIST: Record<string, string> = {
  // Lending / money markets
  "aave-v3": "Aave v3",
  "morpho-blue": "Morpho",
  "compound-v3": "Compound v3",
  "sparklend": "Spark",
  "spark-savings": "Spark Savings",
  "euler-v2": "Euler v2",
  "fluid-lending": "Fluid",
  "kamino-lend": "Kamino",
  "marginfi": "marginfi",
  "save": "Save",
  "jupiter-lend": "Jupiter Lend",
  "venus-core-pool": "Venus",
  "benqi-lending": "Benqi",
  "moonwell": "Moonwell",
  "zerolend": "ZeroLend",
  "dolomite": "Dolomite",
  "silo-v2": "Silo v2",
  "gearbox": "Gearbox",
  // Staking / LSTs / LRTs
  "lido": "Lido",
  "rocket-pool": "Rocket Pool",
  "ether.fi-stake": "ether.fi",
  "coinbase-wrapped-staked-eth": "Coinbase cbETH",
  "stakewise-v2": "StakeWise",
  "stader": "Stader",
  "renzo": "Renzo",
  "kelp": "Kelp",
  "jito-liquid-staking": "Jito",
  "marinade-liquid-staking": "Marinade",
  "jupiter-staked-sol": "Jupiter jupSOL",
  "binance-staked-sol": "Binance bnSOL",
  "drift-staked-sol": "Drift dSOL",
  "bybit-staked-sol": "Bybit bbSOL",
  // Yield / structured / savings
  // NOTE: "pendle" is deliberately NOT here. DefiLlama's Pendle entries are
  // LP/pool rows that would show up as fake base venues and wrongly receive
  // native-yield stacking. PT fixed rates come only from the Pendle adapter.
  "ethena-usde": "Ethena",
  "sky-lending": "Sky",
  "yearn-finance": "Yearn",
  "beefy": "Beefy",
  "maple": "Maple",
  // RWA / tokenized treasuries
  "ondo-yield-assets": "Ondo",
  "blackrock-buidl": "BlackRock BUIDL",
  "invesco-ustb": "Invesco USTB (Superstate)",
  "circle-usyc": "Circle USYC",
  "mountain-protocol": "Mountain",
  "openeden-t-bills": "OpenEden",
  "vaneck-treasury-fund": "VanEck VBILL",
  "theo-network-thbill": "Theo THBILL",
  "franklin-templeton": "Franklin Templeton",
};

// ── Native yield sources ──────────────────────────────────────────
// The yield embedded in the TOKEN, keyed to the Llama pool that
// reports it. A venue supply APY on these assets is ON TOP of this.
// Loops lever (nativeYield + venue supply APY).
export const NATIVE_YIELD_SOURCE: Record<string, { project: string; symbol: string }> = {
  WSTETH: { project: "lido", symbol: "STETH" },
  STETH: { project: "lido", symbol: "STETH" },
  WEETH: { project: "ether.fi-stake", symbol: "WEETH" },
  RETH: { project: "rocket-pool", symbol: "RETH" },
  CBETH: { project: "coinbase-wrapped-staked-eth", symbol: "CBETH" },
  OSETH: { project: "stakewise-v2", symbol: "OSETH" },
  ETHX: { project: "stader", symbol: "ETHX" },
  EZETH: { project: "renzo", symbol: "EZETH" },
  RSETH: { project: "kelp", symbol: "RSETH" },
  SUSDE: { project: "ethena-usde", symbol: "SUSDE" },
  SUSDS: { project: "sky-lending", symbol: "SUSDS" },
  SDAI: { project: "sky-lending", symbol: "SDAI" },
  JITOSOL: { project: "jito-liquid-staking", symbol: "JITOSOL" },
  MSOL: { project: "marinade-liquid-staking", symbol: "MSOL" },
  JUPSOL: { project: "jupiter-staked-sol", symbol: "JUPSOL" },
  BNSOL: { project: "binance-staked-sol", symbol: "BNSOL" },
  DSOL: { project: "drift-staked-sol", symbol: "DSOL" },
  BBSOL: { project: "bybit-staked-sol", symbol: "BBSOL" },
  USDY: { project: "ondo-yield-assets", symbol: "USDY" },
};
// Pure staking/RWA projects: the pool IS the native yield; venue rate 0.
export const NATIVE_ONLY_PROJECTS = new Set([
  "lido", "rocket-pool", "ether.fi-stake", "coinbase-wrapped-staked-eth",
  "stakewise-v2", "stader", "renzo", "kelp", "jito-liquid-staking",
  "marinade-liquid-staking", "jupiter-staked-sol", "binance-staked-sol",
  "drift-staked-sol", "bybit-staked-sol", "ethena-usde",
]);

// ── Correlated loop pairs (supply LEFT, borrow RIGHT) ─────────────
export const CORRELATED_BORROW: Record<string, string[]> = {
  WSTETH: ["WETH", "ETH"], WEETH: ["WETH", "ETH"], RETH: ["WETH", "ETH"],
  CBETH: ["WETH", "ETH"], OSETH: ["WETH", "ETH"], ETHX: ["WETH", "ETH"],
  EZETH: ["WETH", "ETH"], RSETH: ["WETH", "ETH"],
  SUSDE: ["USDC", "USDT", "DAI", "USDS"], USDE: ["USDC", "USDT", "DAI", "USDS"],
  SUSDS: ["USDC", "USDT", "DAI"], SDAI: ["USDC", "USDT"],
  JITOSOL: ["SOL", "WSOL"], MSOL: ["SOL", "WSOL"], JUPSOL: ["SOL", "WSOL"],
  DSOL: ["SOL", "WSOL"], BBSOL: ["SOL", "WSOL"], BNSOL: ["SOL", "WSOL"],
  CBBTC: ["WBTC"], LBTC: ["WBTC", "CBBTC"], TBTC: ["WBTC"],
};

// Conversion protocol used inside a loop (borrowed asset -> supplied asset),
// counted in "protocols used".
export const CONVERSION_VIA: Record<string, string> = {
  WSTETH: "Lido", WEETH: "ether.fi", RETH: "Rocket Pool", CBETH: "Coinbase",
  OSETH: "StakeWise", ETHX: "Stader", EZETH: "Renzo", RSETH: "Kelp",
  SUSDE: "Ethena", SUSDS: "Sky", SDAI: "Sky",
  JITOSOL: "Jito", MSOL: "Marinade", JUPSOL: "Jupiter", DSOL: "Drift", BBSOL: "Bybit", BNSOL: "Binance",
  CBBTC: "Curve swap", LBTC: "Curve swap", TBTC: "Curve swap",
};

// ── Aave/Spark e-mode overrides (correlated categories) ───────────
// Llama's lendBorrow reports STANDARD-mode LTV; real loops use e-mode.
// Values from Aave v3 / Spark governance parameters; flag: emode-config.
export const EMODE: Record<string, { ltv: number; lt: number }> = {
  // key: `${slug}:${supply}:${borrow}`
  "aave-v3:WSTETH:WETH": { ltv: 0.935, lt: 0.955 },
  "aave-v3:WEETH:WETH": { ltv: 0.93, lt: 0.95 },
  "aave-v3:RETH:WETH": { ltv: 0.93, lt: 0.95 },
  "aave-v3:CBETH:WETH": { ltv: 0.9, lt: 0.93 },
  "aave-v3:OSETH:WETH": { ltv: 0.9, lt: 0.93 },
  "aave-v3:SUSDE:USDC": { ltv: 0.9, lt: 0.92 },
  "aave-v3:SUSDE:USDT": { ltv: 0.9, lt: 0.92 },
  "aave-v3:USDE:USDC": { ltv: 0.9, lt: 0.92 },
  "sparklend:WSTETH:WETH": { ltv: 0.92, lt: 0.945 },
  "sparklend:RETH:WETH": { ltv: 0.92, lt: 0.945 },
  "sparklend:CBBTC:WBTC": { ltv: 0.87, lt: 0.9 },
};

// ── Exit terms (curated; Llama poolMeta merged on top when present) ──
export const EXIT_TERMS: Record<string, string> = {
  SUSDE: "7d cooldown", STETH: "withdrawal queue", WSTETH: "withdrawal queue",
  USDY: "40–50d transfer lock (new mints)", OUSG: "instant (0.15% fee)",
  BUIDL: "daily redemption", USTB: "T+0 USDC redemption", USYC: "T+0/T+1",
  VBILL: "daily redemption", THBILL: "weekly redemption",
};

export const ACCESS_GATE: Record<string, "kyc" | "institutional"> = {
  OUSG: "kyc", BUIDL: "institutional", USTB: "kyc", USYC: "kyc",
  VBILL: "institutional", THBILL: "kyc", USDY: "kyc",
};

// ── Global thresholds / policy ────────────────────────────────────
export const TVL_FLOOR_USD = 10_000_000;
export const MIN_APY = -5;
export const MAX_SANE_APY = 300;
export const STALE_AFTER_HOURS = 24;
export const SAFE_HEALTH_FACTOR = 1.25;
export const DN_MARGIN_LEVERAGE = 3;       // delta-neutral short margin (k)
export const RATE_ARB_MIN_SPREAD = 0.75;   // pts, below this we don't show arb

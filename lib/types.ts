// Canonical data model. Adapters emit these; engine + UI consume only these.

export type ExposureGroup = "ETH" | "BTC" | "SOL" | "USD" | "RWA";

export type StrategyKind = "loop" | "fixed" | "delta-neutral" | "rate-arb";

export type DataSource =
  | "aave"
  | "morpho"
  | "fluid"
  | "compound"
  | "spark"
  | "euler"
  | "silo"
  | "dolomite"
  | "gearbox"
  | "kamino"
  | "save"
  | "jupiter-lend"
  | "marginfi"
  | "venus"
  | "benqi"
  | "moonwell"
  | "zerolend"
  | "lido"
  | "rocket-pool"
  | "etherfi"
  | "stakewise"
  | "stader"
  | "renzo"
  | "kelp"
  | "coinbase"
  | "jito"
  | "marinade"
  | "jupiter-sol"
  | "binance-sol"
  | "drift-sol"
  | "bybit-sol"
  | "ethena"
  | "sky"
  | "pendle"
  | "yearn"
  | "beefy"
  | "maple"
  | "ondo"
  | "buidl"
  | "usyc"
  | "registry"
  | "funding";

export interface YieldOpportunity {
  id: string;
  source: DataSource;
  protocol: string;            // internal slug
  protocolLabel: string;
  chain: string;
  asset: string;               // ticker, uppercase
  exposure: ExposureGroup;
  apy: number;                 // headline supply APY (venue rate only), percent
  nativeYield: number;         // yield embedded in the token itself (LST/sUSDe), percent
  totalApy: number;            // apy + nativeYield — what holding it here actually earns
  apyBase: number;
  apyReward: number;
  apyMean30d: number | null;   // realized mean when available
  tvlUsd: number;
  url: string | null;
  borrowApy: number | null;
  ltv: number | null;
  liquidationThreshold: number | null;
  exitTerms: string;           // "instant" | "7d cooldown" | "matures 2026-09-25" | "queue" | custom
  access: "open" | "kyc" | "institutional";
  updatedAt: string;
  flags: string[];
}

export interface LoopStage {
  cycle: number;
  deposited: number;   // per $10,000 initial
  borrowed: number;
  cumulativeLtv: number;      // 0..1
  bufferPts: number;          // percentage points to liquidation threshold
}

export interface StrategyResult {
  kind: StrategyKind;
  label: string;
  netApy: number;
  leverage: number | null;
  maxLeverage: number | null;
  liquidationBufferPct: number | null;
  breakEvenBorrowApy: number | null;
  stages: LoopStage[] | null;
  protocolsUsed: string[];
  steps: string[];
  risks: string[];
  basedOn: string;
}

export interface VenueRow {
  opp: YieldOpportunity;
  strategies: StrategyResult[];
}

export interface AssetGroupRow {
  asset: string;
  exposure: ExposureGroup;
  venueCount: number;
  apyRange: [number, number];
  best: VenueRow;
  venues: VenueRow[];
}

export interface BoardEntry {
  exposure: ExposureGroup;
  baseApy: number | null;
  baseVenue: string | null;
  overlayApy: number | null;
  overlayLabel: string | null;
  overlayVenue: string | null;
}

export interface Snapshot {
  updatedAt: string;
  groups: AssetGroupRow[];
  board: BoardEntry[];
  top10: Array<{ rank: number; asset: string; venue: string; chain: string; strategyLabel: string | null; effectiveApy: number; tvlUsd: number; url: string | null }>;
  routes: import("./strategies/route").RouteResult[];
  warnings: string[];
  poolCount: number;
}

export interface RegistryProtocol {
  id: string;
  name: string;
  website: string;
  type: "llama-slug" | "generic-rest";
  llamaSlug?: string;
  apiUrl?: string;
  apiKey?: string;
  map?: { list: string; symbol: string; apyPct: string; tvlUsd: string; chain?: string };
  active: boolean;
}

export interface AdapterResult {
  opps: YieldOpportunity[];
  warnings: string[];
}

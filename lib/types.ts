export type ExposureGroup = "USD" | "ETH" | "BTC" | "SOL" | "RWA";

export interface YieldOpportunity {
  id: string;
  protocol: string;
  protocolLabel: string;
  chain: string;
  asset: string;
  apy: number;
  apyMean30d: number;
  borrowApy: number | null;
  ltv: number | null;
  tvlUsd: number;
  nativeYield: number;
  exposure: ExposureGroup;
  flags: string[];
  url: string;
  exitTerms: string;
  source: string;
  totalApy: number;
  apyBase: number;
  apyReward: number;
  rewardTokens: string[];
  underlyingTokens: string[];
  poolMeta: string | null;
  liquidationThreshold: number | null;
  access: string;
  updatedAt: string;
}

export interface StrategyResult {
  kind: "fixed" | "rate-arb" | "loop";
  label: string;
  netApy: number;
  leverage: number | null;
  maxLeverage: number | null;
  liquidationBufferPct: number | null;
  breakEvenBorrowApy: number | null;
  stages: any[] | null;
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
  top10: Array<{
    rank: number;
    asset: string;
    venue: string;
    chain: string;
    strategyLabel: string | null;
    effectiveApy: number;
    tvlUsd: number;
    url: string;
  }>;
  routes: any[];
  warnings: string[];
  poolCount: number;
}

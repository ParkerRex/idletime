export const bestMetricsLedgerVersion = 1;
export const rollingWindowDurationMs = 24 * 60 * 60 * 1000;
export const defaultBestMetricsIdleCutoffMs = 15 * 60 * 1000;

export type BestMetricKey =
  | "bestConcurrentAgents"
  | "best24hRawBurn"
  | "best24hAgentSumMs";

export type BestMetricRecord = {
  value: number;
  observedAt: Date;
  windowStart: Date;
  windowEnd: Date;
};

export type BestMetricCandidates = Record<BestMetricKey, BestMetricRecord | null>;
export type CurrentBestMetricValues = Record<BestMetricKey, number>;

export type BestEvent = {
  metric: BestMetricKey;
  previousValue: number | null;
  value: number;
  observedAt: Date;
  windowStart: Date;
  windowEnd: Date;
  version: typeof bestMetricsLedgerVersion;
};

export type BestMetricsLedger = BestMetricCandidates & {
  version: typeof bestMetricsLedgerVersion;
  initializedAt: Date;
  lastScannedAt: Date;
};

export type SerializedBestMetricRecord = {
  value: number;
  observedAt: string;
  windowStart: string;
  windowEnd: string;
};

export type SerializedBestMetricsLedger = {
  version: typeof bestMetricsLedgerVersion;
  initializedAt: string;
  lastScannedAt: string;
  bestConcurrentAgents: SerializedBestMetricRecord | null;
  best24hRawBurn: SerializedBestMetricRecord | null;
  best24hAgentSumMs: SerializedBestMetricRecord | null;
};

export type BestLedgerReadOptions = {
  stateDirectory?: string;
};

export type BestLedgerWriteOptions = BestLedgerReadOptions;

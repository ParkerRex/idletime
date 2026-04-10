import type {
  ParsedSession,
  SessionKind,
  SessionReadWarning,
} from "../codex-session-log/types.ts";
import type { CodexLimitReport } from "../codex-limits/types.ts";
import type { ReportWindow } from "../report-window/types.ts";

export type TimeInterval = {
  start: Date;
  end: Date;
};

export type SessionFilters = {
  workspaceOnlyPrefix: string | null;
  sessionKind: SessionKind | null;
  model: string | null;
  reasoningEffort: string | null;
};

export type SummaryGroupBy = "effort" | "model";

export type ActivityMetrics = {
  strictEngagementBlocks: TimeInterval[];
  directActivityBlocks: TimeInterval[];
  agentCoverageBlocks: TimeInterval[];
  agentOnlyBlocks: TimeInterval[];
  perAgentTaskBlocks: TimeInterval[][];
  strictEngagementMs: number;
  directActivityMs: number;
  agentCoverageMs: number;
  agentOnlyMs: number;
  cumulativeAgentMs: number;
  peakConcurrentAgents: number;
};

export type TokenTotals = {
  practicalBurn: number;
  rawTotalTokens: number;
};

export type DailyBurnPoint = {
  start: Date;
  end: Date;
  practicalBurn: number;
};

export type WakeWindow = {
  label: string;
  startMinutes: number;
  endMinutes: number;
};

export type WakeWindowSummary = {
  wakeDurationMs: number;
  strictEngagementMs: number;
  directActivityMs: number;
  agentOnlyMs: number;
  awakeIdleMs: number;
  awakeIdlePercentage: number;
  longestIdleGapMs: number;
};

export type SummaryBreakdownRow = {
  key: string;
  sessionCount: number;
  directActivityMs: number;
  agentCoverageMs: number;
  cumulativeAgentMs: number;
  practicalBurn: number;
  rawTotalTokens: number;
};

export type SummaryBreakdown = {
  dimension: SummaryGroupBy;
  rows: SummaryBreakdownRow[];
};

export type RenderOptions = {
  colorEnabled: boolean;
  shareMode: boolean;
  terminalWidth: number | null;
};

export const jsonReportSchemaVersion = 1 as const;

export type JsonReportMode = "last24h" | "today" | "week" | "hourly" | "live";

export type JsonTimeInterval = {
  start: string;
  end: string;
};

export type JsonReportWindow = {
  label: string;
  start: string;
  end: string;
  timeZone: string;
};

export type JsonSnapshotBase<TMode extends JsonReportMode, TCommand> = {
  schemaVersion: typeof jsonReportSchemaVersion;
  mode: TMode;
  generatedAt: string;
  command: TCommand;
};

export type JsonSummarySnapshotCommand = {
  idleCutoffMs: number;
  filters: SessionFilters;
  groupBy: SummaryGroupBy[];
  wakeWindow: WakeWindow | null;
};

export type JsonHourlySnapshotCommand = {
  idleCutoffMs: number;
  filters: SessionFilters;
  wakeWindow: WakeWindow | null;
};

export type JsonLiveSnapshotCommand = {
  filters: SessionFilters;
};

export type BestPlaque = {
  label: string;
  concurrentAgentsText: string;
  rawBurnText: string;
  agentSumText: string;
};

export type SummaryReport = {
  activityWindow: TimeInterval | null;
  appliedFilters: SessionFilters;
  comparisonCutoffMs: number;
  comparisonMetrics: ActivityMetrics;
  directTokenTotals: TokenTotals;
  groupBreakdowns: SummaryBreakdown[];
  idleCutoffMs: number;
  metrics: ActivityMetrics;
  codexLimitReport?: CodexLimitReport | null;
  sessionReadWarnings: SessionReadWarning[];
  sessionCounts: Record<SessionKind | "total", number>;
  tokenTotals: TokenTotals;
  weeklyBurnTrend: DailyBurnPoint[];
  wakeSummary: WakeWindowSummary | null;
  window: ReportWindow;
};

export type HourlyBucket = {
  start: Date;
  end: Date;
  agentOnlyMs: number;
  awakeIdleMs: number;
  directActivityMs: number;
  engagedMs: number;
  peakConcurrentAgents: number;
  practicalBurn: number;
  rawTotalTokens: number;
  sessionCount: number;
};

export type AgentConcurrencySource =
  | "task-window-adapter"
  | "task-window-adapter-with-session-fallback";

export type HourlyReport = {
  appliedFilters: SessionFilters;
  agentConcurrencySource: AgentConcurrencySource;
  buckets: HourlyBucket[];
  hasWakeWindow: boolean;
  idleCutoffMs: number;
  maxValues: {
    agentOnlyMs: number;
    directActivityMs: number;
    engagedMs: number;
    practicalBurn: number;
  };
  sessionReadWarnings: SessionReadWarning[];
  window: ReportWindow;
};

export type LiveReport = {
  appliedFilters: SessionFilters;
  doneRecentCount: number;
  doneRecentWindowMs: number;
  doneThisTurnCount: number;
  observedAt: Date;
  peakTodayCount: number;
  recentConcurrencyValues: number[];
  runningCount: number;
  runningLocations: Array<{
    cwd: string;
    runningCount: number;
  }>;
  sessionReadWarnings: SessionReadWarning[];
  waitingThreads: Array<{
    cwd: string;
    sessionId: string;
    waitDurationMs: number;
  }>;
  waitingOnUserCount: number;
  waitingOnUserLocations: Array<{
    cwd: string;
    waitingCount: number;
  }>;
  scope: "global" | "workspace";
  workspacePrefix: string | null;
};

export type SummaryReportQuery = {
  codexLimitReport?: CodexLimitReport | null;
  filters: SessionFilters;
  groupBy: SummaryGroupBy[];
  idleCutoffMs: number;
  sessionReadWarnings?: SessionReadWarning[];
  wakeWindow: WakeWindow | null;
  window: ReportWindow;
};

export type HourlyReportQuery = {
  filters: SessionFilters;
  idleCutoffMs: number;
  sessionReadWarnings?: SessionReadWarning[];
  wakeWindow: WakeWindow | null;
  window: ReportWindow;
};

export type SessionGroupValue = {
  key: string;
  sessions: ParsedSession[];
};

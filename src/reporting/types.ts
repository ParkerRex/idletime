import type { ParsedSession, SessionKind } from "../codex-session-log/types.ts";
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
  perSubagentBlocks: TimeInterval[][];
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
  sessionCounts: Record<SessionKind | "total", number>;
  tokenTotals: TokenTotals;
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

export type HourlyReport = {
  appliedFilters: SessionFilters;
  buckets: HourlyBucket[];
  hasWakeWindow: boolean;
  idleCutoffMs: number;
  maxValues: {
    agentOnlyMs: number;
    directActivityMs: number;
    engagedMs: number;
    practicalBurn: number;
  };
  window: ReportWindow;
};

export type SummaryReportQuery = {
  filters: SessionFilters;
  groupBy: SummaryGroupBy[];
  idleCutoffMs: number;
  wakeWindow: WakeWindow | null;
  window: ReportWindow;
};

export type HourlyReportQuery = {
  filters: SessionFilters;
  idleCutoffMs: number;
  wakeWindow: WakeWindow | null;
  window: ReportWindow;
};

export type SessionGroupValue = {
  key: string;
  sessions: ParsedSession[];
};

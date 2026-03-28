import type { ReportWindow } from "../report-window/types.ts";
import type {
  ActivityMetrics,
  JsonReportWindow,
  JsonTimeInterval,
  SessionFilters,
  TimeInterval,
  WakeWindowSummary,
} from "./types.ts";

export type SerializedActivityMetricsV1 = {
  strictEngagementBlocks: JsonTimeInterval[];
  directActivityBlocks: JsonTimeInterval[];
  agentCoverageBlocks: JsonTimeInterval[];
  agentOnlyBlocks: JsonTimeInterval[];
  perAgentTaskBlocks: JsonTimeInterval[][];
  strictEngagementMs: number;
  directActivityMs: number;
  agentCoverageMs: number;
  agentOnlyMs: number;
  cumulativeAgentMs: number;
  peakConcurrentAgents: number;
};

export type SerializedWakeWindowSummaryV1 = {
  wakeDurationMs: number;
  strictEngagementMs: number;
  directActivityMs: number;
  agentOnlyMs: number;
  awakeIdleMs: number;
  awakeIdlePercentage: number;
  longestIdleGapMs: number;
};

export function stringifyJsonSnapshot(snapshot: object): string {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

export function serializeIsoTimestamp(timestamp: Date): string {
  return timestamp.toISOString();
}

export function serializeTimeInterval(interval: TimeInterval): JsonTimeInterval {
  return {
    start: serializeIsoTimestamp(interval.start),
    end: serializeIsoTimestamp(interval.end),
  };
}

export function serializeReportWindow(
  window: ReportWindow,
): JsonReportWindow {
  return {
    label: window.label,
    start: serializeIsoTimestamp(window.start),
    end: serializeIsoTimestamp(window.end),
    timeZone: window.timeZone,
  };
}

export function serializeSessionFilters(
  filters: SessionFilters,
): SessionFilters {
  return {
    workspaceOnlyPrefix: filters.workspaceOnlyPrefix,
    sessionKind: filters.sessionKind,
    model: filters.model,
    reasoningEffort: filters.reasoningEffort,
  };
}

export function serializeActivityMetrics(
  metrics: ActivityMetrics,
): SerializedActivityMetricsV1 {
  return {
    strictEngagementBlocks: metrics.strictEngagementBlocks.map(
      serializeTimeInterval,
    ),
    directActivityBlocks: metrics.directActivityBlocks.map(serializeTimeInterval),
    agentCoverageBlocks: metrics.agentCoverageBlocks.map(serializeTimeInterval),
    agentOnlyBlocks: metrics.agentOnlyBlocks.map(serializeTimeInterval),
    perAgentTaskBlocks: metrics.perAgentTaskBlocks.map((taskBlocks) =>
      taskBlocks.map(serializeTimeInterval),
    ),
    strictEngagementMs: metrics.strictEngagementMs,
    directActivityMs: metrics.directActivityMs,
    agentCoverageMs: metrics.agentCoverageMs,
    agentOnlyMs: metrics.agentOnlyMs,
    cumulativeAgentMs: metrics.cumulativeAgentMs,
    peakConcurrentAgents: metrics.peakConcurrentAgents,
  };
}

export function serializeWakeWindowSummary(
  wakeWindowSummary: WakeWindowSummary,
): SerializedWakeWindowSummaryV1 {
  return {
    wakeDurationMs: wakeWindowSummary.wakeDurationMs,
    strictEngagementMs: wakeWindowSummary.strictEngagementMs,
    directActivityMs: wakeWindowSummary.directActivityMs,
    agentOnlyMs: wakeWindowSummary.agentOnlyMs,
    awakeIdleMs: wakeWindowSummary.awakeIdleMs,
    awakeIdlePercentage: wakeWindowSummary.awakeIdlePercentage,
    longestIdleGapMs: wakeWindowSummary.longestIdleGapMs,
  };
}

import type { HourlyReport, SummaryBreakdown, SummaryBreakdownRow, SummaryReport } from "./types.ts";
import {
  jsonReportSchemaVersion,
  type JsonSnapshotBase,
  type JsonSummarySnapshotCommand,
  type JsonReportMode,
  type JsonTimeInterval,
  type JsonReportWindow,
} from "./types.ts";
import {
  serializeActivityMetrics,
  serializeReportWindow,
  serializeSessionFilters,
  serializeTimeInterval,
  serializeWakeWindowSummary,
  stringifyJsonSnapshot,
  type SerializedActivityMetricsV1,
  type SerializedWakeWindowSummaryV1,
} from "./serialize-json-common.ts";
import {
  serializeHourlyReportPayload,
  type SerializedHourlyReportV1,
} from "./serialize-hourly-report.ts";

export type SerializedSummaryBreakdownRowV1 = {
  key: string;
  sessionCount: number;
  directActivityMs: number;
  agentCoverageMs: number;
  cumulativeAgentMs: number;
  practicalBurn: number;
  rawTotalTokens: number;
};

export type SerializedSummaryBreakdownV1 = {
  dimension: SummaryBreakdown["dimension"];
  rows: SerializedSummaryBreakdownRowV1[];
};

export type SerializedSummaryReportV1 = {
  activityWindow: JsonTimeInterval | null;
  appliedFilters: SummaryReport["appliedFilters"];
  comparisonCutoffMs: number;
  comparisonMetrics: SerializedActivityMetricsV1;
  directTokenTotals: SummaryReport["directTokenTotals"];
  groupBreakdowns: SerializedSummaryBreakdownV1[];
  idleCutoffMs: number;
  metrics: SerializedActivityMetricsV1;
  sessionCounts: SummaryReport["sessionCounts"];
  tokenTotals: SummaryReport["tokenTotals"];
  wakeSummary: SerializedWakeWindowSummaryV1 | null;
  window: JsonReportWindow;
};

export type SerializedSummarySnapshotV1 = JsonSnapshotBase<
  Extract<JsonReportMode, "last24h" | "today">,
  JsonSummarySnapshotCommand
> & {
  hourlyReport: SerializedHourlyReportV1 | null;
  summaryReport: SerializedSummaryReportV1;
};

export type SerializeSummarySnapshotInput = {
  command: JsonSummarySnapshotCommand;
  generatedAt: Date;
  hourlyReport: HourlyReport | null;
  mode: Extract<JsonReportMode, "last24h" | "today">;
  summaryReport: SummaryReport;
};

export function serializeSummarySnapshot(
  input: SerializeSummarySnapshotInput,
): string {
  const snapshot: SerializedSummarySnapshotV1 = {
    schemaVersion: jsonReportSchemaVersion,
    mode: input.mode,
    generatedAt: input.generatedAt.toISOString(),
    command: {
      idleCutoffMs: input.command.idleCutoffMs,
      filters: serializeSessionFilters(input.command.filters),
      groupBy: [...input.command.groupBy],
      wakeWindow: input.command.wakeWindow
        ? { ...input.command.wakeWindow }
        : null,
    },
    hourlyReport: input.hourlyReport
      ? serializeHourlyReportPayload(input.hourlyReport)
      : null,
    summaryReport: serializeSummaryReportPayload(input.summaryReport),
  };

  return stringifyJsonSnapshot(snapshot);
}

function serializeSummaryReportPayload(
  summaryReport: SummaryReport,
): SerializedSummaryReportV1 {
  return {
    activityWindow: summaryReport.activityWindow
      ? serializeTimeInterval(summaryReport.activityWindow)
      : null,
    appliedFilters: serializeSessionFilters(summaryReport.appliedFilters),
    comparisonCutoffMs: summaryReport.comparisonCutoffMs,
    comparisonMetrics: serializeActivityMetrics(
      summaryReport.comparisonMetrics,
    ),
    directTokenTotals: { ...summaryReport.directTokenTotals },
    groupBreakdowns: summaryReport.groupBreakdowns.map(serializeSummaryBreakdown),
    idleCutoffMs: summaryReport.idleCutoffMs,
    metrics: serializeActivityMetrics(summaryReport.metrics),
    sessionCounts: { ...summaryReport.sessionCounts },
    tokenTotals: { ...summaryReport.tokenTotals },
    wakeSummary: summaryReport.wakeSummary
      ? serializeWakeWindowSummary(summaryReport.wakeSummary)
      : null,
    window: serializeReportWindow(summaryReport.window),
  };
}

function serializeSummaryBreakdown(
  breakdown: SummaryBreakdown,
): SerializedSummaryBreakdownV1 {
  return {
    dimension: breakdown.dimension,
    rows: breakdown.rows.map(serializeSummaryBreakdownRow),
  };
}

function serializeSummaryBreakdownRow(
  row: SummaryBreakdownRow,
): SerializedSummaryBreakdownRowV1 {
  return {
    key: row.key,
    sessionCount: row.sessionCount,
    directActivityMs: row.directActivityMs,
    agentCoverageMs: row.agentCoverageMs,
    cumulativeAgentMs: row.cumulativeAgentMs,
    practicalBurn: row.practicalBurn,
    rawTotalTokens: row.rawTotalTokens,
  };
}

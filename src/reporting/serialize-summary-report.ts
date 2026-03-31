import type { HourlyReport, SummaryBreakdown, SummaryBreakdownRow, SummaryReport } from "./types.ts";
import type {
  BurnEstimate,
  CodexLimitReport,
  LimitMetric,
} from "../codex-limits/types.ts";
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
  serializeSessionReadWarnings,
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
  codexLimitReport: SerializedCodexLimitReportV1 | null;
  directTokenTotals: SummaryReport["directTokenTotals"];
  groupBreakdowns: SerializedSummaryBreakdownV1[];
  idleCutoffMs: number;
  metrics: SerializedActivityMetricsV1;
  sessionReadWarnings: SummaryReport["sessionReadWarnings"];
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

export type SerializedCodexLimitReportV1 = {
  fetchedAt: string;
  source: CodexLimitReport["source"];
  fiveHourRemaining: SerializedLimitMetricV1;
  fiveHourWindowBurnTokens: number;
  weeklyRemaining: SerializedLimitMetricV1;
  weeklyWindowBurnTokens: number;
  todayBurnTokens: number;
  lastHourBurnTokens: number;
  todayWeeklyBurn: SerializedBurnEstimateV1;
  lastHourFiveHourBurn: SerializedBurnEstimateV1;
};

export type SerializedLimitMetricV1 =
  | {
      kind: "available";
      usedPercent: number;
      remainingPercent: number;
      resetsAt: string;
      windowDurationMins: number;
    }
  | {
      kind: "unavailable";
      reason: Extract<LimitMetric, { kind: "unavailable" }>["reason"];
    };

export type SerializedBurnEstimateV1 =
  | {
      kind: "estimated";
      percentPoints: number;
      localBurnTokens: number;
      calibrationWindowBurnTokens: number;
    }
  | {
      kind: "unavailable";
      reason: Extract<BurnEstimate, { kind: "unavailable" }>["reason"];
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
    codexLimitReport: summaryReport.codexLimitReport
      ? serializeCodexLimitReport(summaryReport.codexLimitReport)
      : null,
    directTokenTotals: { ...summaryReport.directTokenTotals },
    groupBreakdowns: summaryReport.groupBreakdowns.map(serializeSummaryBreakdown),
    idleCutoffMs: summaryReport.idleCutoffMs,
    metrics: serializeActivityMetrics(summaryReport.metrics),
    sessionReadWarnings: serializeSessionReadWarnings(
      summaryReport.sessionReadWarnings,
    ),
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

function serializeCodexLimitReport(
  codexLimitReport: CodexLimitReport,
): SerializedCodexLimitReportV1 {
  return {
    fetchedAt: codexLimitReport.fetchedAt.toISOString(),
    source: codexLimitReport.source,
    fiveHourRemaining: serializeLimitMetric(codexLimitReport.fiveHourRemaining),
    fiveHourWindowBurnTokens: codexLimitReport.fiveHourWindowBurnTokens,
    weeklyRemaining: serializeLimitMetric(codexLimitReport.weeklyRemaining),
    weeklyWindowBurnTokens: codexLimitReport.weeklyWindowBurnTokens,
    todayBurnTokens: codexLimitReport.todayBurnTokens,
    lastHourBurnTokens: codexLimitReport.lastHourBurnTokens,
    todayWeeklyBurn: serializeBurnEstimate(codexLimitReport.todayWeeklyBurn),
    lastHourFiveHourBurn: serializeBurnEstimate(
      codexLimitReport.lastHourFiveHourBurn,
    ),
  };
}

function serializeLimitMetric(
  metric: LimitMetric,
): SerializedLimitMetricV1 {
  if (metric.kind === "unavailable") {
    return {
      kind: "unavailable",
      reason: metric.reason,
    };
  }

  return {
    kind: "available",
    usedPercent: metric.usedPercent,
    remainingPercent: metric.remainingPercent,
    resetsAt: metric.resetsAt.toISOString(),
    windowDurationMins: metric.windowDurationMins,
  };
}

function serializeBurnEstimate(
  estimate: BurnEstimate,
): SerializedBurnEstimateV1 {
  if (estimate.kind === "unavailable") {
    return {
      kind: "unavailable",
      reason: estimate.reason,
    };
  }

  return {
    kind: "estimated",
    percentPoints: estimate.percentPoints,
    localBurnTokens: estimate.localBurnTokens,
    calibrationWindowBurnTokens: estimate.calibrationWindowBurnTokens,
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

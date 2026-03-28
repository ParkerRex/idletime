import {
  buildBar,
  buildSplitBar,
  formatCompactInteger,
  formatDurationCompact,
  formatDurationClock,
  formatHourOfDay,
  formatDurationHours,
  formatInteger,
  formatPercentage,
  formatSignedDurationHours,
  formatTimeRange,
  padRight,
  shortenPath,
} from "./report-formatting.ts";
import {
  buildLogoSection,
  resolveLogoSectionWidth,
} from "./render-logo-section.ts";
import { buildAgentSection } from "./render-agent-section.ts";
import {
  buildRhythmSection,
} from "./render-rhythm-section.ts";
import { renderPanel, renderSectionTitle } from "./render-shared-sections.ts";
import { dim, measureVisibleTextWidth, paint } from "./render-theme.ts";
import type { BestPlaque, HourlyReport, RenderOptions, SummaryReport } from "./types.ts";

const summaryBarWidth = 18;

export function renderSummaryReport(
  report: SummaryReport,
  options: RenderOptions,
  hourlyReport?: HourlyReport,
  bestPlaque: BestPlaque | null = null,
): string {
  return options.shareMode
    ? renderShareSummaryReport(report, options, hourlyReport, bestPlaque)
    : renderFullSummaryReport(report, options, hourlyReport, bestPlaque);
}

function renderFullSummaryReport(
  report: SummaryReport,
  options: RenderOptions,
  hourlyReport?: HourlyReport,
  bestPlaque: BestPlaque | null = null,
): string {
  const lines: string[] = [];
  const requestedMetrics = report.metrics;
  const actualComparisonMetrics = report.comparisonMetrics;
  const windowDurationMs =
    report.window.end.getTime() - report.window.start.getTime();
  const headerLines = buildSummaryHeaderLines(report, hourlyReport);

  const panelLines = renderPanel(
    `idletime • ${report.window.label}`,
    headerLines,
    options,
  );
  const panelWidth = measureVisibleTextWidth(panelLines[0] ?? "");
  const logoSectionWidth = resolveLogoSectionWidth(panelWidth, options);

  lines.push(...buildLogoSection(logoSectionWidth, options, bestPlaque));
  lines.push("");
  lines.push(...panelLines);
  if (hourlyReport) {
    lines.push("");
    lines.push(...buildAgentSection(hourlyReport, options));
    lines.push("");
    lines.push(...buildRhythmSection(hourlyReport, options));
  }
  lines.push("");
  lines.push(...renderSectionTitle("Activity", options));
  lines.push(
    renderMetricRow(
      "strict",
      requestedMetrics.strictEngagementMs,
      windowDurationMs,
      formatDurationHours(requestedMetrics.strictEngagementMs),
      `${formatSignedDurationHours(
        actualComparisonMetrics.strictEngagementMs -
          requestedMetrics.strictEngagementMs,
      )} at ${formatDurationLabel(report.comparisonCutoffMs)}`,
      "█",
      "focus",
      options,
    ),
  );
  lines.push(
    renderMetricRow(
      "direct",
      requestedMetrics.directActivityMs,
      windowDurationMs,
      formatDurationHours(requestedMetrics.directActivityMs),
      `${formatSignedDurationHours(
        actualComparisonMetrics.directActivityMs -
          requestedMetrics.directActivityMs,
      )} at ${formatDurationLabel(report.comparisonCutoffMs)}`,
      "▓",
      "active",
      options,
    ),
  );
  lines.push(
    renderMetricRow(
      "agent live",
      requestedMetrics.agentCoverageMs,
      windowDurationMs,
      formatDurationHours(requestedMetrics.agentCoverageMs),
      "coverage",
      "▒",
      "agent",
      options,
    ),
  );
  lines.push(
    renderMetricRow(
      "agent sum",
      requestedMetrics.cumulativeAgentMs,
      Math.max(windowDurationMs, requestedMetrics.cumulativeAgentMs),
      formatDurationHours(requestedMetrics.cumulativeAgentMs),
      `peak ${requestedMetrics.peakConcurrentAgents} concurrent`,
      "▚",
      "agent",
      options,
    ),
  );
  lines.push(
    `${paint(padRight("  session mix", 14), "muted", options)} ${paint(
      buildSplitBar(
        [
          {
            filledCharacter: "█",
            value: report.sessionCounts.direct,
          },
          {
            filledCharacter: "▓",
            value: report.sessionCounts.subagent,
          },
        ],
        summaryBarWidth,
      ),
      "active",
      options,
    )}  ${paint(
      `${report.sessionCounts.direct} direct / ${report.sessionCounts.subagent} subagent`,
      "value",
      options,
    )}`,
  );
  lines.push("");
  lines.push(...renderSectionTitle("Tokens", options));
  const maxBurnValue = Math.max(
    report.tokenTotals.practicalBurn,
    report.directTokenTotals.practicalBurn,
  );
  const maxRawValue = Math.max(
    report.tokenTotals.rawTotalTokens,
    report.directTokenTotals.rawTotalTokens,
  );
  lines.push(
    renderMetricRow(
      "practical burn",
      report.tokenTotals.practicalBurn,
      maxBurnValue,
      formatCompactInteger(report.tokenTotals.practicalBurn),
      `${formatPercentage(
        report.tokenTotals.practicalBurn / report.tokenTotals.rawTotalTokens,
      )} of raw`,
      "█",
      "burn",
      options,
      "burn",
    ),
  );
  lines.push(
    renderMetricRow(
      "all raw",
      report.tokenTotals.rawTotalTokens,
      maxRawValue,
      formatCompactInteger(report.tokenTotals.rawTotalTokens),
      `${formatInteger(report.tokenTotals.rawTotalTokens)} total`,
      "█",
      "raw",
      options,
      "raw",
    ),
  );
  lines.push(
    renderMetricRow(
      "direct burn",
      report.directTokenTotals.practicalBurn,
      maxBurnValue,
      formatCompactInteger(report.directTokenTotals.practicalBurn),
      `${formatPercentage(
        report.directTokenTotals.practicalBurn /
          report.tokenTotals.practicalBurn,
      )} of burn`,
      "▒",
      "burn",
      options,
      "burn",
    ),
  );
  lines.push(
    renderMetricRow(
      "direct raw",
      report.directTokenTotals.rawTotalTokens,
      maxRawValue,
      formatCompactInteger(report.directTokenTotals.rawTotalTokens),
      `${formatPercentage(
        report.directTokenTotals.rawTotalTokens /
          report.tokenTotals.rawTotalTokens,
      )} of raw`,
      "▒",
      "raw",
      options,
      "raw",
    ),
  );

  if (report.wakeSummary) {
    lines.push("");
    lines.push(...renderSectionTitle("Wake Window", options));
    lines.push(
      renderMetricRow(
        "direct awake",
        report.wakeSummary.directActivityMs,
        report.wakeSummary.wakeDurationMs,
        formatDurationClock(report.wakeSummary.directActivityMs),
        `of ${formatDurationClock(report.wakeSummary.wakeDurationMs)} wake`,
        "▓",
        "active",
        options,
      ),
    );
    lines.push(
      renderMetricRow(
        "strict awake",
        report.wakeSummary.strictEngagementMs,
        report.wakeSummary.wakeDurationMs,
        formatDurationClock(report.wakeSummary.strictEngagementMs),
        "engaged",
        "█",
        "focus",
        options,
      ),
    );
    lines.push(
      renderMetricRow(
        "agent awake",
        report.wakeSummary.agentOnlyMs,
        report.wakeSummary.wakeDurationMs,
        formatDurationClock(report.wakeSummary.agentOnlyMs),
        "agent-only",
        "▒",
        "agent",
        options,
      ),
    );
    lines.push(
      renderMetricRow(
        "awake idle",
        report.wakeSummary.awakeIdleMs,
        report.wakeSummary.wakeDurationMs,
        formatDurationClock(report.wakeSummary.awakeIdleMs),
        `${formatPercentage(report.wakeSummary.awakeIdlePercentage)} idle`,
        "░",
        "idle",
        options,
      ),
    );
    lines.push(
      `${paint(padRight("  longest gap", 14), "muted", options)} ${paint(
        formatDurationClock(report.wakeSummary.longestIdleGapMs),
        "value",
        options,
      )}  ${dim("largest quiet stretch", options)}`,
    );
  }

  for (const groupBreakdown of report.groupBreakdowns) {
    lines.push("");
    lines.push(
      ...renderSectionTitle(
        groupBreakdown.dimension === "model"
          ? "Model Breakdown"
          : "Effort Breakdown",
        options,
      ),
    );
    const maxBreakdownBurn = Math.max(
      ...groupBreakdown.rows.map((row) => row.practicalBurn),
      0,
    );
    for (const row of groupBreakdown.rows) {
      lines.push(
        `${paint(padRight(`  ${row.key}`, 20), "muted", options)} ${paint(
          buildBar(row.practicalBurn, maxBreakdownBurn, 14, "█"),
          "burn",
          options,
        )}  ${paint(padRight(formatCompactInteger(row.practicalBurn), 6), "value", options)} ${dim("burn", options)}  ${paint(
          padRight(formatDurationCompact(row.directActivityMs), 5),
          "active",
          options,
        )} ${dim("direct", options)}  ${paint(
          padRight(formatDurationCompact(row.agentCoverageMs), 5),
          "agent",
          options,
        )} ${dim("live", options)}  ${paint(`${row.sessionCount} s`, "value", options)}`,
      );
    }
  }

  return lines.join("\n");
}

function renderShareSummaryReport(
  report: SummaryReport,
  options: RenderOptions,
  hourlyReport?: HourlyReport,
  bestPlaque: BestPlaque | null = null,
): string {
  const lines: string[] = [];
  const headerLines = buildSummaryHeaderLines(report, hourlyReport);

  const panelLines = renderPanel(
    `idletime • ${report.window.label}`,
    headerLines,
    options,
  );
  const panelWidth = measureVisibleTextWidth(panelLines[0] ?? "");
  const logoSectionWidth = resolveLogoSectionWidth(panelWidth, options);

  lines.push(...buildLogoSection(logoSectionWidth, options, bestPlaque));
  lines.push("");
  lines.push(...panelLines);

  if (hourlyReport) {
    lines.push("");
    lines.push(...buildAgentSection(hourlyReport, options));
    lines.push("");
    lines.push(...buildRhythmSection(hourlyReport, options));
  }

  lines.push("");
  lines.push(...renderSectionTitle("Snapshot", options));
  lines.push(
    renderSnapshotRow(
      "focus",
      formatDurationHours(report.metrics.strictEngagementMs),
      "focused time",
      "focus",
      options,
    ),
  );
  lines.push(
    renderSnapshotRow(
      "active",
      formatDurationHours(report.metrics.directActivityMs),
      "direct-session movement",
      "active",
      options,
    ),
  );
  lines.push(
    renderSnapshotRow(
      report.wakeSummary ? "idle" : "quiet",
      report.wakeSummary
        ? formatDurationClock(report.wakeSummary.awakeIdleMs)
        : hourlyReport
          ? formatDurationCompact(
              hourlyReport.buckets.reduce(
                (totalDurationMs, bucket) =>
                  totalDurationMs +
                  Math.max(
                    0,
                    bucket.end.getTime() -
                      bucket.start.getTime() -
                      bucket.directActivityMs -
                      bucket.agentOnlyMs,
                  ),
                0,
              ),
            )
          : "n/a",
      report.wakeSummary ? "awake idle" : "quiet hours",
      "idle",
      options,
    ),
  );
  lines.push(
    renderSnapshotRow(
      "burn",
      formatCompactInteger(report.tokenTotals.practicalBurn),
      `${formatPercentage(
        report.tokenTotals.practicalBurn / report.tokenTotals.rawTotalTokens,
      )} of raw`,
      "burn",
      options,
    ),
  );
  lines.push(
    renderSnapshotRow(
      "agents",
      `${report.metrics.peakConcurrentAgents} peak`,
      `${formatDurationHours(report.metrics.cumulativeAgentMs)} cumulative`,
      "agent",
      options,
    ),
  );
  lines.push(
    renderSnapshotRow(
      "sessions",
      `${report.sessionCounts.total}`,
      `${report.sessionCounts.direct} direct / ${report.sessionCounts.subagent} subagent`,
      "value",
      options,
    ),
  );

  return lines.join("\n");
}

function formatAppliedFilters(report: SummaryReport): string[] {
  const appliedFilters: string[] = [];

  if (report.appliedFilters.workspaceOnlyPrefix) {
    appliedFilters.push(
      `workspace=${shortenPath(report.appliedFilters.workspaceOnlyPrefix, 48)}`,
    );
  }

  if (report.appliedFilters.sessionKind) {
    appliedFilters.push(`kind=${report.appliedFilters.sessionKind}`);
  }

  if (report.appliedFilters.model) {
    appliedFilters.push(`model=${report.appliedFilters.model}`);
  }

  if (report.appliedFilters.reasoningEffort) {
    appliedFilters.push(`effort=${report.appliedFilters.reasoningEffort}`);
  }

  return appliedFilters;
}

function buildSummaryHeaderLines(
  report: SummaryReport,
  hourlyReport?: HourlyReport,
): string[] {
  if (!hourlyReport) {
    return [
      formatTimeRange(report.window.start, report.window.end, report.window),
      `${report.sessionCounts.total} sessions · ${formatDurationHours(report.metrics.strictEngagementMs)} focused · ${formatCompactInteger(report.tokenTotals.practicalBurn)} tokens`,
      ...formatAppliedFilters(report).map((filter) => `filter ${filter}`),
    ];
  }

  return [
    buildPostureLine(report, hourlyReport),
    buildBiggestStoryLine(report, hourlyReport),
    buildSupportFactsLine(report),
    ...formatAppliedFilters(report).map((filter) => `filter ${filter}`),
  ];
}

function buildPostureLine(
  report: SummaryReport,
  hourlyReport: HourlyReport,
): string {
  const directActivityMs = Math.max(report.metrics.directActivityMs, 1);
  const focusRatio = report.metrics.strictEngagementMs / directActivityMs;
  const agentCoverageRatio = report.metrics.agentCoverageMs / directActivityMs;
  const quietRatio = sumQuietMs(hourlyReport) /
    Math.max(1, report.window.end.getTime() - report.window.start.getTime());

  const posture =
    quietRatio >= 0.45
      ? "Fragmented day"
      : agentCoverageRatio >= 0.75 && focusRatio < 0.65
        ? "Mostly orchestrating"
        : focusRatio >= 0.8
          ? "Mostly in the loop"
          : report.metrics.peakConcurrentAgents >= 6
            ? "Heavy agent day"
            : "Balanced day";

  return `${posture}: ${formatDurationHours(report.metrics.strictEngagementMs)} focused, ${formatDurationHours(report.metrics.agentCoverageMs)} agent live`;
}

function buildBiggestStoryLine(
  report: SummaryReport,
  hourlyReport: HourlyReport,
): string {
  const longestQuietRun = findLongestQuietRun(hourlyReport);
  const peakBurnBucket = hourlyReport.buckets.reduce(
    (currentPeak, bucket) =>
      bucket.practicalBurn > currentPeak.practicalBurn ? bucket : currentPeak,
    hourlyReport.buckets[0]!,
  );
  const quietPhrase = longestQuietRun.durationMs >= 2 * 3_600_000
    ? `long quiet stretch ${describeDayPeriod(longestQuietRun.start, report)}`
    : "steady rhythm overall";

  return `Biggest story: ${quietPhrase}, big burn ${describeDayPeriod(peakBurnBucket.start, report)}`;
}

function buildSupportFactsLine(report: SummaryReport): string {
  return `${report.sessionCounts.direct} direct / ${report.sessionCounts.subagent} subagent • ${report.metrics.peakConcurrentAgents} peak • ${formatCompactInteger(report.tokenTotals.practicalBurn)} burn`;
}

function sumQuietMs(hourlyReport: HourlyReport): number {
  return hourlyReport.buckets.reduce(
    (totalDurationMs, bucket) =>
      totalDurationMs + Math.max(
        0,
        bucket.end.getTime() - bucket.start.getTime() - bucket.directActivityMs -
          bucket.agentOnlyMs,
      ),
    0,
  );
}

function findLongestQuietRun(hourlyReport: HourlyReport): {
  durationMs: number;
  start: Date;
} {
  let longestQuietRun = {
    durationMs: 0,
    start: hourlyReport.buckets[0]?.start ?? new Date(0),
  };
  let currentStart: Date | null = null;
  let currentDurationMs = 0;

  for (const bucket of hourlyReport.buckets) {
    const quietMs = Math.max(
      0,
      bucket.end.getTime() - bucket.start.getTime() - bucket.directActivityMs -
        bucket.agentOnlyMs,
    );
    const isQuietBucket = quietMs >= 30 * 60_000;

    if (isQuietBucket) {
      currentStart ??= bucket.start;
      currentDurationMs += quietMs;
      continue;
    }

    if (currentStart && currentDurationMs > longestQuietRun.durationMs) {
      longestQuietRun = {
        durationMs: currentDurationMs,
        start: currentStart,
      };
    }

    currentStart = null;
    currentDurationMs = 0;
  }

  if (currentStart && currentDurationMs > longestQuietRun.durationMs) {
    longestQuietRun = {
      durationMs: currentDurationMs,
      start: currentStart,
    };
  }

  if (longestQuietRun.durationMs > 0) {
    return longestQuietRun;
  }

  const quietestBucket = hourlyReport.buckets.reduce(
    (currentQuietest, bucket) => {
      const quietMs = Math.max(
        0,
        bucket.end.getTime() - bucket.start.getTime() - bucket.directActivityMs -
          bucket.agentOnlyMs,
      );
      return quietMs > currentQuietest.durationMs
        ? { durationMs: quietMs, start: bucket.start }
        : currentQuietest;
    },
    longestQuietRun,
  );

  return quietestBucket;
}

function describeDayPeriod(
  timestamp: Date,
  report: SummaryReport,
): string {
  const hourOfDay = Number.parseInt(
    formatHourOfDay(timestamp, report.window),
    10,
  );

  if (hourOfDay >= 21 || hourOfDay < 5) {
    return "overnight";
  }

  if (hourOfDay < 12) {
    return "this morning";
  }

  if (hourOfDay < 17) {
    return "this afternoon";
  }

  return "this evening";
}

function formatDurationLabel(durationMs: number): string {
  return `${Math.round(durationMs / 60_000)}m`;
}

function renderMetricRow(
  label: string,
  value: number,
  maxValue: number,
  primaryText: string,
  detailText: string,
  filledCharacter: string,
  role: "active" | "agent" | "burn" | "focus" | "idle" | "raw",
  options: RenderOptions,
  valueRole:
    | "active"
    | "agent"
    | "burn"
    | "focus"
    | "idle"
    | "raw"
    | "value" = "value",
): string {
  return `${paint(padRight(`  ${label}`, 14), "muted", options)} ${paint(
    buildBar(value, maxValue, summaryBarWidth, filledCharacter),
    role,
    options,
  )}  ${paint(padRight(primaryText, 7), valueRole, options)} ${dim(
    detailText,
    options,
  )}`;
}

function renderSnapshotRow(
  label: string,
  primaryText: string,
  detailText: string,
  role: "active" | "agent" | "burn" | "focus" | "idle" | "value",
  options: RenderOptions,
): string {
  return `${paint(padRight(`  ${label}`, 12), role, options)} ${paint(
    padRight(primaryText, 10),
    "value",
    options,
  )} ${dim(detailText, options)}`;
}

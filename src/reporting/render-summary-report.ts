import {
  buildBar,
  buildSplitBar,
  formatCompactInteger,
  formatDurationCompact,
  formatDurationClock,
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
import {
  buildRhythmSection,
} from "./render-rhythm-section.ts";
import { renderPanel, renderSectionTitle } from "./render-shared-sections.ts";
import { dim, measureVisibleTextWidth, paint } from "./render-theme.ts";
import type { HourlyReport, RenderOptions, SummaryReport } from "./types.ts";

const summaryBarWidth = 18;

export function renderSummaryReport(
  report: SummaryReport,
  options: RenderOptions,
  hourlyReport?: HourlyReport,
): string {
  return options.shareMode
    ? renderShareSummaryReport(report, options, hourlyReport)
    : renderFullSummaryReport(report, options, hourlyReport);
}

function renderFullSummaryReport(
  report: SummaryReport,
  options: RenderOptions,
  hourlyReport?: HourlyReport,
): string {
  const lines: string[] = [];
  const requestedMetrics = report.metrics;
  const actualComparisonMetrics = report.comparisonMetrics;
  const windowDurationMs =
    report.window.end.getTime() - report.window.start.getTime();
  const headerLines = [
    formatTimeRange(report.window.start, report.window.end, report.window),
    `${report.sessionCounts.total} sessions · ${formatDurationHours(requestedMetrics.strictEngagementMs)} focused · ${formatCompactInteger(report.tokenTotals.practicalBurn)} tokens`,
    ...formatAppliedFilters(report).map((filter) => `filter ${filter}`),
  ];

  const panelLines = renderPanel(
    `idletime • ${report.window.label}`,
    headerLines,
    options,
  );
  const panelWidth = measureVisibleTextWidth(panelLines[0] ?? "");
  const logoSectionWidth = resolveLogoSectionWidth(panelWidth, options);

  lines.push(...buildLogoSection(logoSectionWidth, options));
  lines.push("");
  lines.push(...panelLines);
  if (hourlyReport) {
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
): string {
  const lines: string[] = [];
  const headerLines = [
    formatTimeRange(report.window.start, report.window.end, report.window),
    `${report.sessionCounts.total} sessions · ${formatDurationHours(report.metrics.strictEngagementMs)} focused · ${formatCompactInteger(report.tokenTotals.practicalBurn)} tokens`,
    ...formatAppliedFilters(report).map((filter) => `filter ${filter}`),
  ];

  const panelLines = renderPanel(
    `idletime • ${report.window.label}`,
    headerLines,
    options,
  );
  const panelWidth = measureVisibleTextWidth(panelLines[0] ?? "");
  const logoSectionWidth = resolveLogoSectionWidth(panelWidth, options);

  lines.push(...buildLogoSection(logoSectionWidth, options));
  lines.push("");
  lines.push(...panelLines);

  if (hourlyReport) {
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

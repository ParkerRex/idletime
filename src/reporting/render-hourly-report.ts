import {
  buildBar,
  formatCompactInteger,
  formatDurationCompact,
  formatHourBucketLabel,
  formatTimestamp,
  padRight,
  shortenPath,
} from "./report-formatting.ts";
import {
  buildLogoSection,
  resolveLogoSectionWidth,
} from "./render-logo-section.ts";
import { buildRhythmSection } from "./render-rhythm-section.ts";
import { dim, measureVisibleTextWidth, paint } from "./render-theme.ts";
import { renderPanel, renderSectionTitle } from "./render-shared-sections.ts";
import { buildSpikeSection } from "./render-spike-section.ts";
import type { HourlyReport, RenderOptions } from "./types.ts";

const barWidth = 10;

export function renderHourlyReport(
  report: HourlyReport,
  options: RenderOptions,
): string {
  return options.shareMode
    ? renderShareHourlyReport(report, options)
    : renderFullHourlyReport(report, options);
}

function renderFullHourlyReport(
  report: HourlyReport,
  options: RenderOptions,
): string {
  const lines: string[] = [];
  const peakBurnBucket = report.buckets.reduce(
    (currentPeak, bucket) =>
      bucket.practicalBurn > currentPeak.practicalBurn ? bucket : currentPeak,
    report.buckets[0]!,
  );
  const peakFocusBucket = report.buckets.reduce(
    (currentPeak, bucket) =>
      bucket.engagedMs > currentPeak.engagedMs ? bucket : currentPeak,
    report.buckets[0]!,
  );

  const panelLines = renderPanel(`idletime hourly • ${report.window.label}`, [
    `${formatTimestamp(report.window.start, report.window)} -> ${formatTimestamp(
      report.window.end,
      report.window,
    )}`,
    buildFilterLine(report),
    `peaks burn ${formatCompactInteger(
      peakBurnBucket.practicalBurn,
    )} @ ${formatHourBucketLabel(
      peakBurnBucket.start,
      report.window,
    )} • focus ${formatDurationCompact(
      peakFocusBucket.engagedMs,
    )} @ ${formatHourBucketLabel(
      peakFocusBucket.start,
      report.window,
    )} • concurrency ${Math.max(
      ...report.buckets.map((bucket) => bucket.peakConcurrentAgents),
      0,
    )}`,
  ], options);
  const panelWidth = measureVisibleTextWidth(panelLines[0] ?? "");
  const logoSectionWidth = resolveLogoSectionWidth(panelWidth, options);

  lines.push(...buildLogoSection(logoSectionWidth, options));
  lines.push("");
  lines.push(...panelLines);
  lines.push("");
  lines.push(...buildRhythmSection(report, options));
  lines.push("");
  lines.push(...buildSpikeSection(report, options));
  lines.push("");
  lines.push(...renderSectionTitle("Legend", options));
  lines.push(dim("  E engaged  D direct  A agent-only  B practical burn", options));
  lines.push("");
  lines.push(...renderSectionTitle("Hourly View", options));
  lines.push(dim("  hour      E                      D                      A                      B                s   p", options));

  for (const bucket of report.buckets) {
    lines.push(
      `  ${paint(
        padRight(formatHourBucketLabel(bucket.start, report.window), 8),
        "muted",
        options,
      )}  ${paint("E", "focus", options)} ${paint(buildBar(
        bucket.engagedMs,
        report.maxValues.engagedMs,
        barWidth,
        "█",
      ), "focus", options)} ${paint(
        padRight(formatDurationCompact(bucket.engagedMs), 5),
        "value",
        options,
      )}  ${paint("D", "active", options)} ${paint(buildBar(
        bucket.directActivityMs,
        report.maxValues.directActivityMs,
        barWidth,
        "▓",
      ), "active", options)} ${paint(
        padRight(formatDurationCompact(bucket.directActivityMs), 5),
        "value",
        options,
      )}  ${paint("A", "agent", options)} ${paint(buildBar(
        bucket.agentOnlyMs,
        report.maxValues.agentOnlyMs,
        barWidth,
        "▒",
      ), "agent", options)} ${paint(
        padRight(formatDurationCompact(bucket.agentOnlyMs), 5),
        "value",
        options,
      )}  ${paint("B", "burn", options)} ${paint(buildBar(
        bucket.practicalBurn,
        report.maxValues.practicalBurn,
        barWidth,
        "▇",
      ), "burn", options)} ${paint(
        padRight(formatCompactInteger(bucket.practicalBurn), 8),
        "value",
        options,
      )} ${paint(bucket.sessionCount
        .toString()
        .padStart(3), "value", options)} ${paint(
        bucket.peakConcurrentAgents.toString().padStart(3),
        "agent",
        options,
      )}`,
    );
  }

  return lines.join("\n");
}

function renderShareHourlyReport(
  report: HourlyReport,
  options: RenderOptions,
): string {
  const lines: string[] = [];
  const peakBurnBucket = report.buckets.reduce(
    (currentPeak, bucket) =>
      bucket.practicalBurn > currentPeak.practicalBurn ? bucket : currentPeak,
    report.buckets[0]!,
  );

  const panelLines = renderPanel(`idletime hourly • ${report.window.label}`, [
    `${formatTimestamp(report.window.start, report.window)} -> ${formatTimestamp(
      report.window.end,
      report.window,
    )}`,
    buildFilterLine(report),
    `peak burn ${formatCompactInteger(
      peakBurnBucket.practicalBurn,
    )} @ ${formatHourBucketLabel(peakBurnBucket.start, report.window)}`,
  ], options);
  const panelWidth = measureVisibleTextWidth(panelLines[0] ?? "");
  const logoSectionWidth = resolveLogoSectionWidth(panelWidth, options);

  lines.push(...buildLogoSection(logoSectionWidth, options));
  lines.push("");
  lines.push(...panelLines);
  lines.push("");
  lines.push(...buildRhythmSection(report, options));
  lines.push("");
  lines.push(...buildSpikeSection(report, options));

  return lines.join("\n");
}

function buildFilterLine(report: HourlyReport): string {
  const filterParts: string[] = [
    `${Math.round(report.idleCutoffMs / 60_000)}m cutoff`,
  ];

  if (report.appliedFilters.workspaceOnlyPrefix) {
    filterParts.push(
      `workspace ${shortenPath(report.appliedFilters.workspaceOnlyPrefix, 36)}`,
    );
  }

  if (report.appliedFilters.sessionKind) {
    filterParts.push(`kind ${report.appliedFilters.sessionKind}`);
  }

  if (report.appliedFilters.model) {
    filterParts.push(`model ${report.appliedFilters.model}`);
  }

  if (report.appliedFilters.reasoningEffort) {
    filterParts.push(`effort ${report.appliedFilters.reasoningEffort}`);
  }

  return filterParts.join(" • ");
}

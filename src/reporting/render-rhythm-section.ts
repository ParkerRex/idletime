import {
  buildSparkline,
  formatCompactInteger,
  formatDurationCompact,
  formatHourOfDay,
  padRight,
} from "./report-formatting.ts";
import { paint } from "./render-theme.ts";
import { renderSectionTitle } from "./render-shared-sections.ts";
import type { HourlyReport, RenderOptions } from "./types.ts";

export function buildRhythmSection(
  report: HourlyReport,
  options: RenderOptions,
): string[] {
  const quietValues = report.buckets.map((bucket) =>
    Math.max(
      0,
      bucket.end.getTime() -
        bucket.start.getTime() -
        bucket.directActivityMs -
        bucket.agentOnlyMs,
    ),
  );
  const idleValues = report.hasWakeWindow
    ? report.buckets.map((bucket) => bucket.awakeIdleMs)
    : quietValues;
  const idleLabel = report.hasWakeWindow ? "idle" : "quiet";

  return [
    ...renderSectionTitle("24h Rhythm", options),
    paint(`  hours  ${buildHourMarkerLine(report)}`, "muted", options),
    renderRhythmRow(
      "focus",
      buildSparkline(report.buckets.map((bucket) => bucket.engagedMs)),
      formatDurationCompact(
        report.buckets.reduce(
          (totalDurationMs, bucket) => totalDurationMs + bucket.engagedMs,
          0,
        ),
      ),
      "focus",
      options,
    ),
    renderRhythmRow(
      "active",
      buildSparkline(
        report.buckets.map((bucket) => bucket.directActivityMs),
      ),
      formatDurationCompact(
        report.buckets.reduce(
          (totalDurationMs, bucket) =>
            totalDurationMs + bucket.directActivityMs,
          0,
        ),
      ),
      "active",
      options,
    ),
    renderRhythmRow(
      padRight(idleLabel, 6).trimEnd(),
      buildSparkline(idleValues),
      formatDurationCompact(
        idleValues.reduce(
          (totalDurationMs, idleDurationMs) =>
            totalDurationMs + idleDurationMs,
          0,
        ),
      ),
      "idle",
      options,
    ),
    renderRhythmRow(
      "burn",
      buildSparkline(report.buckets.map((bucket) => bucket.practicalBurn)),
      formatCompactInteger(
        report.buckets.reduce(
          (totalBurn, bucket) => totalBurn + bucket.practicalBurn,
          0,
        ),
      ),
      "burn",
      options,
    ),
  ];
}

function buildHourMarkerLine(report: HourlyReport): string {
  const markerCharacters = Array.from(
    { length: report.buckets.length },
    () => " ",
  );

  for (const [index, bucket] of report.buckets.entries()) {
    if (index % 4 !== 0) {
      continue;
    }

    const hourLabel = formatHourOfDay(bucket.start, report.window);
    markerCharacters[index] = hourLabel[0] ?? " ";
    if (index + 1 < markerCharacters.length) {
      markerCharacters[index + 1] = hourLabel[1] ?? " ";
    }
  }

  return markerCharacters.join("");
}

function renderRhythmRow(
  label: string,
  sparkline: string,
  totalText: string,
  role: "active" | "burn" | "focus" | "idle",
  options: RenderOptions,
): string {
  return `${paint(`  ${padRight(label, 6)}`, role, options)} ${paint(
    sparkline,
    role,
    options,
  )}  ${paint(totalText, "value", options)}`;
}

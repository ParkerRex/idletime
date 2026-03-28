import {
  buildSparkline,
  formatCompactInteger,
  formatDurationCompact,
  padRight,
} from "./report-formatting.ts";
import { buildGroupedTrack, buildTimeAxisLine } from "./render-time-axis.ts";
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

  const idleTotal = formatDurationCompact(
    idleValues.reduce(
      (totalDurationMs, idleDurationMs) => totalDurationMs + idleDurationMs,
      0,
    ),
  );

  const lines: string[] = [
    ...renderSectionTitle("24h Rhythm", options),
    paint(`  time   ${buildTimeAxisLine(report)}`, "muted", options),
    renderRhythmRow(
      "focus",
      buildGroupedTrack(
        buildSparkline(report.buckets.map((bucket) => bucket.engagedMs)),
      ),
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
      buildGroupedTrack(
        buildSparkline(report.buckets.map((bucket) => bucket.directActivityMs)),
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
  ];

  lines.push(
    renderRhythmRow(
      padRight(idleLabel, 6).trimEnd(),
      buildGroupedTrack(buildSparkline(idleValues)),
      idleTotal,
      "idle",
      options,
    ),
  );

  lines.push(
    renderRhythmRow(
      "burn",
      buildGroupedTrack(
        buildSparkline(report.buckets.map((bucket) => bucket.practicalBurn)),
      ),
      formatCompactInteger(
        report.buckets.reduce(
          (totalBurn, bucket) => totalBurn + bucket.practicalBurn,
          0,
        ),
      ),
      "burn",
      options,
    ),
  );

  return lines;
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

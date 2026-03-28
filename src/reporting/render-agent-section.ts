import { buildSparkline, formatDurationCompact, padRight } from "./report-formatting.ts";
import { buildGroupedTrack, buildTimeAxisLine } from "./render-time-axis.ts";
import { paint } from "./render-theme.ts";
import { renderSectionTitle } from "./render-shared-sections.ts";
import type { HourlyReport, RenderOptions } from "./types.ts";

export function buildAgentSection(
  report: HourlyReport,
  options: RenderOptions,
): string[] {
  return [
    ...renderSectionTitle("Agents", options),
    paint(`  time   ${buildTimeAxisLine(report)}`, "muted", options),
    `${paint("  conc  ", "agent", options)}${paint(
      buildGroupedTrack(
        buildSparkline(report.buckets.map((bucket) => bucket.peakConcurrentAgents)),
      ),
      "agent",
      options,
    )}  ${paint(
      `${Math.max(...report.buckets.map((bucket) => bucket.peakConcurrentAgents), 0)} peak`,
      "value",
      options,
    )}`,
    `${paint("  unit  ", "muted", options)}${paint(
      report.agentConcurrencySource === "task-window-adapter"
        ? "task windows"
        : "task windows with session fallback",
      "muted",
      options,
    )}  ${paint(
      padRight(
        formatDurationCompact(
          report.buckets.reduce(
            (totalDurationMs, bucket) => totalDurationMs + bucket.agentOnlyMs,
            0,
          ),
        ),
        5,
      ),
      "agent",
      options,
    )} ${paint("agent-only", "muted", options)}`,
  ];
}

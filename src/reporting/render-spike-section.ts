import {
  formatCompactInteger,
  formatDurationCompact,
  formatHourBucketLabel,
  padRight,
} from "./report-formatting.ts";
import { paint } from "./render-theme.ts";
import { renderSectionTitle } from "./render-shared-sections.ts";
import type { HourlyReport, RenderOptions } from "./types.ts";

export function buildSpikeSection(
  report: HourlyReport,
  options: RenderOptions,
): string[] {
  const spikeBuckets = [...report.buckets]
    .filter((bucket) => bucket.practicalBurn > 0)
    .sort(
      (leftBucket, rightBucket) =>
        rightBucket.practicalBurn - leftBucket.practicalBurn,
    )
    .slice(0, 3);

  if (spikeBuckets.length === 0) {
    return [];
  }

  return [
    ...renderSectionTitle("Spike Callouts", options),
    ...spikeBuckets.map((bucket, index) =>
      `${paint(
        `  #${index + 1}`,
        "burn",
        options,
      )} ${paint(
        padRight(formatHourBucketLabel(bucket.start, report.window), 8),
        "value",
        options,
      )} ${paint(
        padRight(formatCompactInteger(bucket.practicalBurn), 7),
        "burn",
        options,
      )} burn  ${paint(
        padRight(formatDurationCompact(bucket.directActivityMs), 5),
        "active",
        options,
      )} direct  ${paint(
        padRight(formatDurationCompact(bucket.engagedMs), 5),
        "focus",
        options,
      )} focus  ${paint(
        `${bucket.peakConcurrentAgents}`.padStart(2),
        "agent",
        options,
      )} peak`,
    ),
  ];
}

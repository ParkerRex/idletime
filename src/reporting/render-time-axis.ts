import { formatAxisTimeLabel, padRight } from "./report-formatting.ts";
import type { HourlyReport } from "./types.ts";

const axisGroupSize = 4;

export function buildGroupedTrack(text: string): string {
  const groups: string[] = [];

  for (let index = 0; index < text.length; index += axisGroupSize) {
    groups.push(text.slice(index, index + axisGroupSize));
  }

  return groups.join("│");
}

export function buildTimeAxisLine(report: HourlyReport): string {
  const axisGroups: string[] = [];

  for (
    let bucketIndex = 0;
    bucketIndex < report.buckets.length;
    bucketIndex += axisGroupSize
  ) {
    const bucket = report.buckets[bucketIndex];
    if (!bucket) {
      continue;
    }

    axisGroups.push(
      padRight(
        formatAxisTimeLabel(bucket.start, report.window),
        Math.min(axisGroupSize, report.buckets.length - bucketIndex),
      ),
    );
  }

  return axisGroups.join("│");
}

import { mergeTimeIntervals } from "./time-interval.ts";
import type { TimeInterval } from "./types.ts";

export function buildActivityBlocks(
  timestamps: Date[],
  idleCutoffMs: number,
): TimeInterval[] {
  if (timestamps.length === 0) {
    return [];
  }

  const intervals = timestamps
    .slice()
    .sort((leftTimestamp, rightTimestamp) => leftTimestamp.getTime() - rightTimestamp.getTime())
    .map((timestamp) => ({
      start: new Date(timestamp),
      end: new Date(timestamp.getTime() + idleCutoffMs),
    }));

  return mergeTimeIntervals(intervals);
}

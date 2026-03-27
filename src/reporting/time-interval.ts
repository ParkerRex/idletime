import type { TimeInterval } from "./types.ts";

export function mergeTimeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  if (intervals.length === 0) {
    return [];
  }

  const sortedIntervals = [...intervals].sort(
    (leftInterval, rightInterval) =>
      leftInterval.start.getTime() - rightInterval.start.getTime(),
  );
  const mergedIntervals: TimeInterval[] = [copyInterval(sortedIntervals[0]!)];

  for (const interval of sortedIntervals.slice(1)) {
    const currentInterval = mergedIntervals[mergedIntervals.length - 1]!;
    if (interval.start.getTime() <= currentInterval.end.getTime()) {
      currentInterval.end = new Date(
        Math.max(currentInterval.end.getTime(), interval.end.getTime()),
      );
      continue;
    }

    mergedIntervals.push(copyInterval(interval));
  }

  return mergedIntervals;
}

export function intersectTimeIntervals(
  leftIntervals: TimeInterval[],
  rightIntervals: TimeInterval[],
): TimeInterval[] {
  const intersections: TimeInterval[] = [];

  for (const leftInterval of leftIntervals) {
    for (const rightInterval of rightIntervals) {
      const start = new Date(
        Math.max(leftInterval.start.getTime(), rightInterval.start.getTime()),
      );
      const end = new Date(
        Math.min(leftInterval.end.getTime(), rightInterval.end.getTime()),
      );

      if (start.getTime() < end.getTime()) {
        intersections.push({ start, end });
      }
    }
  }

  return mergeTimeIntervals(intersections);
}

export function subtractTimeIntervals(
  baseIntervals: TimeInterval[],
  intervalsToRemove: TimeInterval[],
): TimeInterval[] {
  const mergedRemovals = mergeTimeIntervals(intervalsToRemove);
  let remainingIntervals = mergeTimeIntervals(baseIntervals);

  for (const removal of mergedRemovals) {
    const nextRemainingIntervals: TimeInterval[] = [];

    for (const interval of remainingIntervals) {
      if (
        removal.end.getTime() <= interval.start.getTime() ||
        removal.start.getTime() >= interval.end.getTime()
      ) {
        nextRemainingIntervals.push(interval);
        continue;
      }

      if (removal.start.getTime() > interval.start.getTime()) {
        nextRemainingIntervals.push({
          start: interval.start,
          end: new Date(removal.start),
        });
      }

      if (removal.end.getTime() < interval.end.getTime()) {
        nextRemainingIntervals.push({
          start: new Date(removal.end),
          end: interval.end,
        });
      }
    }

    remainingIntervals = nextRemainingIntervals;
  }

  return remainingIntervals;
}

export function sumTimeIntervalsMs(intervals: TimeInterval[]): number {
  return intervals.reduce(
    (totalDurationMs, interval) =>
      totalDurationMs + (interval.end.getTime() - interval.start.getTime()),
    0,
  );
}

export function measureOverlapMs(
  intervals: TimeInterval[],
  targetInterval: TimeInterval,
): number {
  return sumTimeIntervalsMs(intersectTimeIntervals(intervals, [targetInterval]));
}

export function peakConcurrency(intervalGroups: TimeInterval[][]): number {
  const edges: Array<{ delta: number; timestampMs: number }> = [];

  for (const intervalGroup of intervalGroups) {
    for (const interval of intervalGroup) {
      edges.push({ timestampMs: interval.start.getTime(), delta: 1 });
      edges.push({ timestampMs: interval.end.getTime(), delta: -1 });
    }
  }

  edges.sort(
    (leftEdge, rightEdge) =>
      leftEdge.timestampMs - rightEdge.timestampMs || leftEdge.delta - rightEdge.delta,
  );

  let activeCount = 0;
  let peakActiveCount = 0;

  for (const edge of edges) {
    activeCount += edge.delta;
    peakActiveCount = Math.max(peakActiveCount, activeCount);
  }

  return peakActiveCount;
}

function copyInterval(interval: TimeInterval): TimeInterval {
  return {
    start: new Date(interval.start),
    end: new Date(interval.end),
  };
}

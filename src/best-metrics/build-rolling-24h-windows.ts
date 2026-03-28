import type { TimeInterval } from "../reporting/types.ts";
import type { BestMetricRecord } from "./types.ts";
import { rollingWindowDurationMs } from "./types.ts";

type WeightedPoint = {
  timestamp: Date;
  value: number;
};

type SlopeChange = {
  deltaSlope: number;
  timestampMs: number;
};

export function findBestRollingWindowTotal(
  weightedPoints: WeightedPoint[],
): BestMetricRecord | null {
  const sortedPoints = weightedPoints
    .filter((point) => point.value > 0)
    .slice()
    .sort(
      (leftPoint, rightPoint) =>
        leftPoint.timestamp.getTime() - rightPoint.timestamp.getTime(),
    );

  if (sortedPoints.length === 0) {
    return null;
  }

  let bestValue = 0;
  let bestTimestampMs = 0;
  let currentTotal = 0;
  let leftIndex = 0;

  for (let rightIndex = 0; rightIndex < sortedPoints.length; rightIndex += 1) {
    const rightPoint = sortedPoints[rightIndex]!;
    currentTotal += rightPoint.value;

    while (
      rightPoint.timestamp.getTime() -
          sortedPoints[leftIndex]!.timestamp.getTime() > rollingWindowDurationMs
    ) {
      currentTotal -= sortedPoints[leftIndex]!.value;
      leftIndex += 1;
    }

    if (currentTotal > bestValue) {
      bestValue = currentTotal;
      bestTimestampMs = rightPoint.timestamp.getTime();
    }
  }

  if (bestValue === 0) {
    return null;
  }

  return createRollingRecord(bestValue, bestTimestampMs);
}

export function findBestRollingWindowOverlap(
  intervals: TimeInterval[],
): BestMetricRecord | null {
  const slopeChanges = intervals.flatMap(buildSlopeChanges);

  if (slopeChanges.length === 0) {
    return null;
  }

  slopeChanges.sort(
    (leftChange, rightChange) => leftChange.timestampMs - rightChange.timestampMs,
  );

  let bestTimestampMs = 0;
  let bestValue = 0;
  let currentSlope = 0;
  let currentValue = 0;
  let previousTimestampMs = slopeChanges[0]!.timestampMs;
  let index = 0;

  while (index < slopeChanges.length) {
    const timestampMs = slopeChanges[index]!.timestampMs;
    currentValue += currentSlope * (timestampMs - previousTimestampMs);

    if (currentValue > bestValue) {
      bestValue = currentValue;
      bestTimestampMs = timestampMs;
    }

    while (
      index < slopeChanges.length &&
      slopeChanges[index]!.timestampMs === timestampMs
    ) {
      currentSlope += slopeChanges[index]!.deltaSlope;
      index += 1;
    }

    previousTimestampMs = timestampMs;
  }

  if (bestValue === 0) {
    return null;
  }

  return createRollingRecord(bestValue, bestTimestampMs);
}

function buildSlopeChanges(interval: TimeInterval): SlopeChange[] {
  const startMs = interval.start.getTime();
  const endMs = interval.end.getTime();
  if (endMs <= startMs) {
    return [];
  }

  return [
    { timestampMs: startMs, deltaSlope: 1 },
    { timestampMs: endMs, deltaSlope: -1 },
    { timestampMs: startMs + rollingWindowDurationMs, deltaSlope: -1 },
    { timestampMs: endMs + rollingWindowDurationMs, deltaSlope: 1 },
  ];
}

function createRollingRecord(
  value: number,
  observedAtMs: number,
): BestMetricRecord {
  return {
    value,
    observedAt: new Date(observedAtMs),
    windowStart: new Date(observedAtMs - rollingWindowDurationMs),
    windowEnd: new Date(observedAtMs),
  };
}

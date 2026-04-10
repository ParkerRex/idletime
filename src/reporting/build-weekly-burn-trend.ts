import { buildTokenDeltaPoints } from "../codex-session-log/extract-token-points.ts";
import type { ParsedSession } from "../codex-session-log/types.ts";
import {
  createUtcDateFromZonedParts,
  getZonedDateParts,
} from "../report-window/time-zone.ts";
import type { ReportWindow } from "../report-window/types.ts";
import type { DailyBurnPoint } from "./types.ts";

const weeklyBurnTrendDays = 7;

export function buildWeeklyBurnTrend(
  sessions: ParsedSession[],
  reportWindow: Pick<ReportWindow, "end" | "timeZone">,
): DailyBurnPoint[] {
  const todayStart = buildZonedDayStart(reportWindow.end, reportWindow.timeZone);
  const oldestBucketStart = addZonedDays(
    todayStart,
    reportWindow.timeZone,
    -(weeklyBurnTrendDays - 1),
  );
  const buckets = Array.from({ length: weeklyBurnTrendDays }, (_, index) => {
    const start = addZonedDays(oldestBucketStart, reportWindow.timeZone, index);
    const nextStart = addZonedDays(
      oldestBucketStart,
      reportWindow.timeZone,
      index + 1,
    );

    return {
      start,
      end: index === weeklyBurnTrendDays - 1 ? reportWindow.end : nextStart,
      practicalBurn: 0,
    };
  });

  for (const session of sessions) {
    for (const tokenDeltaPoint of buildTokenDeltaPoints(session.tokenPoints)) {
      const timestampMs = tokenDeltaPoint.timestamp.getTime();
      const matchingBucket = buckets.find(
        (bucket) =>
          timestampMs >= bucket.start.getTime() &&
          timestampMs < bucket.end.getTime(),
      );

      if (!matchingBucket) {
        continue;
      }

      matchingBucket.practicalBurn += tokenDeltaPoint.deltaUsage.practicalBurn;
    }
  }

  return buckets;
}

function buildZonedDayStart(timestamp: Date, timeZone: string): Date {
  const zonedParts = getZonedDateParts(timestamp, timeZone);

  return createUtcDateFromZonedParts(
    {
      year: zonedParts.year,
      month: zonedParts.month,
      day: zonedParts.day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
}

function addZonedDays(timestamp: Date, timeZone: string, days: number): Date {
  const zonedParts = getZonedDateParts(timestamp, timeZone);
  const shiftedUtcDate = new Date(
    Date.UTC(zonedParts.year, zonedParts.month - 1, zonedParts.day + days),
  );

  return createUtcDateFromZonedParts(
    {
      year: shiftedUtcDate.getUTCFullYear(),
      month: shiftedUtcDate.getUTCMonth() + 1,
      day: shiftedUtcDate.getUTCDate(),
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  );
}

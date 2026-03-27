import type { ReportWindow } from "../report-window/types.ts";
import {
  createUtcDateFromZonedParts,
  getZonedDateParts,
} from "../report-window/time-zone.ts";
import { intersectTimeIntervals, mergeTimeIntervals, subtractTimeIntervals, sumTimeIntervalsMs } from "./time-interval.ts";
import type { ActivityMetrics, TimeInterval, WakeWindow, WakeWindowSummary } from "./types.ts";

export function parseWakeWindow(wakeWindowText: string): WakeWindow {
  const match = /^(\d{2}):(\d{2})-(\d{2}):(\d{2})$/.exec(wakeWindowText.trim());
  if (!match) {
    throw new Error(`Unsupported wake window "${wakeWindowText}". Use HH:MM-HH:MM.`);
  }

  const startMinutes = Number(match[1]) * 60 + Number(match[2]);
  const endMinutes = Number(match[3]) * 60 + Number(match[4]);

  if (startMinutes > 24 * 60 || endMinutes > 24 * 60) {
    throw new Error("Wake window minutes must stay within the day.");
  }

  return {
    label: wakeWindowText,
    startMinutes,
    endMinutes,
  };
}

export function summarizeWakeWindow(
  wakeWindow: WakeWindow,
  reportWindow: ReportWindow,
  activityMetrics: ActivityMetrics,
): WakeWindowSummary {
  const wakeIntervals = buildWakeIntervalsForReportWindow(wakeWindow, reportWindow);
  const strictIntervals = intersectTimeIntervals(
    activityMetrics.strictEngagementBlocks,
    wakeIntervals,
  );
  const directIntervals = intersectTimeIntervals(
    activityMetrics.directActivityBlocks,
    wakeIntervals,
  );
  const agentOnlyIntervals = intersectTimeIntervals(
    activityMetrics.agentOnlyBlocks,
    wakeIntervals,
  );
  const awakeBusyIntervals = mergeTimeIntervals([
    ...directIntervals,
    ...agentOnlyIntervals,
  ]);
  const awakeIdleIntervals = subtractTimeIntervals(wakeIntervals, awakeBusyIntervals);
  const wakeDurationMs = sumTimeIntervalsMs(wakeIntervals);
  const awakeIdleMs = sumTimeIntervalsMs(awakeIdleIntervals);

  return {
    wakeDurationMs,
    strictEngagementMs: sumTimeIntervalsMs(strictIntervals),
    directActivityMs: sumTimeIntervalsMs(directIntervals),
    agentOnlyMs: sumTimeIntervalsMs(agentOnlyIntervals),
    awakeIdleMs,
    awakeIdlePercentage:
      wakeDurationMs === 0 ? 0 : awakeIdleMs / wakeDurationMs,
    longestIdleGapMs: awakeIdleIntervals.reduce(
      (longestGapMs, interval) =>
        Math.max(longestGapMs, interval.end.getTime() - interval.start.getTime()),
      0,
    ),
  };
}

export function buildWakeIntervalsForReportWindow(
  wakeWindow: WakeWindow,
  reportWindow: ReportWindow,
): TimeInterval[] {
  const intervals: TimeInterval[] = [];
  const firstDayParts = getZonedDateParts(
    reportWindow.start,
    reportWindow.timeZone,
  );
  const lastDayParts = getZonedDateParts(
    reportWindow.end,
    reportWindow.timeZone,
  );
  const firstDay = new Date(
    Date.UTC(firstDayParts.year, firstDayParts.month - 1, firstDayParts.day),
  );
  const lastDay = new Date(
    Date.UTC(lastDayParts.year, lastDayParts.month - 1, lastDayParts.day),
  );

  for (
    const day = new Date(firstDay);
    day.getTime() <= lastDay.getTime();
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const start = createUtcDateFromZonedParts(
      {
        year: day.getUTCFullYear(),
        month: day.getUTCMonth() + 1,
        day: day.getUTCDate(),
        hour: Math.floor(wakeWindow.startMinutes / 60),
        minute: wakeWindow.startMinutes % 60,
        second: 0,
      },
      reportWindow.timeZone,
    );

    const endDay = new Date(day);
    if (wakeWindow.endMinutes <= wakeWindow.startMinutes) {
      endDay.setUTCDate(endDay.getUTCDate() + 1);
    }
    const end = createUtcDateFromZonedParts(
      {
        year: endDay.getUTCFullYear(),
        month: endDay.getUTCMonth() + 1,
        day: endDay.getUTCDate(),
        hour: Math.floor(wakeWindow.endMinutes / 60),
        minute: wakeWindow.endMinutes % 60,
        second: 0,
      },
      reportWindow.timeZone,
    );

    const clippedStart = new Date(
      Math.max(start.getTime(), reportWindow.start.getTime()),
    );
    const clippedEnd = new Date(
      Math.min(end.getTime(), reportWindow.end.getTime()),
    );

    if (clippedStart.getTime() < clippedEnd.getTime()) {
      intervals.push({ start: clippedStart, end: clippedEnd });
    }
  }

  return intervals;
}

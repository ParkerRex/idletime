import type { ParsedSession } from "../codex-session-log/types.ts";
import { buildTokenDeltaPoints } from "../codex-session-log/extract-token-points.ts";
import { buildActivityMetrics } from "./activity-metrics.ts";
import { filterSessions } from "./filter-sessions.ts";
import { measureOverlapMs, peakConcurrency } from "./time-interval.ts";
import { buildWakeIntervalsForReportWindow } from "./wake-window.ts";
import type { HourlyBucket, HourlyReport, HourlyReportQuery, TimeInterval } from "./types.ts";

export function buildHourlyReport(
  sessions: ParsedSession[],
  query: HourlyReportQuery,
): HourlyReport {
  const filteredSessions = filterSessions(sessions, query.filters);
  const metrics = buildActivityMetrics(
    filteredSessions,
    query.idleCutoffMs,
    query.window.end,
  );
  const wakeIntervals = query.wakeWindow
    ? buildWakeIntervalsForReportWindow(query.wakeWindow, query.window)
    : null;
  const buckets = buildBuckets(
    query.window.start,
    query.window.end,
    filteredSessions,
    metrics,
    wakeIntervals,
  );

  return {
    appliedFilters: query.filters,
    agentConcurrencySource: filteredSessions.some(
      (session) => session.kind === "subagent" && session.taskWindows.length === 0,
    )
      ? "task-window-adapter-with-session-fallback"
      : "task-window-adapter",
    buckets,
    hasWakeWindow: query.wakeWindow !== null,
    idleCutoffMs: query.idleCutoffMs,
    maxValues: {
      agentOnlyMs: Math.max(...buckets.map((bucket) => bucket.agentOnlyMs), 0),
      directActivityMs: Math.max(
        ...buckets.map((bucket) => bucket.directActivityMs),
        0,
      ),
      engagedMs: Math.max(...buckets.map((bucket) => bucket.engagedMs), 0),
      practicalBurn: Math.max(...buckets.map((bucket) => bucket.practicalBurn), 0),
    },
    sessionReadWarnings: query.sessionReadWarnings ?? [],
    window: query.window,
  };
}

function buildBuckets(
  windowStart: Date,
  windowEnd: Date,
  sessions: ParsedSession[],
  metrics: ReturnType<typeof buildActivityMetrics>,
  wakeIntervals: TimeInterval[] | null,
): HourlyBucket[] {
  const buckets: HourlyBucket[] = [];
  const firstBucketStart = startOfHour(windowStart);

  for (
    const bucketStart = new Date(firstBucketStart);
    bucketStart.getTime() < windowEnd.getTime();
    bucketStart.setHours(bucketStart.getHours() + 1)
  ) {
    const bucketEnd = new Date(
      Math.min(
        bucketStart.getTime() + 60 * 60 * 1000,
        windowEnd.getTime(),
      ),
    );
    const bucketInterval = { start: new Date(bucketStart), end: bucketEnd };
    const directActivityMs = measureOverlapMs(
      metrics.directActivityBlocks,
      bucketInterval,
    );
    const agentOnlyMs = measureOverlapMs(metrics.agentOnlyBlocks, bucketInterval);
    const awakeIdleMs = wakeIntervals
      ? Math.max(
          0,
          measureOverlapMs(wakeIntervals, bucketInterval) -
            directActivityMs -
            agentOnlyMs,
        )
      : 0;

    buckets.push({
      start: new Date(bucketStart),
      end: bucketEnd,
      agentOnlyMs,
      awakeIdleMs,
      directActivityMs,
      engagedMs: measureOverlapMs(metrics.strictEngagementBlocks, bucketInterval),
      peakConcurrentAgents: peakConcurrency(
        metrics.perAgentTaskBlocks.map((taskBlocks) =>
          clipIntervals(taskBlocks, bucketInterval),
        ),
      ),
      practicalBurn: sumTokenBurn(sessions, bucketInterval),
      rawTotalTokens: sumRawTokenDeltas(sessions, bucketInterval),
      sessionCount: countSessionsInBucket(sessions, bucketInterval),
    });
  }

  return buckets;
}

function countSessionsInBucket(
  sessions: ParsedSession[],
  bucketInterval: TimeInterval,
): number {
  return sessions.filter((session) =>
    session.eventTimestamps.some(
      (timestamp) =>
        timestamp.getTime() >= bucketInterval.start.getTime() &&
        timestamp.getTime() < bucketInterval.end.getTime(),
    ),
  ).length;
}

function sumTokenBurn(
  sessions: ParsedSession[],
  bucketInterval: TimeInterval,
): number {
  return sessions.reduce((totalPracticalBurn, session) => {
    const bucketBurn = buildTokenDeltaPoints(session.tokenPoints)
      .filter(
        (tokenDeltaPoint) =>
          tokenDeltaPoint.timestamp.getTime() >= bucketInterval.start.getTime() &&
          tokenDeltaPoint.timestamp.getTime() < bucketInterval.end.getTime(),
      )
      .reduce(
        (bucketTotal, tokenDeltaPoint) =>
          bucketTotal + tokenDeltaPoint.deltaUsage.practicalBurn,
        0,
      );

    return totalPracticalBurn + bucketBurn;
  }, 0);
}

function sumRawTokenDeltas(
  sessions: ParsedSession[],
  bucketInterval: TimeInterval,
): number {
  return sessions.reduce((rawTokenTotal, session) => {
    const bucketRawTokens = buildTokenDeltaPoints(session.tokenPoints)
      .filter(
        (tokenDeltaPoint) =>
          tokenDeltaPoint.timestamp.getTime() >= bucketInterval.start.getTime() &&
          tokenDeltaPoint.timestamp.getTime() < bucketInterval.end.getTime(),
      )
      .reduce(
        (bucketTotal, tokenDeltaPoint) =>
          bucketTotal + tokenDeltaPoint.deltaUsage.totalTokens,
        0,
      );

    return rawTokenTotal + bucketRawTokens;
  }, 0);
}

function clipIntervals(
  intervals: TimeInterval[],
  targetInterval: TimeInterval,
): TimeInterval[] {
  return intervals.flatMap((interval) => {
    const clippedStart = new Date(
      Math.max(interval.start.getTime(), targetInterval.start.getTime()),
    );
    const clippedEnd = new Date(
      Math.min(interval.end.getTime(), targetInterval.end.getTime()),
    );

    if (clippedStart.getTime() >= clippedEnd.getTime()) {
      return [];
    }

    return [{ start: clippedStart, end: clippedEnd }];
  });
}

function startOfHour(timestamp: Date): Date {
  return new Date(
    timestamp.getFullYear(),
    timestamp.getMonth(),
    timestamp.getDate(),
    timestamp.getHours(),
    0,
    0,
    0,
  );
}

import type { ParsedSession } from "../codex-session-log/types.ts";
import { buildTokenDeltaPoints } from "../codex-session-log/extract-token-points.ts";
import { buildActivityMetrics } from "../reporting/activity-metrics.ts";
import type { TimeInterval } from "../reporting/types.ts";
import {
  findBestRollingWindowOverlap,
  findBestRollingWindowTotal,
} from "./build-rolling-24h-windows.ts";
import type { BestMetricCandidates, BestMetricRecord } from "./types.ts";
import { defaultBestMetricsIdleCutoffMs } from "./types.ts";

type BuildBestMetricCandidatesOptions = {
  idleCutoffMs?: number;
};

type ConcurrencyEdge = {
  delta: number;
  timestampMs: number;
};

export function buildBestMetricCandidates(
  sessions: ParsedSession[],
  options: BuildBestMetricCandidatesOptions = {},
): BestMetricCandidates {
  const idleCutoffMs =
    options.idleCutoffMs ?? defaultBestMetricsIdleCutoffMs;
  const activityMetrics = buildActivityMetrics(sessions, idleCutoffMs);

  return {
    bestConcurrentAgents: findBestConcurrentAgents(
      activityMetrics.perSubagentBlocks,
    ),
    best24hRawBurn: findBestRollingWindowTotal(
      sessions.flatMap((session) =>
        buildTokenDeltaPoints(session.tokenPoints).map((tokenDeltaPoint) => ({
          timestamp: tokenDeltaPoint.timestamp,
          value: tokenDeltaPoint.deltaUsage.totalTokens,
        }))
      ),
    ),
    best24hAgentSumMs: findBestRollingWindowOverlap(
      activityMetrics.perSubagentBlocks.flatMap((sessionBlocks) => sessionBlocks),
    ),
  };
}

function findBestConcurrentAgents(
  intervalGroups: TimeInterval[][],
): BestMetricRecord | null {
  const concurrencyEdges = intervalGroups.flatMap((intervalGroup) =>
    intervalGroup.flatMap((interval) => [
      { timestampMs: interval.start.getTime(), delta: 1 },
      { timestampMs: interval.end.getTime(), delta: -1 },
    ])
  );
  if (concurrencyEdges.length === 0) {
    return null;
  }

  concurrencyEdges.sort(
    (leftEdge, rightEdge) => leftEdge.timestampMs - rightEdge.timestampMs,
  );

  let activeCount = 0;
  let bestRecord: BestMetricRecord | null = null;
  let index = 0;

  while (index < concurrencyEdges.length) {
    const timestampMs = concurrencyEdges[index]!.timestampMs;
    while (
      index < concurrencyEdges.length &&
      concurrencyEdges[index]!.timestampMs === timestampMs
    ) {
      activeCount += concurrencyEdges[index]!.delta;
      index += 1;
    }

    const nextTimestampMs = concurrencyEdges[index]?.timestampMs ?? timestampMs;
    if (nextTimestampMs <= timestampMs || activeCount <= 0) {
      continue;
    }

    if (!bestRecord || activeCount > bestRecord.value) {
      bestRecord = {
        value: activeCount,
        observedAt: new Date(timestampMs),
        windowStart: new Date(timestampMs),
        windowEnd: new Date(nextTimestampMs),
      };
    }
  }

  return bestRecord;
}

import type { ParsedSession } from "../codex-session-log/types.ts";
import { buildTokenDeltaPoints } from "../codex-session-log/extract-token-points.ts";
import { buildActivityMetrics } from "../reporting/activity-metrics.ts";
import { measureOverlapMs } from "../reporting/time-interval.ts";
import type { CurrentBestMetricValues, BestMetricKey } from "./types.ts";
import {
  defaultBestMetricsIdleCutoffMs,
  rollingWindowDurationMs,
} from "./types.ts";

type BuildCurrentBestMetricsOptions = {
  idleCutoffMs?: number;
  now?: Date;
};

export function buildCurrentBestMetricValues(
  sessions: ParsedSession[],
  options: BuildCurrentBestMetricsOptions = {},
): CurrentBestMetricValues {
  const idleCutoffMs =
    options.idleCutoffMs ?? defaultBestMetricsIdleCutoffMs;
  const now = options.now ?? new Date();
  const activityMetrics = buildActivityMetrics(sessions, idleCutoffMs);
  const currentWindow = {
    start: new Date(now.getTime() - rollingWindowDurationMs),
    end: now,
  };

  return {
    bestConcurrentAgents: countLiveSubagents(
      activityMetrics.perSubagentBlocks,
      now,
    ),
    best24hRawBurn: sessions.reduce(
      (rawBurnTotal, session) =>
        rawBurnTotal +
        buildTokenDeltaPoints(session.tokenPoints)
          .filter(
            (tokenDeltaPoint) =>
              tokenDeltaPoint.timestamp.getTime() >= currentWindow.start.getTime() &&
              tokenDeltaPoint.timestamp.getTime() <= currentWindow.end.getTime(),
          )
          .reduce(
            (sessionTotal, tokenDeltaPoint) =>
              sessionTotal + tokenDeltaPoint.deltaUsage.totalTokens,
            0,
          ),
      0,
    ),
    best24hAgentSumMs: measureOverlapMs(
      activityMetrics.perSubagentBlocks.flatMap((sessionBlocks) => sessionBlocks),
      currentWindow,
    ),
  };
}

function countLiveSubagents(
  intervalGroups: Array<Array<{ start: Date; end: Date }>>,
  now: Date,
): number {
  return intervalGroups.reduce(
    (liveCount, intervalGroup) =>
      liveCount +
      Number(
        intervalGroup.some(
          (interval) =>
            interval.start.getTime() <= now.getTime() &&
            interval.end.getTime() > now.getTime(),
        ),
      ),
    0,
  );
}

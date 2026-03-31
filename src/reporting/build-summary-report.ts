import type { ParsedSession } from "../codex-session-log/types.ts";
import { buildTokenDeltaPoints } from "../codex-session-log/extract-token-points.ts";
import { parseDurationToMs } from "../report-window/parse-duration.ts";
import { buildActivityMetrics } from "./activity-metrics.ts";
import { filterSessions, groupSessions } from "./filter-sessions.ts";
import {
  intersectTimeIntervals,
  peakConcurrency,
  sumTimeIntervalsMs,
} from "./time-interval.ts";
import { summarizeWakeWindow } from "./wake-window.ts";
import type {
  ActivityMetrics,
  SummaryBreakdown,
  SummaryBreakdownRow,
  SummaryReport,
  SummaryReportQuery,
  TimeInterval,
  TokenTotals,
} from "./types.ts";

export function buildSummaryReport(
  sessions: ParsedSession[],
  query: SummaryReportQuery,
): SummaryReport {
  const filteredSessions = filterSessions(sessions, query.filters);
  const windowInterval = {
    start: query.window.start,
    end: query.window.end,
  };
  const metrics = clipActivityMetricsToWindow(
    buildActivityMetrics(filteredSessions, query.idleCutoffMs, query.window.end),
    windowInterval,
  );
  const comparisonCutoffMs = parseDurationToMs("30m");
  const sessionCounts = {
    total: filteredSessions.length,
    direct: filteredSessions.filter((session) => session.kind === "direct").length,
    subagent: filteredSessions.filter((session) => session.kind === "subagent").length,
  };

  return {
    activityWindow: resolveActivityWindow(filteredSessions, windowInterval),
    appliedFilters: query.filters,
    comparisonCutoffMs,
    comparisonMetrics:
      query.idleCutoffMs === comparisonCutoffMs
        ? metrics
        : clipActivityMetricsToWindow(
            buildActivityMetrics(
              filteredSessions,
              comparisonCutoffMs,
              query.window.end,
            ),
            windowInterval,
          ),
    codexLimitReport: query.codexLimitReport ?? null,
    directTokenTotals: sumTokenTotals(
      filteredSessions.filter((session) => session.kind === "direct"),
      windowInterval,
    ),
    groupBreakdowns: buildGroupBreakdowns(
      filteredSessions,
      query.groupBy,
      query.idleCutoffMs,
      windowInterval,
    ),
    idleCutoffMs: query.idleCutoffMs,
    metrics,
    sessionReadWarnings: query.sessionReadWarnings ?? [],
    sessionCounts,
    tokenTotals: sumTokenTotals(filteredSessions, windowInterval),
    wakeSummary: query.wakeWindow
      ? summarizeWakeWindow(query.wakeWindow, query.window, metrics)
      : null,
    window: query.window,
  };
}

function buildGroupBreakdowns(
  sessions: ParsedSession[],
  dimensions: SummaryReportQuery["groupBy"],
  idleCutoffMs: number,
  windowInterval: TimeInterval,
): SummaryBreakdown[] {
  return dimensions.map((dimension) => ({
    dimension,
    rows: groupSessions(sessions, dimension).map((groupedSessions) =>
      buildGroupRow(
        groupedSessions.key,
        groupedSessions.sessions,
        idleCutoffMs,
        windowInterval,
        windowInterval.end,
      ),
    ),
  }));
}

function buildGroupRow(
  key: string,
  sessions: ParsedSession[],
  idleCutoffMs: number,
  windowInterval: TimeInterval,
  observedAt: Date,
): SummaryBreakdownRow {
  const metrics = clipActivityMetricsToWindow(
    buildActivityMetrics(sessions, idleCutoffMs, observedAt),
    windowInterval,
  );
  const tokenTotals = sumTokenTotals(sessions, windowInterval);

  return {
    key,
    sessionCount: sessions.length,
    directActivityMs: metrics.directActivityMs,
    agentCoverageMs: metrics.agentCoverageMs,
    cumulativeAgentMs: metrics.cumulativeAgentMs,
    practicalBurn: tokenTotals.practicalBurn,
    rawTotalTokens: tokenTotals.rawTotalTokens,
  };
}

function sumTokenTotals(
  sessions: ParsedSession[],
  windowInterval: TimeInterval,
): TokenTotals {
  return sessions.reduce(
    (tokenTotals, session) => {
      const sessionWindowTotals = buildTokenDeltaPoints(session.tokenPoints)
        .filter(
          (tokenDeltaPoint) =>
            tokenDeltaPoint.timestamp.getTime() >= windowInterval.start.getTime() &&
            tokenDeltaPoint.timestamp.getTime() <= windowInterval.end.getTime(),
        )
        .reduce(
          (sessionTotals, tokenDeltaPoint) => ({
            practicalBurn:
              sessionTotals.practicalBurn +
              tokenDeltaPoint.deltaUsage.practicalBurn,
            rawTotalTokens:
              sessionTotals.rawTotalTokens +
              tokenDeltaPoint.deltaUsage.totalTokens,
          }),
          { practicalBurn: 0, rawTotalTokens: 0 },
        );

      return {
        practicalBurn:
          tokenTotals.practicalBurn + sessionWindowTotals.practicalBurn,
        rawTotalTokens:
          tokenTotals.rawTotalTokens + sessionWindowTotals.rawTotalTokens,
      };
    },
    {
      practicalBurn: 0,
      rawTotalTokens: 0,
    },
  );
}

function resolveActivityWindow(
  sessions: ParsedSession[],
  windowInterval: TimeInterval,
): TimeInterval | null {
  if (sessions.length === 0) {
    return null;
  }

  const firstTimestamp = sessions.reduce(
    (earliestTimestamp, session) =>
      session.firstTimestamp.getTime() < earliestTimestamp.getTime()
        ? session.firstTimestamp
        : earliestTimestamp,
    sessions[0]!.firstTimestamp,
  );
  const lastTimestamp = sessions.reduce(
    (latestTimestamp, session) =>
      session.lastTimestamp.getTime() > latestTimestamp.getTime()
        ? session.lastTimestamp
        : latestTimestamp,
    sessions[0]!.lastTimestamp,
  );

  return {
    start: new Date(
      Math.max(firstTimestamp.getTime(), windowInterval.start.getTime()),
    ),
    end: new Date(
      Math.min(lastTimestamp.getTime(), windowInterval.end.getTime()),
    ),
  };
}

function clipActivityMetricsToWindow(
  metrics: ActivityMetrics,
  windowInterval: TimeInterval,
): ActivityMetrics {
  const strictEngagementBlocks = intersectTimeIntervals(
    metrics.strictEngagementBlocks,
    [windowInterval],
  );
  const directActivityBlocks = intersectTimeIntervals(
    metrics.directActivityBlocks,
    [windowInterval],
  );
  const agentCoverageBlocks = intersectTimeIntervals(
    metrics.agentCoverageBlocks,
    [windowInterval],
  );
  const agentOnlyBlocks = intersectTimeIntervals(
    metrics.agentOnlyBlocks,
    [windowInterval],
  );
  const perAgentTaskBlocks = metrics.perAgentTaskBlocks.map((taskBlocks) =>
    intersectTimeIntervals(taskBlocks, [windowInterval]),
  );

  return {
    strictEngagementBlocks,
    directActivityBlocks,
    agentCoverageBlocks,
    agentOnlyBlocks,
    perAgentTaskBlocks,
    strictEngagementMs: sumTimeIntervalsMs(strictEngagementBlocks),
    directActivityMs: sumTimeIntervalsMs(directActivityBlocks),
    agentCoverageMs: sumTimeIntervalsMs(agentCoverageBlocks),
    agentOnlyMs: sumTimeIntervalsMs(agentOnlyBlocks),
    cumulativeAgentMs: perAgentTaskBlocks.reduce(
      (totalDurationMs, taskBlocks) =>
        totalDurationMs + sumTimeIntervalsMs(taskBlocks),
      0,
    ),
    peakConcurrentAgents: peakConcurrency(perAgentTaskBlocks),
  };
}

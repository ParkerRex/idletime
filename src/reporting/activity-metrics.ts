import type { ParsedSession } from "../codex-session-log/types.ts";
import { buildActivityBlocks } from "./build-activity-blocks.ts";
import { peakConcurrency, subtractTimeIntervals, sumTimeIntervalsMs } from "./time-interval.ts";
import type { ActivityMetrics } from "./types.ts";

export function buildActivityMetrics(
  sessions: ParsedSession[],
  idleCutoffMs: number,
): ActivityMetrics {
  const directSessions = sessions.filter((session) => session.kind === "direct");
  const subagentSessions = sessions.filter((session) => session.kind === "subagent");
  const strictEngagementBlocks = buildActivityBlocks(
    directSessions.flatMap((session) => session.userMessageTimestamps),
    idleCutoffMs,
  );
  const directActivityBlocks = buildActivityBlocks(
    directSessions.flatMap((session) => session.eventTimestamps),
    idleCutoffMs,
  );
  const perSubagentBlocks = subagentSessions.map((session) =>
    buildActivityBlocks(session.eventTimestamps, idleCutoffMs),
  );
  const agentCoverageBlocks = buildActivityBlocks(
    subagentSessions.flatMap((session) => session.eventTimestamps),
    idleCutoffMs,
  );
  const agentOnlyBlocks = subtractTimeIntervals(
    agentCoverageBlocks,
    directActivityBlocks,
  );

  return {
    strictEngagementBlocks,
    directActivityBlocks,
    agentCoverageBlocks,
    agentOnlyBlocks,
    perSubagentBlocks,
    strictEngagementMs: sumTimeIntervalsMs(strictEngagementBlocks),
    directActivityMs: sumTimeIntervalsMs(directActivityBlocks),
    agentCoverageMs: sumTimeIntervalsMs(agentCoverageBlocks),
    agentOnlyMs: sumTimeIntervalsMs(agentOnlyBlocks),
    cumulativeAgentMs: perSubagentBlocks.reduce(
      (totalDurationMs, sessionBlocks) =>
        totalDurationMs + sumTimeIntervalsMs(sessionBlocks),
      0,
    ),
    peakConcurrentAgents: peakConcurrency(perSubagentBlocks),
  };
}

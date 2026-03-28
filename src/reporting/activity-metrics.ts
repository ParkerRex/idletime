import type { ParsedSession } from "../codex-session-log/types.ts";
import { buildTaskWindowInterval } from "../codex-session-log/task-windows.ts";
import { buildActivityBlocks } from "./build-activity-blocks.ts";
import {
  mergeTimeIntervals,
  peakConcurrency,
  subtractTimeIntervals,
  sumTimeIntervalsMs,
} from "./time-interval.ts";
import type { ActivityMetrics } from "./types.ts";

export function buildActivityMetrics(
  sessions: ParsedSession[],
  idleCutoffMs: number,
  observedAt: Date = new Date(),
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
  const perAgentTaskBlocks = subagentSessions.map((session) =>
    session.taskWindows.length > 0
      ? session.taskWindows.flatMap((taskWindow) => {
          const taskWindowInterval = buildTaskWindowInterval(
            taskWindow,
            observedAt,
          );
          return taskWindowInterval ? [taskWindowInterval] : [];
        })
      : buildActivityBlocks(session.eventTimestamps, idleCutoffMs),
  );
  const agentCoverageBlocks = mergeTimeIntervals(perAgentTaskBlocks.flat());
  const agentOnlyBlocks = subtractTimeIntervals(
    agentCoverageBlocks,
    directActivityBlocks,
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

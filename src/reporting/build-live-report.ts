import type {
  ParsedSession,
  ProtocolTaskWindow,
  SessionReadWarning,
} from "../codex-session-log/types.ts";
import {
  buildTaskWindowInterval,
  isTaskWindowCompletedBetween,
  isTaskWindowRunning,
} from "../codex-session-log/task-windows.ts";
import { filterSessions } from "./filter-sessions.ts";
import { peakConcurrency } from "./time-interval.ts";
import type { LiveReport, SessionFilters } from "./types.ts";

const doneRecentWindowMs = 15 * 60_000;
const directSessionWarmMs = 15 * 60_000;
const recentConcurrencyBucketCount = 15;
const recentConcurrencyBucketMs = 60_000;
const waitingOnUserWarmMs = 30 * 60_000;

type BuildLiveReportQuery = {
  filters: SessionFilters;
  observedAt?: Date;
  sessionReadWarnings?: SessionReadWarning[];
};

type WaitingOnUserThread = {
  cwd: string;
  sessionId: string;
  waitDurationMs: number;
  waitingSince: Date;
};

export function buildLiveReport(
  sessions: ParsedSession[],
  query: BuildLiveReportQuery,
): LiveReport {
  const observedAt = query.observedAt ?? new Date();
  const appliedFilters = { ...query.filters };
  const filteredSessions = filterSessions(sessions, appliedFilters);
  const liveTaskWindows = filteredSessions.flatMap((session) => session.taskWindows);
  const runningTaskWindows = liveTaskWindows.filter((taskWindow) =>
    isTaskWindowRunning(taskWindow, observedAt),
  );
  const waitingOnUserThreads = resolveWaitingOnUserThreads(
    filteredSessions,
    observedAt,
  );
  const childTaskWindows = filteredSessions
    .filter((session) => session.kind === "subagent")
    .flatMap((session) => session.taskWindows);
  const recentWindowStart = new Date(observedAt.getTime() - doneRecentWindowMs);

  return {
    appliedFilters,
    doneRecentCount: liveTaskWindows.filter((taskWindow) =>
      isTaskWindowCompletedBetween(taskWindow, recentWindowStart, observedAt),
    ).length,
    doneRecentWindowMs,
    doneThisTurnCount: countDoneThisTurn(
      filteredSessions,
      childTaskWindows,
      observedAt,
    ),
    observedAt,
    peakTodayCount: peakConcurrency([
      collectTaskIntervalsForWindow(
        liveTaskWindows,
        observedAt,
        startOfLocalDay(observedAt),
        observedAt,
      ),
    ]),
    recentConcurrencyValues: buildRecentConcurrencyValues(
      liveTaskWindows,
      observedAt,
    ),
    runningCount: runningTaskWindows.length,
    runningLocations: buildRunningLocations(runningTaskWindows),
    sessionReadWarnings: query.sessionReadWarnings ?? [],
    waitingThreads: waitingOnUserThreads,
    waitingOnUserCount: waitingOnUserThreads.length,
    waitingOnUserLocations: buildWaitingOnUserLocations(waitingOnUserThreads),
    scope: appliedFilters.workspaceOnlyPrefix ? "workspace" : "global",
    workspacePrefix: appliedFilters.workspaceOnlyPrefix,
  };
}

function buildRunningLocations(
  runningTaskWindows: ProtocolTaskWindow[],
): Array<{ cwd: string; runningCount: number }> {
  const runningLocations = new Map<string, number>();

  for (const taskWindow of runningTaskWindows) {
    runningLocations.set(
      taskWindow.cwd,
      (runningLocations.get(taskWindow.cwd) ?? 0) + 1,
    );
  }

  return [...runningLocations.entries()]
    .map(([cwd, runningCount]) => ({ cwd, runningCount }))
    .sort(
      (leftLocation, rightLocation) =>
        rightLocation.runningCount - leftLocation.runningCount ||
        leftLocation.cwd.localeCompare(rightLocation.cwd),
    );
}

function buildWaitingOnUserLocations(
  waitingOnUserThreads: WaitingOnUserThread[],
): Array<{ cwd: string; waitingCount: number }> {
  const waitingLocations = new Map<string, number>();

  for (const waitingThread of waitingOnUserThreads) {
    waitingLocations.set(
      waitingThread.cwd,
      (waitingLocations.get(waitingThread.cwd) ?? 0) + 1,
    );
  }

  return [...waitingLocations.entries()]
    .map(([cwd, waitingCount]) => ({ cwd, waitingCount }))
    .sort(
      (leftLocation, rightLocation) =>
        rightLocation.waitingCount - leftLocation.waitingCount ||
        leftLocation.cwd.localeCompare(rightLocation.cwd),
    );
}

function buildRecentConcurrencyValues(
  taskWindows: ProtocolTaskWindow[],
  observedAt: Date,
): number[] {
  const values: number[] = [];

  for (
    let bucketIndex = recentConcurrencyBucketCount - 1;
    bucketIndex >= 0;
    bucketIndex -= 1
  ) {
    const bucketStart = new Date(
      observedAt.getTime() -
        (bucketIndex + 1) * recentConcurrencyBucketMs,
    );
    const bucketEnd = new Date(
      bucketStart.getTime() + recentConcurrencyBucketMs,
    );
    values.push(
      peakConcurrency([
        collectTaskIntervalsForWindow(taskWindows, observedAt, bucketStart, bucketEnd),
      ]),
    );
  }

  return values;
}

function collectTaskIntervalsForWindow(
  taskWindows: ProtocolTaskWindow[],
  observedAt: Date,
  windowStart: Date,
  windowEnd: Date,
): Array<{ start: Date; end: Date }> {
  return taskWindows.flatMap((taskWindow) => {
    const taskWindowInterval = buildTaskWindowInterval(taskWindow, observedAt);
    if (!taskWindowInterval) {
      return [];
    }

    const clippedStart = new Date(
      Math.max(taskWindowInterval.start.getTime(), windowStart.getTime()),
    );
    const clippedEnd = new Date(
      Math.min(taskWindowInterval.end.getTime(), windowEnd.getTime()),
    );

    if (clippedStart.getTime() >= clippedEnd.getTime()) {
      return [];
    }

    return [{ start: clippedStart, end: clippedEnd }];
  });
}

function countDoneThisTurn(
  sessions: ParsedSession[],
  subagentTaskWindows: ProtocolTaskWindow[],
  observedAt: Date,
): number {
  const rootTurnAnchor = resolveRootTurnAnchor(sessions, observedAt);
  if (!rootTurnAnchor) {
    return 0;
  }

  return subagentTaskWindows.filter((taskWindow) => {
    if (
      taskWindow.parentSessionId !== rootTurnAnchor.sessionId ||
      !taskWindow.completedAt
    ) {
      return false;
    }

    return (
      taskWindow.completedAt.getTime() > rootTurnAnchor.startedAt.getTime() &&
      taskWindow.completedAt.getTime() <= observedAt.getTime()
    );
  }).length;
}

function resolveRootTurnAnchor(
  sessions: ParsedSession[],
  observedAt: Date,
): { sessionId: string; startedAt: Date } | null {
  const warmCutoff = observedAt.getTime() - directSessionWarmMs;
  const warmDirectSessions = sessions
    .filter((session) => session.kind === "direct")
    .filter((session) => session.lastTimestamp.getTime() >= warmCutoff)
    .filter((session) => session.userMessageTimestamps.length > 0);

  if (warmDirectSessions.length === 0) {
    return null;
  }

  const activeRootSession = warmDirectSessions.reduce((latestSession, session) =>
    session.lastTimestamp.getTime() > latestSession.lastTimestamp.getTime()
      ? session
      : latestSession,
  );
  const latestUserMessageTimestamp =
    activeRootSession.userMessageTimestamps[
      activeRootSession.userMessageTimestamps.length - 1
    ] ?? null;

  if (!latestUserMessageTimestamp) {
    return null;
  }

  return {
    sessionId: activeRootSession.sessionId,
    startedAt: latestUserMessageTimestamp,
  };
}

function resolveWaitingOnUserThreads(
  sessions: ParsedSession[],
  observedAt: Date,
): WaitingOnUserThread[] {
  const warmCutoff = observedAt.getTime() - waitingOnUserWarmMs;

  return sessions.flatMap((session) => {
    if (session.kind !== "direct" || session.taskWindows.length === 0) {
      return [];
    }

    const latestTaskWindow = session.taskWindows.reduce((latestWindow, taskWindow) =>
      taskWindow.startedAt.getTime() > latestWindow.startedAt.getTime()
        ? taskWindow
        : latestWindow,
    );
    const latestUserMessageTimestamp =
      session.userMessageTimestamps[session.userMessageTimestamps.length - 1] ?? null;

    if (
      latestTaskWindow.completedAt === null ||
      !latestUserMessageTimestamp ||
      latestTaskWindow.completedAt.getTime() <= latestUserMessageTimestamp.getTime()
    ) {
      return [];
    }

    if (latestTaskWindow.completedAt.getTime() < warmCutoff) {
      return [];
    }

    return [
      {
        cwd: session.cwd,
        sessionId: session.sessionId,
        waitDurationMs:
          observedAt.getTime() - latestTaskWindow.completedAt.getTime(),
        waitingSince: latestTaskWindow.completedAt,
      },
    ];
  }).sort(
    (leftThread, rightThread) =>
      rightThread.waitDurationMs - leftThread.waitDurationMs ||
      leftThread.waitingSince.getTime() - rightThread.waitingSince.getTime(),
  );
}

function startOfLocalDay(timestamp: Date): Date {
  return new Date(
    timestamp.getFullYear(),
    timestamp.getMonth(),
    timestamp.getDate(),
    0,
    0,
    0,
    0,
  );
}

import {
  expectObject,
  readOptionalString,
  readString,
} from "./codex-log-values.ts";
import type { CodexLogLine } from "./codex-log-line.ts";
import type { ProtocolTaskWindow, SessionKind } from "./types.ts";

const defaultTaskWindowStaleAfterMs = 5 * 60_000;
const standardTaskWindowStaleAfterMs = 2 * 60_000;

type ExtractTaskWindowsOptions = {
  cwd: string;
  parentSessionId: string | null;
  sessionId: string;
  sessionKind: SessionKind;
};

type TaskWindowBuilder = {
  completedAt: Date | null;
  cwd: string;
  lastActivityAt: Date;
  model: string | null;
  reasoningEffort: string | null;
  startedAt: Date;
  turnId: string;
};

type TurnContextSnapshot = {
  cwd: string;
  model: string | null;
  reasoningEffort: string | null;
};

export function extractTaskWindows(
  records: CodexLogLine[],
  options: ExtractTaskWindowsOptions,
): ProtocolTaskWindow[] {
  const turnContexts = new Map<string, TurnContextSnapshot>();
  const activeTaskWindows = new Map<string, TaskWindowBuilder>();
  const orderedTaskWindows: TaskWindowBuilder[] = [];
  let currentTurnId: string | null = null;

  for (const record of records) {
    if (record.type === "session_meta") {
      continue;
    }

    if (record.type === "turn_context") {
      const payload = expectObject(record.payload, "turn_context.payload");
      const turnId = readString(payload, "turn_id", "turn_context.payload");
      const turnContext = {
        cwd: readString(payload, "cwd", "turn_context.payload"),
        model: readOptionalString(payload, "model"),
        reasoningEffort: readOptionalString(payload, "effort"),
      };

      turnContexts.set(turnId, turnContext);
      const activeTaskWindow = activeTaskWindows.get(turnId);
      if (activeTaskWindow) {
        activeTaskWindow.cwd = turnContext.cwd;
        activeTaskWindow.model = turnContext.model;
        activeTaskWindow.reasoningEffort = turnContext.reasoningEffort;
        activeTaskWindow.lastActivityAt = record.timestamp;
        currentTurnId = turnId;
      }
      continue;
    }

    if (record.type !== "event_msg") {
      touchCurrentTaskWindow(activeTaskWindows, currentTurnId, record.timestamp);
      continue;
    }

    const payload = expectObject(record.payload, "event_msg.payload");
    const eventType = readOptionalString(payload, "type");

    if (eventType === "task_started") {
      const turnId = readString(payload, "turn_id", "event_msg.payload");
      const turnContext = turnContexts.get(turnId);
      const taskWindow: TaskWindowBuilder = {
        completedAt: null,
        cwd: turnContext?.cwd ?? options.cwd,
        lastActivityAt: record.timestamp,
        model: turnContext?.model ?? null,
        reasoningEffort: turnContext?.reasoningEffort ?? null,
        startedAt: record.timestamp,
        turnId,
      };

      activeTaskWindows.set(turnId, taskWindow);
      orderedTaskWindows.push(taskWindow);
      currentTurnId = turnId;
      continue;
    }

    if (eventType === "task_complete") {
      const turnId = readString(payload, "turn_id", "event_msg.payload");
      const activeTaskWindow =
        activeTaskWindows.get(turnId) ??
        createFallbackTaskWindow(record.timestamp, turnId, turnContexts.get(turnId), options.cwd);

      if (!activeTaskWindows.has(turnId)) {
        orderedTaskWindows.push(activeTaskWindow);
      }

      activeTaskWindow.lastActivityAt = record.timestamp;
      activeTaskWindow.completedAt = record.timestamp;
      activeTaskWindows.delete(turnId);
      currentTurnId = currentTurnId === turnId ? null : currentTurnId;
      continue;
    }

    const eventTurnId = readOptionalString(payload, "turn_id");
    if (eventTurnId && activeTaskWindows.has(eventTurnId)) {
      touchCurrentTaskWindow(activeTaskWindows, eventTurnId, record.timestamp);
      currentTurnId = eventTurnId;
      continue;
    }

    touchCurrentTaskWindow(activeTaskWindows, currentTurnId, record.timestamp);
  }

  return orderedTaskWindows.map((taskWindow, taskWindowIndex) => ({
    taskId: `${options.sessionId}:${taskWindow.turnId}:${taskWindowIndex}`,
    sessionId: options.sessionId,
    parentSessionId: options.parentSessionId,
    sessionKind: options.sessionKind,
    cwd: taskWindow.cwd,
    turnId: taskWindow.turnId,
    model: taskWindow.model,
    reasoningEffort: taskWindow.reasoningEffort,
    startedAt: taskWindow.startedAt,
    lastActivityAt: taskWindow.lastActivityAt,
    completedAt: taskWindow.completedAt,
    staleAfterMs: resolveTaskWindowStaleAfterMs(taskWindow.reasoningEffort),
  }));
}

export function buildTaskWindowInterval(
  taskWindow: ProtocolTaskWindow,
  observedAt: Date,
): { start: Date; end: Date } | null {
  const intervalEnd = resolveTaskWindowEnd(taskWindow, observedAt);
  if (intervalEnd.getTime() <= taskWindow.startedAt.getTime()) {
    return null;
  }

  return {
    start: taskWindow.startedAt,
    end: intervalEnd,
  };
}

export function isTaskWindowRunning(
  taskWindow: ProtocolTaskWindow,
  observedAt: Date,
): boolean {
  return (
    taskWindow.completedAt === null &&
    taskWindow.lastActivityAt.getTime() + taskWindow.staleAfterMs >
      observedAt.getTime()
  );
}

export function isTaskWindowCompletedBetween(
  taskWindow: ProtocolTaskWindow,
  windowStart: Date,
  windowEnd: Date,
): boolean {
  if (!taskWindow.completedAt) {
    return false;
  }

  return (
    taskWindow.completedAt.getTime() > windowStart.getTime() &&
    taskWindow.completedAt.getTime() <= windowEnd.getTime()
  );
}

export function resolveTaskWindowEnd(
  taskWindow: ProtocolTaskWindow,
  observedAt: Date,
): Date {
  if (taskWindow.completedAt) {
    return taskWindow.completedAt;
  }

  const staleDeadline = new Date(
    taskWindow.lastActivityAt.getTime() + taskWindow.staleAfterMs,
  );

  return staleDeadline.getTime() < observedAt.getTime()
    ? staleDeadline
    : observedAt;
}

export function resolveTaskWindowStaleAfterMs(
  reasoningEffort: string | null,
): number {
  return reasoningEffort === "medium" || reasoningEffort === "high"
    ? standardTaskWindowStaleAfterMs
    : defaultTaskWindowStaleAfterMs;
}

function createFallbackTaskWindow(
  timestamp: Date,
  turnId: string,
  turnContext: TurnContextSnapshot | undefined,
  defaultCwd: string,
): TaskWindowBuilder {
  return {
    completedAt: null,
    cwd: turnContext?.cwd ?? defaultCwd,
    lastActivityAt: timestamp,
    model: turnContext?.model ?? null,
    reasoningEffort: turnContext?.reasoningEffort ?? null,
    startedAt: timestamp,
    turnId,
  };
}

function touchCurrentTaskWindow(
  activeTaskWindows: Map<string, TaskWindowBuilder>,
  turnId: string | null,
  timestamp: Date,
): void {
  if (!turnId) {
    return;
  }

  const activeTaskWindow = activeTaskWindows.get(turnId);
  if (activeTaskWindow) {
    activeTaskWindow.lastActivityAt = timestamp;
  }
}

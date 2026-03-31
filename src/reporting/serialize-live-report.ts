import type { LiveReport } from "./types.ts";
import {
  jsonReportSchemaVersion,
  type JsonLiveSnapshotCommand,
  type JsonSnapshotBase,
  type SessionFilters,
} from "./types.ts";
import {
  serializeIsoTimestamp,
  serializeSessionFilters,
  serializeSessionReadWarnings,
  stringifyJsonSnapshot,
} from "./serialize-json-common.ts";

export type SerializedLiveReportV1 = {
  appliedFilters: SessionFilters;
  doneRecentCount: number;
  doneRecentWindowMs: number;
  doneThisTurnCount: number;
  observedAt: string;
  peakTodayCount: number;
  recentConcurrencyValues: number[];
  runningCount: number;
  runningLocations: Array<{
    cwd: string;
    runningCount: number;
  }>;
  sessionReadWarnings: LiveReport["sessionReadWarnings"];
  waitingThreads: Array<{
    cwd: string;
    sessionId: string;
    waitDurationMs: number;
  }>;
  waitingOnUserCount: number;
  waitingOnUserLocations: Array<{
    cwd: string;
    waitingCount: number;
  }>;
  scope: LiveReport["scope"];
  workspacePrefix: string | null;
};

export type SerializedLiveSnapshotV1 = JsonSnapshotBase<
  "live",
  JsonLiveSnapshotCommand
> & {
  liveReport: SerializedLiveReportV1;
};

export type SerializeLiveSnapshotInput = {
  generatedAt: Date;
  command: JsonLiveSnapshotCommand;
  liveReport: LiveReport;
};

export function serializeLiveReportPayload(
  liveReport: LiveReport,
): SerializedLiveReportV1 {
  return {
    appliedFilters: serializeSessionFilters(liveReport.appliedFilters),
    doneRecentCount: liveReport.doneRecentCount,
    doneRecentWindowMs: liveReport.doneRecentWindowMs,
    doneThisTurnCount: liveReport.doneThisTurnCount,
    observedAt: serializeIsoTimestamp(liveReport.observedAt),
    peakTodayCount: liveReport.peakTodayCount,
    recentConcurrencyValues: [...liveReport.recentConcurrencyValues],
    runningCount: liveReport.runningCount,
    runningLocations: liveReport.runningLocations.map((location) => ({
      cwd: location.cwd,
      runningCount: location.runningCount,
    })),
    sessionReadWarnings: serializeSessionReadWarnings(
      liveReport.sessionReadWarnings,
    ),
    waitingThreads: liveReport.waitingThreads.map((waitingThread) => ({
      cwd: waitingThread.cwd,
      sessionId: waitingThread.sessionId,
      waitDurationMs: waitingThread.waitDurationMs,
    })),
    waitingOnUserCount: liveReport.waitingOnUserCount,
    waitingOnUserLocations: liveReport.waitingOnUserLocations.map((location) => ({
      cwd: location.cwd,
      waitingCount: location.waitingCount,
    })),
    scope: liveReport.scope,
    workspacePrefix: liveReport.workspacePrefix,
  };
}

export function serializeLiveSnapshot(
  input: SerializeLiveSnapshotInput,
): string {
  const snapshot: SerializedLiveSnapshotV1 = {
    schemaVersion: jsonReportSchemaVersion,
    mode: "live",
    generatedAt: input.generatedAt.toISOString(),
    command: {
      filters: serializeSessionFilters(input.command.filters),
    },
    liveReport: serializeLiveReportPayload(input.liveReport),
  };

  return stringifyJsonSnapshot(snapshot);
}

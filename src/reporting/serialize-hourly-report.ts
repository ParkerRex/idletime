import type { HourlyBucket, HourlyReport } from "./types.ts";
import {
  jsonReportSchemaVersion,
  type JsonHourlySnapshotCommand,
  type JsonSnapshotBase,
  type JsonReportWindow,
  type SessionFilters,
} from "./types.ts";
import {
  serializeReportWindow,
  serializeSessionFilters,
  serializeSessionReadWarnings,
  serializeTimeInterval,
  stringifyJsonSnapshot,
} from "./serialize-json-common.ts";

export type SerializedHourlyBucketV1 = {
  start: string;
  end: string;
  agentOnlyMs: number;
  awakeIdleMs: number;
  directActivityMs: number;
  engagedMs: number;
  peakConcurrentAgents: number;
  practicalBurn: number;
  rawTotalTokens: number;
  sessionCount: number;
};

export type SerializedHourlyReportV1 = {
  appliedFilters: SessionFilters;
  agentConcurrencySource: HourlyReport["agentConcurrencySource"];
  buckets: SerializedHourlyBucketV1[];
  hasWakeWindow: boolean;
  idleCutoffMs: number;
  maxValues: {
    agentOnlyMs: number;
    directActivityMs: number;
    engagedMs: number;
    practicalBurn: number;
  };
  sessionReadWarnings: HourlyReport["sessionReadWarnings"];
  window: JsonReportWindow;
};

export type SerializedHourlySnapshotV1 = JsonSnapshotBase<
  "hourly",
  JsonHourlySnapshotCommand
> & {
  hourlyReport: SerializedHourlyReportV1;
};

export type SerializeHourlySnapshotInput = {
  generatedAt: Date;
  command: JsonHourlySnapshotCommand;
  hourlyReport: HourlyReport;
};

export function serializeHourlyReportPayload(
  hourlyReport: HourlyReport,
): SerializedHourlyReportV1 {
  return {
    appliedFilters: serializeSessionFilters(hourlyReport.appliedFilters),
    agentConcurrencySource: hourlyReport.agentConcurrencySource,
    buckets: hourlyReport.buckets.map(serializeHourlyBucket),
    hasWakeWindow: hourlyReport.hasWakeWindow,
    idleCutoffMs: hourlyReport.idleCutoffMs,
    maxValues: {
      agentOnlyMs: hourlyReport.maxValues.agentOnlyMs,
      directActivityMs: hourlyReport.maxValues.directActivityMs,
      engagedMs: hourlyReport.maxValues.engagedMs,
      practicalBurn: hourlyReport.maxValues.practicalBurn,
    },
    sessionReadWarnings: serializeSessionReadWarnings(
      hourlyReport.sessionReadWarnings,
    ),
    window: serializeReportWindow(hourlyReport.window),
  };
}

export function serializeHourlySnapshot(
  input: SerializeHourlySnapshotInput,
): string {
  const snapshot: SerializedHourlySnapshotV1 = {
    schemaVersion: jsonReportSchemaVersion,
    mode: "hourly",
    generatedAt: input.generatedAt.toISOString(),
    command: {
      idleCutoffMs: input.command.idleCutoffMs,
      filters: serializeSessionFilters(input.command.filters),
      wakeWindow: input.command.wakeWindow
        ? { ...input.command.wakeWindow }
        : null,
    },
    hourlyReport: serializeHourlyReportPayload(input.hourlyReport),
  };

  return stringifyJsonSnapshot(snapshot);
}

function serializeHourlyBucket(
  bucket: HourlyBucket,
): SerializedHourlyBucketV1 {
  return {
    start: serializeTimeInterval({
      start: bucket.start,
      end: bucket.end,
    }).start,
    end: serializeTimeInterval({
      start: bucket.start,
      end: bucket.end,
    }).end,
    agentOnlyMs: bucket.agentOnlyMs,
    awakeIdleMs: bucket.awakeIdleMs,
    directActivityMs: bucket.directActivityMs,
    engagedMs: bucket.engagedMs,
    peakConcurrentAgents: bucket.peakConcurrentAgents,
    practicalBurn: bucket.practicalBurn,
    rawTotalTokens: bucket.rawTotalTokens,
    sessionCount: bucket.sessionCount,
  };
}

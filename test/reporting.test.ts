import { describe, expect, test } from "bun:test";
import type { ParsedSession, TokenPoint, TokenUsage } from "../src/codex-session-log/types.ts";
import { buildHourlyReport } from "../src/reporting/build-hourly-report.ts";
import { buildSummaryReport } from "../src/reporting/build-summary-report.ts";
import { parseDurationToMs } from "../src/report-window/parse-duration.ts";
import { parseWakeWindow } from "../src/reporting/wake-window.ts";

describe("reporting", () => {
  test("builds summary metrics, wake idle, and grouped totals", () => {
    const reportWindow = {
      label: "synthetic-day",
      start: new Date("2026-03-26T08:00:00-04:00"),
      end: new Date("2026-03-26T22:00:00-04:00"),
      timeZone: "America/New_York",
    };
    const report = buildSummaryReport(
      [
        createSession({
          sessionId: "direct-main",
          kind: "direct",
          eventTimes: ["2026-03-26T09:00:00-04:00", "2026-03-26T09:05:00-04:00", "2026-03-26T09:25:00-04:00"],
          userMessageTimes: ["2026-03-26T09:00:00-04:00", "2026-03-26T09:25:00-04:00"],
          tokenPoints: [createTokenPoint("2026-03-26T09:05:00-04:00", createUsage(100, 0, 0, 100))],
          usage: createUsage(220, 0, 0, 220),
          model: "gpt-5.4",
          reasoningEffort: "xhigh",
        }),
        createSession({
          sessionId: "subagent-a",
          kind: "subagent",
          eventTimes: ["2026-03-26T09:10:00-04:00", "2026-03-26T09:40:00-04:00"],
          userMessageTimes: [],
          tokenPoints: [createTokenPoint("2026-03-26T09:45:00-04:00", createUsage(50, 0, 0, 50))],
          usage: createUsage(80, 0, 0, 80),
          model: "gpt-5.4-mini",
          reasoningEffort: "high",
        }),
        createSession({
          sessionId: "subagent-b",
          kind: "subagent",
          eventTimes: ["2026-03-26T09:45:00-04:00"],
          userMessageTimes: [],
          tokenPoints: [],
          usage: createUsage(40, 0, 0, 40),
          model: "gpt-5.4-mini",
          reasoningEffort: "high",
        }),
      ],
      {
        filters: {
          workspaceOnlyPrefix: null,
          sessionKind: null,
          model: null,
          reasoningEffort: null,
        },
        groupBy: ["model"],
        idleCutoffMs: parseDurationToMs("15m"),
        wakeWindow: parseWakeWindow("09:00-10:30"),
        window: reportWindow,
      },
    );

    expect(report.metrics.strictEngagementMs).toBe(30 * 60_000);
    expect(report.metrics.directActivityMs).toBe(35 * 60_000);
    expect(report.metrics.agentCoverageMs).toBe(35 * 60_000);
    expect(report.metrics.agentOnlyMs).toBe(25 * 60_000);
    expect(report.metrics.cumulativeAgentMs).toBe(45 * 60_000);
    expect(report.metrics.peakConcurrentAgents).toBe(2);
    expect(report.tokenTotals.rawTotalTokens).toBe(150);
    expect(report.directTokenTotals.rawTotalTokens).toBe(100);
    expect(report.wakeSummary?.awakeIdleMs).toBe(30 * 60_000);
    expect(report.wakeSummary?.longestIdleGapMs).toBe(30 * 60_000);
    expect(report.groupBreakdowns[0]?.rows.map((row) => row.key)).toEqual([
      "gpt-5.4-mini",
      "gpt-5.4",
    ]);
  });

  test("builds hourly practical burn from token deltas", () => {
    const reportWindow = {
      label: "hourly-window",
      start: new Date("2026-03-26T09:00:00-04:00"),
      end: new Date("2026-03-26T11:00:00-04:00"),
      timeZone: "America/New_York",
    };
    const directSession = createSession({
      sessionId: "direct-burn",
      kind: "direct",
      eventTimes: ["2026-03-26T09:05:00-04:00", "2026-03-26T09:35:00-04:00", "2026-03-26T10:10:00-04:00"],
      userMessageTimes: ["2026-03-26T09:05:00-04:00"],
      tokenPoints: [
        createTokenPoint("2026-03-26T09:05:00-04:00", createUsage(100, 0, 0, 100)),
        createTokenPoint("2026-03-26T09:35:00-04:00", createUsage(160, 0, 0, 160)),
        createTokenPoint("2026-03-26T10:10:00-04:00", createUsage(220, 0, 0, 220)),
      ],
      usage: createUsage(220, 0, 0, 220),
      model: "gpt-5.4",
      reasoningEffort: "medium",
    });
    const hourlyReport = buildHourlyReport([directSession], {
      filters: {
        workspaceOnlyPrefix: null,
        sessionKind: null,
        model: null,
        reasoningEffort: null,
      },
      idleCutoffMs: parseDurationToMs("15m"),
      wakeWindow: null,
      window: reportWindow,
    });

    expect(hourlyReport.buckets).toHaveLength(2);
    expect(hourlyReport.buckets[0]?.practicalBurn).toBe(160);
    expect(hourlyReport.buckets[1]?.practicalBurn).toBe(60);
  });
});

function createSession(input: {
  sessionId: string;
  kind: ParsedSession["kind"];
  eventTimes: string[];
  userMessageTimes: string[];
  tokenPoints: TokenPoint[];
  usage: TokenUsage;
  model: string;
  reasoningEffort: string;
}): ParsedSession {
  const eventTimestamps = input.eventTimes.map((value) => new Date(value));
  return {
    sessionId: input.sessionId,
    sourceFilePath: `${input.sessionId}.jsonl`,
    cwd: "/tmp/codex-fixtures/demo-workspace",
    kind: input.kind,
    forkedFromSessionId: null,
    firstTimestamp: eventTimestamps[0]!,
    lastTimestamp: eventTimestamps[eventTimestamps.length - 1]!,
    eventTimestamps,
    tokenPoints: input.tokenPoints,
    finalTokenUsage: input.usage,
    userMessageTimestamps: input.userMessageTimes.map((value) => new Date(value)),
    turnAttributions: [],
    agentSpawnRequests: [],
    primaryModel: input.model,
    primaryReasoningEffort: input.reasoningEffort,
  };
}

function createTokenPoint(timestamp: string, usage: TokenUsage): TokenPoint {
  return {
    timestamp: new Date(timestamp),
    usage,
  };
}

function createUsage(
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
  totalTokens: number,
): TokenUsage {
  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens: 0,
    totalTokens,
    practicalBurn: inputTokens - cachedInputTokens + outputTokens,
  };
}

import { describe, expect, test } from "bun:test";
import type {
  ParsedSession,
  ProtocolTaskWindow,
  TokenPoint,
  TokenUsage,
} from "../src/codex-session-log/types.ts";
import { buildLiveReport } from "../src/reporting/build-live-report.ts";
import { buildHourlyReport } from "../src/reporting/build-hourly-report.ts";
import { buildSummaryReport } from "../src/reporting/build-summary-report.ts";
import {
  serializeHourlySnapshot,
  type SerializedHourlySnapshotV1,
} from "../src/reporting/serialize-hourly-report.ts";
import {
  serializeLiveSnapshot,
  type SerializedLiveSnapshotV1,
} from "../src/reporting/serialize-live-report.ts";
import {
  serializeSummarySnapshot,
  type SerializedSummarySnapshotV1,
} from "../src/reporting/serialize-summary-report.ts";
import { buildBestPlaque } from "../src/reporting/render-best-plaque.ts";
import { buildAgentSection } from "../src/reporting/render-agent-section.ts";
import { buildLogoSection } from "../src/reporting/render-logo-section.ts";
import { renderLiveReport } from "../src/reporting/render-live-report.ts";
import { buildRhythmSection } from "../src/reporting/render-rhythm-section.ts";
import { renderSummaryReport } from "../src/reporting/render-summary-report.ts";
import type {
  HourlyBucket,
  HourlyReport,
  JsonHourlySnapshotCommand,
  JsonLiveSnapshotCommand,
  JsonSummarySnapshotCommand,
} from "../src/reporting/types.ts";
import { parseDurationToMs } from "../src/report-window/parse-duration.ts";
import { parseWakeWindow } from "../src/reporting/wake-window.ts";
import { bestMetricsLedgerVersion } from "../src/best-metrics/types.ts";

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

  test("ignores cumulative token resets between tasks", () => {
    const reportWindow = {
      label: "reset-window",
      start: new Date("2026-03-26T09:00:00-04:00"),
      end: new Date("2026-03-26T10:00:00-04:00"),
      timeZone: "America/New_York",
    };
    const report = buildSummaryReport(
      [
        createSession({
          sessionId: "direct-reset",
          kind: "direct",
          eventTimes: [
            "2026-03-26T09:05:00-04:00",
            "2026-03-26T09:25:00-04:00",
            "2026-03-26T09:35:00-04:00",
          ],
          userMessageTimes: ["2026-03-26T09:05:00-04:00"],
          tokenPoints: [
            createTokenPoint(
              "2026-03-26T09:05:00-04:00",
              createUsage(100, 0, 0, 100),
              createUsage(100, 0, 0, 100),
            ),
            createTokenPoint(
              "2026-03-26T09:15:00-04:00",
              createUsage(140, 0, 20, 160),
              createUsage(40, 0, 20, 60),
            ),
            createTokenPoint(
              "2026-03-26T09:20:00-04:00",
              createUsage(0, 0, 0, 950000),
              createUsage(0, 0, 0, 0),
            ),
            createTokenPoint(
              "2026-03-26T09:30:00-04:00",
              createUsage(25, 0, 15, 950040),
              createUsage(25, 0, 15, 40),
            ),
          ],
          usage: createUsage(25, 0, 15, 950040),
          model: "gpt-5.4",
          reasoningEffort: "medium",
        }),
      ],
      {
        filters: {
          workspaceOnlyPrefix: null,
          sessionKind: null,
          model: null,
          reasoningEffort: null,
        },
        groupBy: [],
        idleCutoffMs: parseDurationToMs("15m"),
        wakeWindow: null,
        window: reportWindow,
      },
    );

    expect(report.tokenTotals.rawTotalTokens).toBe(200);
    expect(report.tokenTotals.practicalBurn).toBe(200);
  });

  test("builds the idletime wordmark band at panel width", () => {
    const logoLines = buildLogoSection(72, {
      colorEnabled: false,
      shareMode: false,
      terminalWidth: 72,
    });

    expect(logoLines).toHaveLength(5);
    expect(logoLines.every((line) => line.length === 72)).toBe(true);
    expect(logoLines[0]?.trimEnd()).toContain("▄▄ ▄▄");
    expect(logoLines[2]?.trimEnd()).toContain("██  ▄████ ██");
    expect(logoLines[4]?.trimEnd()).toContain("██▄ ▀████ ██");
    expect(logoLines[0]).toMatch(/[░▒▓█]{6,}$/);
  });

  test("renders the BEST plaque inside the logo band at wide and narrow widths", () => {
    const bestPlaque = buildBestPlaque({
      version: bestMetricsLedgerVersion,
      initializedAt: new Date("2026-03-27T20:00:00.000Z"),
      lastScannedAt: new Date("2026-03-27T21:00:00.000Z"),
      bestConcurrentAgents: {
        value: 98,
        observedAt: new Date("2026-03-27T18:00:00.000Z"),
        windowStart: new Date("2026-03-27T18:00:00.000Z"),
        windowEnd: new Date("2026-03-27T18:15:00.000Z"),
      },
      best24hRawBurn: {
        value: 1_800_000_000,
        observedAt: new Date("2026-03-27T18:00:00.000Z"),
        windowStart: new Date("2026-03-26T18:00:00.000Z"),
        windowEnd: new Date("2026-03-27T18:00:00.000Z"),
      },
      best24hAgentSumMs: {
        value: 17 * 3_600_000,
        observedAt: new Date("2026-03-27T18:00:00.000Z"),
        windowStart: new Date("2026-03-26T18:00:00.000Z"),
        windowEnd: new Date("2026-03-27T18:00:00.000Z"),
      },
    });

    const wideLogoLines = buildLogoSection(
      72,
      {
        colorEnabled: false,
        shareMode: false,
        terminalWidth: 72,
      },
      bestPlaque,
    );
    const narrowLogoLines = buildLogoSection(
      60,
      {
        colorEnabled: false,
        shareMode: false,
        terminalWidth: 60,
      },
      bestPlaque,
    );

    expect(wideLogoLines[0]).toContain("BEST");
    expect(wideLogoLines[1]).toContain("98 concurrent agents");
    expect(wideLogoLines[2]).toContain("1.8B 24hr raw burn");
    expect(narrowLogoLines[0]).toContain("BEST");
    expect(narrowLogoLines[1]).toContain("98 concurrent");
    expect(narrowLogoLines[2]).toContain("1.8B raw burn");
  });

  test("renders 24h rhythm with aligned hour groups and single-line lanes", () => {
    const rhythmLines = buildRhythmSection(createRhythmReportFixture(), {
      colorEnabled: false,
      shareMode: false,
      terminalWidth: 80,
    });

    expect(rhythmLines[2]).toBe("  time   8am │12pm│4pm │8pm │12am│4am ");
    expect(rhythmLines.filter((line) => line.includes("quiet")).length).toBe(1);
    expect(rhythmLines.find((line) => line.includes("focus"))).toContain("│");
    expect(rhythmLines.find((line) => line.includes("burn"))).toContain("│");
  });

  test("renders a dedicated agents section with task-window units", () => {
    const agentLines = buildAgentSection(createRhythmReportFixture(), {
      colorEnabled: false,
      shareMode: false,
      terminalWidth: 80,
    });

    expect(agentLines[0]).toContain("Agents");
    expect(agentLines[2]).toContain("8am");
    expect(agentLines[3]).toContain("peak");
    expect(agentLines[4]).toContain("task windows");
  });

  test("renders a narrative header above the rhythm view when hourly data exists", () => {
    const reportWindow = {
      label: "synthetic-day",
      start: new Date("2026-03-26T08:00:00-04:00"),
      end: new Date("2026-03-26T22:00:00-04:00"),
      timeZone: "America/New_York",
    };
    const sessions = [
      createSession({
        sessionId: "direct-main",
        kind: "direct",
        eventTimes: [
          "2026-03-26T09:00:00-04:00",
          "2026-03-26T09:05:00-04:00",
          "2026-03-26T09:25:00-04:00",
        ],
        userMessageTimes: [
          "2026-03-26T09:00:00-04:00",
          "2026-03-26T09:25:00-04:00",
        ],
        tokenPoints: [
          createTokenPoint(
            "2026-03-26T09:05:00-04:00",
            createUsage(100, 0, 0, 100),
          ),
        ],
        usage: createUsage(220, 0, 0, 220),
        model: "gpt-5.4",
        reasoningEffort: "xhigh",
      }),
      createSession({
        sessionId: "subagent-a",
        kind: "subagent",
        eventTimes: [
          "2026-03-26T09:10:00-04:00",
          "2026-03-26T09:40:00-04:00",
        ],
        userMessageTimes: [],
        tokenPoints: [
          createTokenPoint(
            "2026-03-26T09:45:00-04:00",
            createUsage(50, 0, 0, 50),
          ),
        ],
        usage: createUsage(80, 0, 0, 80),
        model: "gpt-5.4-mini",
        reasoningEffort: "high",
      }),
    ];
    const summaryReport = buildSummaryReport(sessions, {
      filters: {
        workspaceOnlyPrefix: null,
        sessionKind: null,
        model: null,
        reasoningEffort: null,
      },
      groupBy: [],
      idleCutoffMs: parseDurationToMs("15m"),
      wakeWindow: null,
      window: reportWindow,
    });
    const hourlyReport = buildHourlyReport(sessions, {
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

    const renderedReport = renderSummaryReport(
      summaryReport,
      {
        colorEnabled: false,
        shareMode: false,
        terminalWidth: 80,
      },
      hourlyReport,
    );

    expect(renderedReport).toContain("focused, 0.5h agent live");
    expect(renderedReport).toContain("Biggest story:");
    expect(renderedReport).toContain("Agents");
    expect(renderedReport).toContain("1 direct / 1 subagent");
  });

  test("builds and renders the live scoreboard from task windows", () => {
    const observedAt = new Date("2026-03-26T09:55:00-04:00");
    const liveReport = buildLiveReport(
      [
        createSession({
          sessionId: "direct-main",
          kind: "direct",
          eventTimes: [
            "2026-03-26T09:40:00-04:00",
            "2026-03-26T09:45:00-04:00",
            "2026-03-26T09:55:00-04:00",
          ],
          userMessageTimes: ["2026-03-26T09:40:00-04:00"],
          tokenPoints: [],
          usage: createUsage(0, 0, 0, 0),
          model: "gpt-5.4",
          reasoningEffort: "high",
          taskWindows: [
            createTaskWindow({
              completedAt: null,
              lastActivityAt: "2026-03-26T09:55:00-04:00",
              parentSessionId: null,
              sessionId: "direct-main",
              startedAt: "2026-03-26T09:40:00-04:00",
              turnId: "turn-direct",
              sessionKind: "direct",
            }),
          ],
        }),
        createSession({
          sessionId: "subagent-running",
          kind: "subagent",
          cwd: "/tmp/codex-fixtures/agent-runner",
          eventTimes: ["2026-03-26T09:42:00-04:00"],
          userMessageTimes: [],
          tokenPoints: [],
          usage: createUsage(0, 0, 0, 0),
          model: "gpt-5.4-mini",
          reasoningEffort: "high",
          taskWindows: [
            createTaskWindow({
              completedAt: null,
              cwd: "/tmp/codex-fixtures/agent-runner",
              lastActivityAt: "2026-03-26T09:54:00-04:00",
              parentSessionId: "direct-main",
              sessionId: "subagent-running",
              startedAt: "2026-03-26T09:42:00-04:00",
              turnId: "turn-running",
            }),
          ],
        }),
        createSession({
          sessionId: "subagent-done",
          kind: "subagent",
          eventTimes: ["2026-03-26T09:43:00-04:00"],
          userMessageTimes: [],
          tokenPoints: [],
          usage: createUsage(0, 0, 0, 0),
          model: "gpt-5.4-mini",
          reasoningEffort: "high",
          taskWindows: [
            createTaskWindow({
              completedAt: "2026-03-26T09:50:00-04:00",
              lastActivityAt: "2026-03-26T09:50:00-04:00",
              parentSessionId: "direct-main",
              sessionId: "subagent-done",
              startedAt: "2026-03-26T09:43:00-04:00",
              turnId: "turn-done",
            }),
          ],
        }),
        createSession({
          sessionId: "direct-waiting",
          kind: "direct",
          cwd: "/tmp/codex-fixtures/reply-needed",
          eventTimes: [
            "2026-03-26T09:44:00-04:00",
            "2026-03-26T09:53:00-04:00",
          ],
          userMessageTimes: ["2026-03-26T09:44:00-04:00"],
          tokenPoints: [],
          usage: createUsage(0, 0, 0, 0),
          model: "gpt-5.4",
          reasoningEffort: "high",
          taskWindows: [
            createTaskWindow({
              completedAt: "2026-03-26T09:53:00-04:00",
              cwd: "/tmp/codex-fixtures/reply-needed",
              lastActivityAt: "2026-03-26T09:53:00-04:00",
              parentSessionId: null,
              sessionId: "direct-waiting",
              startedAt: "2026-03-26T09:44:00-04:00",
              turnId: "turn-waiting",
              sessionKind: "direct",
            }),
          ],
        }),
      ],
      {
        filters: {
          workspaceOnlyPrefix: null,
          sessionKind: null,
          model: null,
          reasoningEffort: null,
        },
        observedAt,
      },
    );

    const renderedLiveReport = renderLiveReport(liveReport, {
      colorEnabled: false,
      shareMode: false,
      terminalWidth: 80,
    });

    expect(liveReport.waitingOnUserCount).toBe(1);
    expect(liveReport.waitingOnUserLocations).toEqual([
      {
        cwd: "/tmp/codex-fixtures/reply-needed",
        waitingCount: 1,
      },
    ]);
    expect(liveReport.waitingThreads).toEqual([
      expect.objectContaining({
        cwd: "/tmp/codex-fixtures/reply-needed",
        sessionId: "direct-waiting",
      }),
    ]);
    expect(liveReport.runningCount).toBe(2);
    expect(liveReport.runningLocations).toEqual([
      {
        cwd: "/tmp/codex-fixtures/agent-runner",
        runningCount: 1,
      },
      {
        cwd: "/tmp/codex-fixtures/demo-workspace",
        runningCount: 1,
      },
    ]);
    expect(liveReport.doneRecentCount).toBe(2);
    expect(liveReport.doneThisTurnCount).toBe(1);
    expect(liveReport.peakTodayCount).toBe(4);
    expect(liveReport.scope).toBe("global");
    expect(renderedLiveReport).toContain("idletime live");
    expect(renderedLiveReport).toContain("scope global");
    expect(renderedLiveReport).toContain("all sessions");
    expect(renderedLiveReport).toContain("waiting on you");
    expect(renderedLiveReport).toContain("running");
    expect(renderedLiveReport).toContain("running at");
    expect(renderedLiveReport).toContain("waiting at");
    expect(renderedLiveReport).toContain("top waiting");
    expect(renderedLiveReport).toContain("reply-needed");
    expect(renderedLiveReport).toContain("waiting");
    expect(renderedLiveReport).toContain("reply-needed");
    expect(renderedLiveReport).toContain("agent-runner");
    expect(renderedLiveReport).toContain("this turn");
    expect(renderedLiveReport).toContain("today peak");
    expect(renderedLiveReport.split("\n")[0]?.length).toBeLessThan(80);
  });

  test("serializes a last24h snapshot with ISO timestamps and exact values", () => {
    const fixture = createSnapshotSerializationFixture();
    const serializedSnapshot = serializeSummarySnapshot({
      command: fixture.summaryCommand,
      generatedAt: fixture.generatedAt,
      hourlyReport: fixture.hourlyReport,
      mode: "last24h",
      summaryReport: fixture.summaryReport,
    });
    const snapshot = JSON.parse(serializedSnapshot) as SerializedSummarySnapshotV1;

    expect(serializedSnapshot.endsWith("\n")).toBe(true);
    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.mode).toBe("last24h");
    expect(snapshot.generatedAt).toBe(fixture.generatedAt.toISOString());
    expect(snapshot.command).toEqual(fixture.summaryCommand);
    expect(snapshot.summaryReport.window.start).toBe(
      fixture.summaryReport.window.start.toISOString(),
    );
    expect(snapshot.summaryReport.activityWindow?.start).toBe(
      fixture.summaryReport.activityWindow?.start.toISOString(),
    );
    expect(snapshot.summaryReport.metrics.strictEngagementBlocks[0]).toEqual({
      start: fixture.summaryReport.metrics.strictEngagementBlocks[0]!.start.toISOString(),
      end: fixture.summaryReport.metrics.strictEngagementBlocks[0]!.end.toISOString(),
    });
    expect(snapshot.summaryReport.metrics.strictEngagementMs).toBe(
      fixture.summaryReport.metrics.strictEngagementMs,
    );
    expect(snapshot.summaryReport.wakeSummary?.wakeDurationMs).toBe(
      fixture.summaryReport.wakeSummary?.wakeDurationMs,
    );
    expect(snapshot.summaryReport.groupBreakdowns[0]?.rows[0]?.practicalBurn).toBe(
      fixture.summaryReport.groupBreakdowns[0]?.rows[0]?.practicalBurn,
    );
    expect(snapshot.hourlyReport?.buckets[0]?.start).toBe(
      fixture.hourlyReport.buckets[0]?.start.toISOString(),
    );
    expect(snapshot.hourlyReport?.buckets[0]?.practicalBurn).toBe(
      fixture.hourlyReport.buckets[0]?.practicalBurn,
    );
    expect(snapshot.hourlyReport?.maxValues.practicalBurn).toBe(
      fixture.hourlyReport.maxValues.practicalBurn,
    );
  });

  test("serializes a today snapshot with an explicit null hourly report", () => {
    const fixture = createSnapshotSerializationFixture();
    const serializedSnapshot = serializeSummarySnapshot({
      command: fixture.summaryCommand,
      generatedAt: fixture.generatedAt,
      hourlyReport: null,
      mode: "today",
      summaryReport: fixture.summaryReport,
    });
    const snapshot = JSON.parse(serializedSnapshot) as SerializedSummarySnapshotV1;

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.mode).toBe("today");
    expect(snapshot.hourlyReport).toBeNull();
    expect(snapshot.command.groupBy).toEqual(["model"]);
    expect(snapshot.summaryReport.metrics.agentCoverageBlocks[0]).toEqual({
      start: fixture.summaryReport.metrics.agentCoverageBlocks[0]!.start.toISOString(),
      end: fixture.summaryReport.metrics.agentCoverageBlocks[0]!.end.toISOString(),
    });
    expect(snapshot.summaryReport.tokenTotals.rawTotalTokens).toBe(
      fixture.summaryReport.tokenTotals.rawTotalTokens,
    );
    expect(snapshot.summaryReport.wakeSummary?.awakeIdleMs).toBe(
      fixture.summaryReport.wakeSummary?.awakeIdleMs,
    );
  });

  test("serializes an hourly snapshot with exact bucket timestamps", () => {
    const fixture = createSnapshotSerializationFixture();
    const serializedSnapshot = serializeHourlySnapshot({
      command: fixture.hourlyCommand,
      generatedAt: fixture.generatedAt,
      hourlyReport: fixture.hourlyReport,
    });
    const snapshot = JSON.parse(serializedSnapshot) as SerializedHourlySnapshotV1;

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.mode).toBe("hourly");
    expect(snapshot.generatedAt).toBe(fixture.generatedAt.toISOString());
    expect(snapshot.command.wakeWindow).toBeNull();
    expect(snapshot.hourlyReport.buckets).toHaveLength(2);
    expect(snapshot.hourlyReport.buckets[0]?.start).toBe(
      fixture.hourlyReport.buckets[0]?.start.toISOString(),
    );
    expect(snapshot.hourlyReport.buckets[0]?.rawTotalTokens).toBe(
      fixture.hourlyReport.buckets[0]?.rawTotalTokens,
    );
    expect(snapshot.hourlyReport.buckets[1]?.practicalBurn).toBe(
      fixture.hourlyReport.buckets[1]?.practicalBurn,
    );
    expect(snapshot.hourlyReport.maxValues.engagedMs).toBe(
      fixture.hourlyReport.maxValues.engagedMs,
    );
  });

  test("serializes a live snapshot with exact observed time and counters", () => {
    const fixture = createSnapshotSerializationFixture();
    const serializedSnapshot = serializeLiveSnapshot({
      command: fixture.liveCommand,
      generatedAt: fixture.generatedAt,
      liveReport: fixture.liveReport,
    });
    const snapshot = JSON.parse(serializedSnapshot) as SerializedLiveSnapshotV1;

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.mode).toBe("live");
    expect(snapshot.generatedAt).toBe(fixture.generatedAt.toISOString());
    expect(snapshot.command).toEqual(fixture.liveCommand);
    expect(snapshot.liveReport.observedAt).toBe(
      fixture.liveReport.observedAt.toISOString(),
    );
    expect(snapshot.liveReport.scope).toBe(fixture.liveReport.scope);
    expect(snapshot.liveReport.workspacePrefix).toBe(
      fixture.liveReport.workspacePrefix,
    );
    expect(snapshot.liveReport.waitingOnUserCount).toBe(1);
    expect(snapshot.liveReport.waitingOnUserLocations).toEqual([
      {
        cwd: "/tmp/codex-fixtures/reply-needed",
        waitingCount: 1,
      },
    ]);
    expect(snapshot.liveReport.waitingThreads).toEqual([
      expect.objectContaining({
        cwd: "/tmp/codex-fixtures/reply-needed",
        sessionId: "direct-waiting",
      }),
    ]);
    expect(snapshot.liveReport.runningCount).toBe(2);
    expect(snapshot.liveReport.runningLocations).toEqual([
      {
        cwd: "/tmp/codex-fixtures/agent-runner",
        runningCount: 1,
      },
      {
        cwd: "/tmp/codex-fixtures/demo-workspace",
        runningCount: 1,
      },
    ]);
    expect(snapshot.liveReport.doneRecentCount).toBe(2);
    expect(snapshot.liveReport.doneThisTurnCount).toBe(1);
    expect(snapshot.liveReport.peakTodayCount).toBe(4);
    expect(snapshot.liveReport.scope).toBe("global");
    expect(snapshot.liveReport.workspacePrefix).toBeNull();
    expect(snapshot.liveReport.recentConcurrencyValues).toEqual(
      fixture.liveReport.recentConcurrencyValues,
    );
  });
});

function createSession(input: {
  cwd?: string;
  sessionId: string;
  kind: ParsedSession["kind"];
  eventTimes: string[];
  userMessageTimes: string[];
  tokenPoints: TokenPoint[];
  usage: TokenUsage;
  model: string;
  reasoningEffort: string;
  taskWindows?: ProtocolTaskWindow[];
}): ParsedSession {
  const eventTimestamps = input.eventTimes.map((value) => new Date(value));
  return {
    sessionId: input.sessionId,
    sourceFilePath: `${input.sessionId}.jsonl`,
    cwd: input.cwd ?? "/tmp/codex-fixtures/demo-workspace",
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
    taskWindows: input.taskWindows ?? [],
    primaryModel: input.model,
    primaryReasoningEffort: input.reasoningEffort,
  };
}

function createTokenPoint(
  timestamp: string,
  usage: TokenUsage,
  lastUsage: TokenUsage | null = null,
): TokenPoint {
  return {
    timestamp: new Date(timestamp),
    usage,
    lastUsage,
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

function createTaskWindow(input: {
  completedAt: string | null;
  cwd?: string;
  lastActivityAt: string;
  parentSessionId: string | null;
  sessionId: string;
  sessionKind?: ProtocolTaskWindow["sessionKind"];
  startedAt: string;
  turnId: string;
}): ProtocolTaskWindow {
  return {
    taskId: `${input.sessionId}:${input.turnId}:0`,
    sessionId: input.sessionId,
    parentSessionId: input.parentSessionId,
    sessionKind: input.sessionKind ?? "subagent",
    cwd: input.cwd ?? "/tmp/codex-fixtures/demo-workspace",
    turnId: input.turnId,
    model: "gpt-5.4-mini",
    reasoningEffort: "high",
    startedAt: new Date(input.startedAt),
    lastActivityAt: new Date(input.lastActivityAt),
    completedAt: input.completedAt ? new Date(input.completedAt) : null,
    staleAfterMs: 2 * 60_000,
  };
}

function createRhythmReportFixture(): HourlyReport {
  const start = new Date("2026-03-26T08:00:00-04:00");
  const buckets: HourlyBucket[] = Array.from({ length: 24 }, (_, index) => {
    const bucketStart = new Date(start.getTime() + index * 3_600_000);
    const bucketEnd = new Date(bucketStart.getTime() + 3_600_000);
    const engagedMs = ((index % 5) + 1) * 7 * 60_000;
    const directActivityMs = engagedMs + ((index % 3) + 1) * 4 * 60_000;
    const agentOnlyMs = (index % 2) * 6 * 60_000;

    return {
      start: bucketStart,
      end: bucketEnd,
      agentOnlyMs,
      awakeIdleMs: Math.max(0, 3_600_000 - directActivityMs - agentOnlyMs),
      directActivityMs,
      engagedMs,
      peakConcurrentAgents: (index % 4) + 1,
      practicalBurn: (index + 1) * 125,
      rawTotalTokens: (index + 1) * 150,
      sessionCount: (index % 3) + 1,
    };
  });

  return {
    appliedFilters: {
      workspaceOnlyPrefix: null,
      sessionKind: null,
      model: null,
      reasoningEffort: null,
    },
    agentConcurrencySource: "task-window-adapter",
    buckets,
    hasWakeWindow: false,
    idleCutoffMs: parseDurationToMs("15m"),
    maxValues: {
      agentOnlyMs: Math.max(...buckets.map((bucket) => bucket.agentOnlyMs)),
      directActivityMs: Math.max(
        ...buckets.map((bucket) => bucket.directActivityMs),
      ),
      engagedMs: Math.max(...buckets.map((bucket) => bucket.engagedMs)),
      practicalBurn: Math.max(...buckets.map((bucket) => bucket.practicalBurn)),
    },
    window: {
      label: "synthetic-24h",
      start,
      end: new Date(start.getTime() + 24 * 3_600_000),
      timeZone: "America/New_York",
    },
  };
}

function createSnapshotSerializationFixture(): {
  generatedAt: Date;
  hourlyCommand: JsonHourlySnapshotCommand;
  hourlyReport: HourlyReport;
  liveReport: ReturnType<typeof buildLiveReport>;
  liveCommand: JsonLiveSnapshotCommand;
  summaryCommand: JsonSummarySnapshotCommand;
  summaryReport: ReturnType<typeof buildSummaryReport>;
} {
  const reportWindow = {
    label: "serialization-window",
    start: new Date("2026-03-26T09:00:00-04:00"),
    end: new Date("2026-03-26T11:00:00-04:00"),
    timeZone: "America/New_York",
  };
  const sharedFilters = {
    workspaceOnlyPrefix: null,
    sessionKind: null,
    model: null,
    reasoningEffort: null,
  };
  const sessions = [
    createSession({
      sessionId: "direct-main",
      kind: "direct",
      eventTimes: [
        "2026-03-26T09:00:00-04:00",
        "2026-03-26T09:05:00-04:00",
        "2026-03-26T09:25:00-04:00",
      ],
      userMessageTimes: [
        "2026-03-26T09:00:00-04:00",
        "2026-03-26T09:25:00-04:00",
      ],
      tokenPoints: [
        createTokenPoint(
          "2026-03-26T09:05:00-04:00",
          createUsage(100, 0, 0, 100),
        ),
      ],
      usage: createUsage(220, 0, 0, 220),
      model: "gpt-5.4",
      reasoningEffort: "xhigh",
    }),
    createSession({
      sessionId: "subagent-a",
      kind: "subagent",
      eventTimes: [
        "2026-03-26T09:10:00-04:00",
        "2026-03-26T09:40:00-04:00",
      ],
      userMessageTimes: [],
      tokenPoints: [
        createTokenPoint(
          "2026-03-26T09:45:00-04:00",
          createUsage(50, 0, 0, 50),
        ),
      ],
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
  ];

  const summaryCommand: JsonSummarySnapshotCommand = {
    idleCutoffMs: parseDurationToMs("15m"),
    filters: sharedFilters,
    groupBy: ["model"],
    wakeWindow: parseWakeWindow("09:00-10:30"),
  };
  const hourlyCommand: JsonHourlySnapshotCommand = {
    idleCutoffMs: parseDurationToMs("15m"),
    filters: sharedFilters,
    wakeWindow: null,
  };
  const summaryReport = buildSummaryReport(sessions, {
    filters: sharedFilters,
    groupBy: summaryCommand.groupBy,
    idleCutoffMs: summaryCommand.idleCutoffMs,
    wakeWindow: summaryCommand.wakeWindow,
    window: reportWindow,
  });
  const hourlyReport = buildHourlyReport(sessions, {
    filters: sharedFilters,
    idleCutoffMs: hourlyCommand.idleCutoffMs,
    wakeWindow: hourlyCommand.wakeWindow,
    window: reportWindow,
  });
  const observedAt = new Date("2026-03-26T09:55:00-04:00");
  const liveReport = buildLiveReport(
    [
      createSession({
        sessionId: "direct-main",
        kind: "direct",
        eventTimes: [
          "2026-03-26T09:40:00-04:00",
          "2026-03-26T09:45:00-04:00",
          "2026-03-26T09:55:00-04:00",
        ],
        userMessageTimes: ["2026-03-26T09:40:00-04:00"],
        tokenPoints: [],
        usage: createUsage(0, 0, 0, 0),
        model: "gpt-5.4",
        reasoningEffort: "high",
        taskWindows: [
          createTaskWindow({
            completedAt: null,
            lastActivityAt: "2026-03-26T09:55:00-04:00",
            parentSessionId: null,
            sessionId: "direct-main",
            startedAt: "2026-03-26T09:40:00-04:00",
            turnId: "turn-direct",
            sessionKind: "direct",
          }),
        ],
      }),
      createSession({
        sessionId: "subagent-running",
        kind: "subagent",
        cwd: "/tmp/codex-fixtures/agent-runner",
        eventTimes: ["2026-03-26T09:42:00-04:00"],
        userMessageTimes: [],
        tokenPoints: [],
        usage: createUsage(0, 0, 0, 0),
        model: "gpt-5.4-mini",
        reasoningEffort: "high",
        taskWindows: [
          createTaskWindow({
            completedAt: null,
            cwd: "/tmp/codex-fixtures/agent-runner",
            lastActivityAt: "2026-03-26T09:54:00-04:00",
            parentSessionId: "direct-main",
            sessionId: "subagent-running",
            startedAt: "2026-03-26T09:42:00-04:00",
            turnId: "turn-running",
          }),
        ],
      }),
      createSession({
        sessionId: "subagent-done",
        kind: "subagent",
        eventTimes: ["2026-03-26T09:43:00-04:00"],
        userMessageTimes: [],
        tokenPoints: [],
        usage: createUsage(0, 0, 0, 0),
        model: "gpt-5.4-mini",
        reasoningEffort: "high",
        taskWindows: [
          createTaskWindow({
            completedAt: "2026-03-26T09:50:00-04:00",
            lastActivityAt: "2026-03-26T09:50:00-04:00",
            parentSessionId: "direct-main",
            sessionId: "subagent-done",
            startedAt: "2026-03-26T09:43:00-04:00",
            turnId: "turn-done",
          }),
        ],
      }),
      createSession({
        sessionId: "direct-waiting",
        kind: "direct",
        cwd: "/tmp/codex-fixtures/reply-needed",
        eventTimes: [
          "2026-03-26T09:44:00-04:00",
          "2026-03-26T09:53:00-04:00",
        ],
        userMessageTimes: ["2026-03-26T09:44:00-04:00"],
        tokenPoints: [],
        usage: createUsage(0, 0, 0, 0),
        model: "gpt-5.4",
        reasoningEffort: "high",
        taskWindows: [
          createTaskWindow({
            completedAt: "2026-03-26T09:53:00-04:00",
            cwd: "/tmp/codex-fixtures/reply-needed",
            lastActivityAt: "2026-03-26T09:53:00-04:00",
            parentSessionId: null,
            sessionId: "direct-waiting",
            startedAt: "2026-03-26T09:44:00-04:00",
            turnId: "turn-waiting",
            sessionKind: "direct",
          }),
        ],
      }),
    ],
    {
      filters: sharedFilters,
      observedAt,
    },
  );

  const liveCommand: JsonLiveSnapshotCommand = {
    filters: liveReport.appliedFilters,
  };

  return {
    generatedAt: new Date("2026-03-26T10:05:00-04:00"),
    hourlyCommand,
    hourlyReport,
    liveCommand,
    liveReport,
    summaryCommand,
    summaryReport,
  };
}

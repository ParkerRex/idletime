import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ParsedSession, TokenPoint, TokenUsage } from "../src/codex-session-log/types.ts";
import { buildBestMetricCandidates } from "../src/best-metrics/build-best-metrics.ts";
import { refreshBestMetrics } from "../src/best-metrics/refresh-best-metrics.ts";
import { readAllCodexSessions } from "../src/best-metrics/read-all-codex-sessions.ts";
import { resolveBestEventsPath } from "../src/best-metrics/append-best-events.ts";
import {
  buildBestEventNotification,
  notifyBestEvents,
} from "../src/best-metrics/notify-best-events.ts";
import { buildCurrentBestMetricValues } from "../src/best-metrics/build-current-best-metrics.ts";
import { notifyNearBestMetrics } from "../src/best-metrics/near-best-notifications.ts";
import {
  parseBestLedger,
  readBestLedger,
  serializeBestLedger,
} from "../src/best-metrics/read-best-ledger.ts";
import { writeBestLedger } from "../src/best-metrics/write-best-ledger.ts";
import { bestMetricsLedgerVersion } from "../src/best-metrics/types.ts";
import type { BestMetricsLedger } from "../src/best-metrics/types.ts";

describe("best metrics", () => {
  test("builds global best candidates from session history", () => {
    const sessions = [
      createSession({
        sessionId: "direct-main",
        kind: "direct",
        eventTimes: [
          "2026-03-25T08:00:00.000Z",
          "2026-03-25T08:30:00.000Z",
        ],
        userMessageTimes: ["2026-03-25T08:00:00.000Z"],
        tokenPoints: [
          createTokenPoint(
            "2026-03-25T08:00:00.000Z",
            createUsage(200, 0, 0, 200),
          ),
          createTokenPoint(
            "2026-03-26T07:59:00.000Z",
            createUsage(500, 0, 0, 500),
            createUsage(300, 0, 0, 300),
          ),
        ],
        usage: createUsage(500, 0, 0, 500),
        model: "gpt-5.4",
        reasoningEffort: "high",
      }),
      createSession({
        sessionId: "subagent-a",
        kind: "subagent",
        eventTimes: [
          "2026-03-25T09:00:00.000Z",
          "2026-03-25T09:10:00.000Z",
        ],
        userMessageTimes: [],
        tokenPoints: [],
        usage: createUsage(0, 0, 0, 0),
        model: "gpt-5.4-mini",
        reasoningEffort: "medium",
      }),
      createSession({
        sessionId: "subagent-b",
        kind: "subagent",
        eventTimes: ["2026-03-25T09:05:00.000Z"],
        userMessageTimes: [],
        tokenPoints: [],
        usage: createUsage(0, 0, 0, 0),
        model: "gpt-5.4-mini",
        reasoningEffort: "medium",
      }),
      createSession({
        sessionId: "subagent-c",
        kind: "subagent",
        eventTimes: ["2026-03-25T20:00:00.000Z"],
        userMessageTimes: [],
        tokenPoints: [],
        usage: createUsage(0, 0, 0, 0),
        model: "gpt-5.4-mini",
        reasoningEffort: "medium",
      }),
    ];

    const bestMetrics = buildBestMetricCandidates(sessions);

    expect(bestMetrics.bestConcurrentAgents?.value).toBe(2);
    expect(bestMetrics.bestConcurrentAgents?.windowStart.toISOString()).toBe(
      "2026-03-25T09:05:00.000Z",
    );
    expect(bestMetrics.best24hRawBurn?.value).toBe(500);
    expect(bestMetrics.best24hRawBurn?.windowEnd.toISOString()).toBe(
      "2026-03-26T07:59:00.000Z",
    );
    expect(bestMetrics.best24hAgentSumMs?.value).toBe(55 * 60 * 1000);
    expect(bestMetrics.best24hAgentSumMs?.windowEnd.toISOString()).toBe(
      "2026-03-25T20:15:00.000Z",
    );
  });

  test("writes and reads the best-metrics ledger", async () => {
    const stateDirectory = await mkdtemp(join(tmpdir(), "idletime-best-metrics-"));
    const ledger: BestMetricsLedger = {
      version: bestMetricsLedgerVersion,
      initializedAt: new Date("2026-03-27T20:00:00.000Z"),
      lastScannedAt: new Date("2026-03-27T21:00:00.000Z"),
      bestConcurrentAgents: {
        value: 8,
        observedAt: new Date("2026-03-27T18:00:00.000Z"),
        windowStart: new Date("2026-03-27T18:00:00.000Z"),
        windowEnd: new Date("2026-03-27T18:15:00.000Z"),
      },
      best24hRawBurn: null,
      best24hAgentSumMs: null,
    };

    await writeBestLedger(ledger, { stateDirectory });

    const storedLedger = await readBestLedger({ stateDirectory });

    expect(storedLedger).toEqual(ledger);
    expect(serializeBestLedger(ledger)).toContain('"version": 1');
  });

  test("returns null for a missing ledger file and rejects malformed state", async () => {
    const stateDirectory = await mkdtemp(join(tmpdir(), "idletime-best-metrics-"));
    expect(await readBestLedger({ stateDirectory })).toBeNull();

    await writeFile(
      join(stateDirectory, "bests-v1.json"),
      JSON.stringify({
        version: 999,
        initializedAt: "2026-03-27T20:00:00.000Z",
        lastScannedAt: "2026-03-27T21:00:00.000Z",
        bestConcurrentAgents: null,
        best24hRawBurn: null,
        best24hAgentSumMs: null,
      }),
      "utf8",
    );

    await expect(readBestLedger({ stateDirectory })).rejects.toThrow(
      "bestMetricsLedger.version must be 1.",
    );
    expect(() =>
      parseBestLedger({
        version: 1,
        initializedAt: "not-a-date",
        lastScannedAt: "2026-03-27T21:00:00.000Z",
        bestConcurrentAgents: null,
        best24hRawBurn: null,
        best24hAgentSumMs: null,
      })
    ).toThrow("bestMetricsLedger.initializedAt is not a valid ISO timestamp.");
  });

  test("bootstraps and refreshes the best-metrics ledger from session files", async () => {
    const stateDirectory = await mkdtemp(join(tmpdir(), "idletime-best-metrics-"));
    const sessionRootDirectory = await mkdtemp(
      join(tmpdir(), "idletime-session-root-"),
    );

    await writeSessionFixture(sessionRootDirectory, {
      sessionId: "direct-main",
      source: "cli",
      records: [
        buildTurnContextRecord(
          "2026-03-25T08:00:00.001Z",
          "turn-1",
          "gpt-5.4",
          "high",
        ),
        buildTokenCountRecord("2026-03-25T08:10:00.000Z", 300, 0, 0, 300),
        buildTokenCountRecord(
          "2026-03-26T07:50:00.000Z",
          700,
          0,
          0,
          700,
          400,
        ),
      ],
      timestamp: "2026-03-25T08:00:00.000Z",
    });
    await writeSessionFixture(sessionRootDirectory, {
      sessionId: "subagent-a",
      source: {
        subagent: {
          thread_spawn: {
            parent_thread_id: "direct-main",
            depth: 1,
            agent_nickname: "ReviewerA",
            agent_role: "reviewer",
          },
        },
      },
      records: [
        buildTurnContextRecord(
          "2026-03-25T09:00:00.000Z",
          "subagent-turn-1",
          "gpt-5.4-mini",
          "medium",
        ),
      ],
      timestamp: "2026-03-25T09:00:00.000Z",
    });
    await writeSessionFixture(sessionRootDirectory, {
      sessionId: "subagent-b",
      source: {
        subagent: {
          thread_spawn: {
            parent_thread_id: "direct-main",
            depth: 1,
            agent_nickname: "ReviewerB",
            agent_role: "reviewer",
          },
        },
      },
      records: [
        buildTurnContextRecord(
          "2026-03-25T09:05:00.000Z",
          "subagent-turn-2",
          "gpt-5.4-mini",
          "medium",
        ),
      ],
      timestamp: "2026-03-25T09:05:00.000Z",
    });

    const bootstrappedBestMetrics = await refreshBestMetrics({
      now: new Date("2026-03-27T21:00:00.000Z"),
      sessionRootDirectory,
      stateDirectory,
    });

    expect(bootstrappedBestMetrics.refreshMode).toBe("bootstrap");
    expect(bootstrappedBestMetrics.newBestEvents).toHaveLength(0);
    expect(bootstrappedBestMetrics.ledger.bestConcurrentAgents?.value).toBe(2);
    expect(bootstrappedBestMetrics.ledger.best24hRawBurn?.value).toBe(700);

    await writeSessionFixture(sessionRootDirectory, {
      sessionId: "direct-spike",
      source: "cli",
      records: [
        buildTurnContextRecord(
          "2026-03-27T10:00:00.001Z",
          "turn-2",
          "gpt-5.4",
          "high",
        ),
        buildTokenCountRecord("2026-03-27T10:05:00.000Z", 900, 0, 0, 900),
      ],
      timestamp: "2026-03-27T10:00:00.000Z",
    });
    await writeSessionFixture(sessionRootDirectory, {
      sessionId: "subagent-c",
      source: {
        subagent: {
          thread_spawn: {
            parent_thread_id: "direct-main",
            depth: 1,
            agent_nickname: "ReviewerC",
            agent_role: "reviewer",
          },
        },
      },
      records: [
        buildTurnContextRecord(
          "2026-03-27T10:00:00.000Z",
          "subagent-turn-3",
          "gpt-5.4-mini",
          "medium",
        ),
      ],
      timestamp: "2026-03-27T10:00:00.000Z",
    });
    await writeSessionFixture(sessionRootDirectory, {
      sessionId: "subagent-d",
      source: {
        subagent: {
          thread_spawn: {
            parent_thread_id: "direct-main",
            depth: 1,
            agent_nickname: "ReviewerD",
            agent_role: "reviewer",
          },
        },
      },
      records: [
        buildTurnContextRecord(
          "2026-03-27T10:05:00.000Z",
          "subagent-turn-4",
          "gpt-5.4-mini",
          "medium",
        ),
      ],
      timestamp: "2026-03-27T10:05:00.000Z",
    });
    await writeSessionFixture(sessionRootDirectory, {
      sessionId: "subagent-e",
      source: {
        subagent: {
          thread_spawn: {
            parent_thread_id: "direct-main",
            depth: 1,
            agent_nickname: "ReviewerE",
            agent_role: "reviewer",
          },
        },
      },
      records: [
        buildTurnContextRecord(
          "2026-03-27T10:10:00.000Z",
          "subagent-turn-5",
          "gpt-5.4-mini",
          "medium",
        ),
      ],
      timestamp: "2026-03-27T10:10:00.000Z",
    });

    const refreshedBestMetrics = await refreshBestMetrics({
      now: new Date("2026-03-27T22:00:00.000Z"),
      sessionRootDirectory,
      stateDirectory,
    });

    expect(refreshedBestMetrics.refreshMode).toBe("refresh");
    expect(refreshedBestMetrics.newBestEvents.map((event) => event.metric)).toEqual([
      "bestConcurrentAgents",
      "best24hRawBurn",
      "best24hAgentSumMs",
    ]);
    expect(refreshedBestMetrics.ledger.initializedAt.toISOString()).toBe(
      "2026-03-27T21:00:00.000Z",
    );
    expect(refreshedBestMetrics.ledger.lastScannedAt.toISOString()).toBe(
      "2026-03-27T22:00:00.000Z",
    );
    expect(refreshedBestMetrics.ledger.bestConcurrentAgents?.value).toBe(3);
    expect(refreshedBestMetrics.ledger.best24hRawBurn?.value).toBe(900);
    expect(
      (
        await readBestLedger({
          stateDirectory,
        })
      )?.best24hRawBurn?.value,
    ).toBe(900);

    const eventLinesAfterRefresh = (
      await readFile(resolveBestEventsPath({ stateDirectory }), "utf8")
    )
      .trim()
      .split("\n");
    expect(eventLinesAfterRefresh).toHaveLength(3);

    const repeatedRefresh = await refreshBestMetrics({
      now: new Date("2026-03-27T22:05:00.000Z"),
      sessionRootDirectory,
      stateDirectory,
    });
    expect(repeatedRefresh.newBestEvents).toHaveLength(0);

    const eventLinesAfterRepeat = (
      await readFile(resolveBestEventsPath({ stateDirectory }), "utf8")
    )
      .trim()
      .split("\n");
    expect(eventLinesAfterRepeat).toEqual(eventLinesAfterRefresh);
  });

  test("skips malformed session files during the all-history scan", async () => {
    const sessionRootDirectory = await mkdtemp(
      join(tmpdir(), "idletime-session-root-"),
    );

    await writeSessionFixture(sessionRootDirectory, {
      sessionId: "valid-session",
      source: "cli",
      records: [
        buildTurnContextRecord(
          "2026-03-27T10:00:00.001Z",
          "turn-1",
          "gpt-5.4",
          "high",
        ),
      ],
      timestamp: "2026-03-27T10:00:00.000Z",
    });
    await writeFile(
      join(sessionRootDirectory, "2026", "03", "27", "broken.jsonl"),
      JSON.stringify({
        timestamp: "2026-03-27T11:00:00.000Z",
        payload: {},
      }),
      "utf8",
    );

    const parsedSessions = await readAllCodexSessions({ sessionRootDirectory });

    expect(parsedSessions).toHaveLength(1);
    expect(parsedSessions[0]?.sessionId).toBe("valid-session");
  });

  test("sends macOS notifications only for new best events", async () => {
    const deliveredNotifications: Array<{ title: string; body: string }> = [];
    const bestEvent = {
      metric: "best24hRawBurn",
      previousValue: 500,
      value: 1_800_000_000,
      observedAt: new Date("2026-03-27T18:00:00.000Z"),
      windowStart: new Date("2026-03-26T18:00:00.000Z"),
      windowEnd: new Date("2026-03-27T18:00:00.000Z"),
      version: bestMetricsLedgerVersion,
    } as const;

    expect(buildBestEventNotification(bestEvent)).toEqual({
      title: "New best 24hr raw burn",
      body: "1.8B 24hr raw burn",
    });

    await notifyBestEvents([bestEvent], {
      platform: "darwin",
      notifier: async (notification) => {
        deliveredNotifications.push(notification);
      },
    });
    await notifyBestEvents([bestEvent], {
      platform: "linux",
      notifier: async (notification) => {
        deliveredNotifications.push(notification);
      },
    });

    expect(deliveredNotifications).toEqual([
      {
        title: "New best 24hr raw burn",
        body: "1.8B 24hr raw burn",
      },
    ]);
  });

  test("builds current best-metric values and near-best nudges respect opt-in and cooldowns", async () => {
    const sessions = [
      createSession({
        sessionId: "subagent-a",
        kind: "subagent",
        eventTimes: ["2026-03-27T20:00:00.000Z"],
        userMessageTimes: [],
        tokenPoints: [],
        usage: createUsage(0, 0, 0, 0),
        model: "gpt-5.4-mini",
        reasoningEffort: "medium",
      }),
      createSession({
        sessionId: "subagent-b",
        kind: "subagent",
        eventTimes: ["2026-03-27T20:05:00.000Z"],
        userMessageTimes: [],
        tokenPoints: [],
        usage: createUsage(0, 0, 0, 0),
        model: "gpt-5.4-mini",
        reasoningEffort: "medium",
      }),
      createSession({
        sessionId: "direct-main",
        kind: "direct",
        eventTimes: ["2026-03-27T19:00:00.000Z"],
        userMessageTimes: ["2026-03-27T19:00:00.000Z"],
        tokenPoints: [
          createTokenPoint(
            "2026-03-27T19:10:00.000Z",
            createUsage(1_746_000_000, 0, 0, 1_746_000_000),
          ),
        ],
        usage: createUsage(1_746_000_000, 0, 0, 1_746_000_000),
        model: "gpt-5.4",
        reasoningEffort: "high",
      }),
    ];
    const now = new Date("2026-03-27T20:10:00.000Z");
    const currentMetrics = buildCurrentBestMetricValues(sessions, { now });
    const stateDirectory = await mkdtemp(join(tmpdir(), "idletime-near-best-"));
    const deliveredNotifications: Array<{ title: string; body: string }> = [];
    const ledger = {
      version: bestMetricsLedgerVersion,
      initializedAt: new Date("2026-03-27T18:00:00.000Z"),
      lastScannedAt: new Date("2026-03-27T20:10:00.000Z"),
      bestConcurrentAgents: {
        value: 3,
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
        value: 31 * 60 * 1000,
        observedAt: new Date("2026-03-27T18:00:00.000Z"),
        windowStart: new Date("2026-03-26T18:00:00.000Z"),
        windowEnd: new Date("2026-03-27T18:00:00.000Z"),
      },
    } as const;

    expect(currentMetrics).toEqual({
      bestConcurrentAgents: 2,
      best24hRawBurn: 1_746_000_000,
      best24hAgentSumMs: 10 * 60 * 1000,
    });

    expect(
      await notifyNearBestMetrics(currentMetrics, ledger, {
        now,
        platform: "darwin",
        stateDirectory,
        notifier: async (notification) => {
          deliveredNotifications.push(notification);
        },
      }),
    ).toEqual([]);

    await writeFile(
      join(stateDirectory, "near-best-notifications-v1.json"),
      JSON.stringify({
        version: 1,
        nearBestEnabled: true,
        thresholdRatio: 0.97,
        cooldownMs: 24 * 60 * 60 * 1000,
        lastNotifiedAt: {
          bestConcurrentAgents: null,
          best24hRawBurn: null,
          best24hAgentSumMs: null,
        },
      }),
      "utf8",
    );

    expect(
      await notifyNearBestMetrics(currentMetrics, ledger, {
        now,
        platform: "darwin",
        stateDirectory,
        notifier: async (notification) => {
          deliveredNotifications.push(notification);
        },
      }),
    ).toEqual(["best24hRawBurn"]);
    expect(deliveredNotifications).toEqual([
      {
        title: "Close to best 24hr raw burn",
        body: "1.7B of 1.8B 24hr raw burn",
      },
    ]);
    expect(
      await notifyNearBestMetrics(currentMetrics, ledger, {
        now: new Date("2026-03-27T21:10:00.000Z"),
        platform: "darwin",
        stateDirectory,
        notifier: async (notification) => {
          deliveredNotifications.push(notification);
        },
      }),
    ).toEqual([]);
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

async function writeSessionFixture(
  sessionRootDirectory: string,
  fixture: {
    sessionId: string;
    source: Record<string, unknown> | string;
    records: Array<Record<string, unknown>>;
    timestamp: string;
  },
): Promise<void> {
  const directory = join(
    sessionRootDirectory,
    fixture.timestamp.slice(0, 4),
    fixture.timestamp.slice(5, 7),
    fixture.timestamp.slice(8, 10),
  );
  await mkdir(directory, { recursive: true });

  const filePath = join(directory, `${fixture.sessionId}.jsonl`);
  const lines = [
    JSON.stringify({
      timestamp: fixture.timestamp,
      type: "session_meta",
      payload: {
        id: fixture.sessionId,
        timestamp: fixture.timestamp,
        cwd: "/tmp/codex-fixtures/demo-workspace",
        source: fixture.source,
      },
    }),
    ...fixture.records.map((record) => JSON.stringify(record)),
  ];
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

function buildTurnContextRecord(
  timestamp: string,
  turnId: string,
  model: string,
  effort: string,
): Record<string, unknown> {
  return {
    timestamp,
    type: "turn_context",
    payload: {
      turn_id: turnId,
      cwd: "/tmp/codex-fixtures/demo-workspace",
      model,
      effort,
    },
  };
}

function buildTokenCountRecord(
  timestamp: string,
  inputTokens: number,
  cachedInputTokens: number,
  outputTokens: number,
  totalTokens: number,
  lastTotalTokens?: number,
): Record<string, unknown> {
  return {
    timestamp,
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: {
          input_tokens: inputTokens,
          cached_input_tokens: cachedInputTokens,
          output_tokens: outputTokens,
          reasoning_output_tokens: 0,
          total_tokens: totalTokens,
        },
        ...(lastTotalTokens === undefined
          ? {}
          : {
              last_token_usage: {
                input_tokens: lastTotalTokens,
                cached_input_tokens: 0,
                output_tokens: 0,
                reasoning_output_tokens: 0,
                total_tokens: lastTotalTokens,
              },
            }),
      },
    },
  };
}

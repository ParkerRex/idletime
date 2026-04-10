import { describe, expect, test } from "bun:test";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildCodexLimitReport, resolveCodexLimitLookbackStart } from "../src/codex-limits/build-codex-limit-report.ts";
import { parseCodexStatusRateLimits } from "../src/codex-limits/parse-codex-status-rate-limits.ts";
import { readCodexRateLimits } from "../src/codex-limits/read-codex-rate-limits.ts";
import type {
  ParsedSession,
  ProtocolTaskWindow,
  TokenPoint,
  TokenUsage,
} from "../src/codex-session-log/types.ts";

describe("codex limits", () => {
  test("reads and normalizes app-server rate limits", async () => {
    const rateLimits = await readCodexRateLimits({
      now: new Date("2026-03-31T16:00:00.000Z"),
      runAppServer: async ({ input }) => {
        expect(input).toContain("\"method\":\"initialize\"");
        expect(input).toContain("\"method\":\"initialized\"");
        expect(input).toContain("\"method\":\"account/rateLimits/read\"");

        return [
          "{\"id\":1,\"result\":{\"ok\":true}}",
          JSON.stringify({
            id: 2,
            result: {
              rateLimitsByLimitId: {
                codex: {
                  primary: {
                    usedPercent: 63,
                    windowDurationMins: 300,
                    resetsAt: 1774978303,
                  },
                  secondary: {
                    usedPercent: 26,
                    windowDurationMins: 10080,
                    resetsAt: 1775503599,
                  },
                },
              },
            },
          }),
        ].join("\n");
      },
    });

    expect(rateLimits.availability).toBe("available");
    expect(rateLimits.source).toBe("app-server");
    expect(rateLimits.fiveHourWindow?.usedPercent).toBe(63);
    expect(rateLimits.fiveHourWindow?.windowDurationMins).toBe(300);
    expect(rateLimits.weeklyWindow?.usedPercent).toBe(26);
    expect(rateLimits.weeklyWindow?.windowDurationMins).toBe(10080);
  });

  test("sequences the app-server handshake on the spawned codex process", async () => {
    const fixtureDirectory = await mkdtemp(
      join(tmpdir(), "idletime-codex-app-server-"),
    );
    const fakeCodexPath = join(fixtureDirectory, "fake-codex.mjs");
    await writeFile(
      fakeCodexPath,
      [
        "#!/usr/bin/env node",
        "import readline from 'node:readline';",
        "const rl = readline.createInterface({ input: process.stdin });",
        "let readyForFollowup = false;",
        "let initializedSeen = false;",
        "rl.on('line', (line) => {",
        "  const message = JSON.parse(line);",
        "  if (message.method === 'initialize') {",
        "    process.stdout.write(JSON.stringify({ id: 1, result: { ok: true } }) + '\\n');",
        "    setTimeout(() => { readyForFollowup = true; }, 0);",
        "    return;",
        "  }",
        "  if (!readyForFollowup) {",
        "    process.exit(0);",
        "  }",
        "  if (message.method === 'initialized') {",
        "    initializedSeen = true;",
        "    return;",
        "  }",
        "  if (message.method === 'account/rateLimits/read' && initializedSeen) {",
        "    process.stdout.write(JSON.stringify({ id: 2, result: { rateLimits: { primary: { usedPercent: 63, windowDurationMins: 300, resetsAt: 1774978303 }, secondary: { usedPercent: 26, windowDurationMins: 10080, resetsAt: 1775503599 } } } }) + '\\n');",
        "    process.exit(0);",
        "  }",
        "  process.exit(1);",
        "});",
      ].join("\n"),
      "utf8",
    );
    await chmod(fakeCodexPath, 0o755);

    const rateLimits = await readCodexRateLimits({
      env: {
        CODEX_BINARY: fakeCodexPath,
      },
      now: new Date("2026-03-31T16:00:00.000Z"),
      timeoutMs: 2_000,
    });

    expect(rateLimits.availability).toBe("available");
    expect(rateLimits.source).toBe("app-server");
    expect(rateLimits.fiveHourWindow?.usedPercent).toBe(63);
    expect(rateLimits.weeklyWindow?.usedPercent).toBe(26);
  });

  test("falls back to parsing /status when app-server fails", async () => {
    const rateLimits = await readCodexRateLimits({
      now: new Date("2026-03-31T16:00:00.000Z"),
      readStatusText: async () =>
        [
          "5h limit 41% resets 13:31",
          "Weekly limit 76% resets 04/06 15:26",
        ].join("\n"),
      runAppServer: async () => {
        throw new Error("app-server failed");
      },
    });

    expect(rateLimits.source).toBe("status-fallback");
    expect(rateLimits.fiveHourWindow?.remainingPercent).toBe(41);
    expect(rateLimits.fiveHourWindow?.usedPercent).toBe(59);
    expect(rateLimits.weeklyWindow?.remainingPercent).toBe(76);
    expect(rateLimits.weeklyWindow?.usedPercent).toBe(24);
  });

  test("reads rate limits from a fixture override", async () => {
    const fixtureDirectory = await mkdtemp(join(tmpdir(), "idletime-codex-limits-"));
    const fixturePath = join(fixtureDirectory, "rate-limits.json");
    await writeFile(
      fixturePath,
      JSON.stringify({
        fiveHourWindow: {
          resetsAt: "2026-03-31T17:31:43.000Z",
          usedPercent: 63,
          windowDurationMins: 300,
        },
        weeklyWindow: {
          resetsAt: "2026-04-06T19:26:39.000Z",
          usedPercent: 26,
          windowDurationMins: 10080,
        },
      }),
      "utf8",
    );

    const rateLimits = await readCodexRateLimits({
      env: {
        IDLETIME_CODEX_RATE_LIMIT_FIXTURE: fixturePath,
      },
      now: new Date("2026-03-31T16:00:00.000Z"),
    });

    expect(rateLimits.source).toBe("fixture");
    expect(rateLimits.fiveHourWindow?.remainingPercent).toBe(37);
    expect(rateLimits.weeklyWindow?.remainingPercent).toBe(74);
  });

  test("completes the live app-server handshake before requesting rate limits", async () => {
    const fixtureDirectory = await mkdtemp(join(tmpdir(), "idletime-codex-binary-"));
    const fakeCodexPath = join(fixtureDirectory, "codex");
    await writeFile(
      fakeCodexPath,
      `#!/bin/sh
initialized=0
while IFS= read -r line; do
  case "$line" in
    *'"method":"initialize"'*)
      printf '%s\\n' '{"id":1,"result":{"userAgent":"fake-codex","codexHome":"/tmp/fake-codex-home","platformFamily":"unix","platformOs":"macos"}}'
      ;;
    *'"method":"initialized"'*)
      initialized=1
      ;;
    *'"method":"account/rateLimits/read"'*)
      if [ "$initialized" -ne 1 ]; then
        exit 1
      fi
      printf '%s\\n' '{"id":2,"result":{"rateLimitsByLimitId":{"codex":{"primary":{"usedPercent":61,"windowDurationMins":300,"resetsAt":1774978303},"secondary":{"usedPercent":27,"windowDurationMins":10080,"resetsAt":1775503599}}}}}'
      exit 0
      ;;
  esac
done
`,
      "utf8",
    );
    await chmod(fakeCodexPath, 0o755);

    const rateLimits = await readCodexRateLimits({
      env: { CODEX_BINARY: fakeCodexPath },
      now: new Date("2026-03-31T16:00:00.000Z"),
      timeoutMs: 2_000,
    });

    expect(rateLimits.source).toBe("app-server");
    expect(rateLimits.fiveHourWindow?.usedPercent).toBe(61);
    expect(rateLimits.weeklyWindow?.usedPercent).toBe(27);
  });

  test("builds exact burn totals and quota pace estimates", async () => {
    const now = new Date("2026-03-31T16:00:00.000Z");
    const codexLimitReport = await buildCodexLimitReport({
      now,
      readRateLimits: async () => ({
        availability: "available",
        fetchedAt: now,
        fiveHourWindow: {
          resetsAt: new Date("2026-03-31T17:00:00.000Z"),
          remainingPercent: 40,
          usedPercent: 60,
          windowDurationMins: 300,
        },
        source: "app-server",
        weeklyWindow: {
          resetsAt: new Date("2026-04-01T00:00:00.000Z"),
          remainingPercent: 75,
          usedPercent: 25,
          windowDurationMins: 10080,
        },
      }),
      sessions: [
        createSession({
          sessionId: "quota-main",
          tokenPoints: [
            createTokenPoint(
              "2026-03-28T15:00:00.000Z",
              createUsage(200, 0, 180, 380),
              createUsage(200, 0, 180, 380),
            ),
            createTokenPoint(
              "2026-03-31T06:00:00.000Z",
              createUsage(300, 0, 280, 960),
              createUsage(100, 0, 100, 200),
            ),
            createTokenPoint(
              "2026-03-31T13:00:00.000Z",
              createUsage(450, 0, 510, 1260),
              createUsage(150, 0, 150, 300),
            ),
            createTokenPoint(
              "2026-03-31T15:30:00.000Z",
              createUsage(510, 0, 570, 1380),
              createUsage(60, 0, 60, 120),
            ),
          ],
        }),
      ],
    });

    expect(codexLimitReport.weeklyWindowBurnTokens).toBe(1000);
    expect(codexLimitReport.fiveHourWindowBurnTokens).toBe(420);
    expect(codexLimitReport.todayBurnTokens).toBe(620);
    expect(codexLimitReport.lastHourBurnTokens).toBe(120);
    expect(codexLimitReport.todayWeeklyBurn.kind).toBe("estimated");
    if (codexLimitReport.todayWeeklyBurn.kind === "estimated") {
      expect(codexLimitReport.todayWeeklyBurn.localBurnTokens).toBe(620);
      expect(codexLimitReport.todayWeeklyBurn.calibrationWindowBurnTokens).toBe(1000);
      expect(codexLimitReport.todayWeeklyBurn.percentPoints).toBeCloseTo(15.5, 5);
    }
    expect(codexLimitReport.lastHourFiveHourBurn.kind).toBe("estimated");
    if (codexLimitReport.lastHourFiveHourBurn.kind === "estimated") {
      expect(codexLimitReport.lastHourFiveHourBurn.localBurnTokens).toBe(120);
      expect(codexLimitReport.lastHourFiveHourBurn.calibrationWindowBurnTokens).toBe(420);
      expect(codexLimitReport.lastHourFiveHourBurn.percentPoints).toBeCloseTo(
        17.142857,
        5,
      );
    }
  });

  test("keeps exact burn totals when rate limits are unavailable", async () => {
    const now = new Date("2026-03-31T16:00:00.000Z");
    const codexLimitReport = await buildCodexLimitReport({
      now,
      readRateLimits: async () => ({
        availability: "unavailable",
        fetchedAt: now,
        fiveHourWindow: null,
        reason: "probe failed",
        source: "unavailable",
        weeklyWindow: null,
      }),
      sessions: [
        createSession({
          sessionId: "quota-main",
          tokenPoints: [
            createTokenPoint(
              "2026-03-31T14:30:00.000Z",
              createUsage(100, 0, 100, 200),
              createUsage(100, 0, 100, 200),
            ),
          ],
        }),
      ],
    });

    expect(codexLimitReport.weeklyWindowBurnTokens).toBe(0);
    expect(codexLimitReport.fiveHourWindowBurnTokens).toBe(0);
    expect(codexLimitReport.todayBurnTokens).toBe(200);
    expect(codexLimitReport.lastHourBurnTokens).toBe(0);
    expect(codexLimitReport.fiveHourRemaining.kind).toBe("unavailable");
    expect(codexLimitReport.todayWeeklyBurn).toEqual({
      kind: "unavailable",
      reason: "missing-rate-limit",
    });
  });

  test("resolves the earliest required lookback start from available windows", () => {
    const now = new Date("2026-03-31T16:00:00.000Z");
    const lookbackStart = resolveCodexLimitLookbackStart({
      defaultStart: new Date("2026-03-31T00:00:00.000Z"),
      now,
      rateLimits: {
        availability: "available",
        fetchedAt: now,
        fiveHourWindow: {
          resetsAt: new Date("2026-03-31T17:00:00.000Z"),
          remainingPercent: 40,
          usedPercent: 60,
          windowDurationMins: 300,
        },
        source: "app-server",
        weeklyWindow: {
          resetsAt: new Date("2026-04-01T00:00:00.000Z"),
          remainingPercent: 75,
          usedPercent: 25,
          windowDurationMins: 10080,
        },
      },
    });

    expect(lookbackStart.toISOString()).toBe("2026-03-24T16:00:00.000Z");
  });

  test("parses status percentages as remaining quota", () => {
    const parsedStatus = parseCodexStatusRateLimits(
      [
        "5h limit 41% resets 13:31",
        "Weekly limit 76% resets 04/06 15:26",
      ].join("\n"),
      new Date("2026-03-31T16:00:00.000Z"),
    );

    expect(parsedStatus?.fiveHourWindow?.remainingPercent).toBe(41);
    expect(parsedStatus?.fiveHourWindow?.usedPercent).toBe(59);
    expect(parsedStatus?.weeklyWindow?.remainingPercent).toBe(76);
    expect(parsedStatus?.weeklyWindow?.usedPercent).toBe(24);
  });
});

function createSession(input: {
  sessionId: string;
  tokenPoints: TokenPoint[];
}): ParsedSession {
  const firstTimestamp = input.tokenPoints[0]?.timestamp ?? new Date();
  const lastTimestamp = input.tokenPoints[input.tokenPoints.length - 1]?.timestamp ?? firstTimestamp;

  return {
    agentSpawnRequests: [],
    cwd: "/tmp/idletime-codex-limits",
    eventTimestamps: input.tokenPoints.map((tokenPoint) => tokenPoint.timestamp),
    finalTokenUsage: input.tokenPoints[input.tokenPoints.length - 1]?.usage ?? null,
    firstTimestamp,
    forkedFromSessionId: null,
    kind: "direct",
    lastTimestamp,
    primaryModel: "gpt-5.4",
    primaryReasoningEffort: "high",
    sessionId: input.sessionId,
    sourceFilePath: `/tmp/${input.sessionId}.jsonl`,
    taskWindows: [] satisfies ProtocolTaskWindow[],
    tokenPoints: input.tokenPoints,
    turnAttributions: [],
    userMessageTimestamps: [],
  };
}

function createTokenPoint(
  timestamp: string,
  usage: TokenUsage,
  lastUsage: TokenUsage | null = null,
): TokenPoint {
  return {
    lastUsage,
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
    cachedInputTokens,
    inputTokens,
    outputTokens,
    practicalBurn: inputTokens - cachedInputTokens + outputTokens,
    reasoningOutputTokens: 0,
    totalTokens,
  };
}

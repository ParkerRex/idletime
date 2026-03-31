import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTokenDeltaPoints } from "../src/codex-session-log/extract-token-points.ts";
import { parseCodexSession } from "../src/codex-session-log/parse-codex-session.ts";
import { readCodexSessions } from "../src/codex-session-log/read-codex-sessions.ts";
import type { TokenPoint, TokenUsage } from "../src/codex-session-log/types.ts";

const fixtureRootDirectory = join(import.meta.dir, "fixtures", "codex-session-log");
const directFixturePath = join(
  fixtureRootDirectory,
  "2026",
  "03",
  "26",
  "direct-session.jsonl",
);
const subagentFixturePath = join(
  fixtureRootDirectory,
  "2026",
  "03",
  "26",
  "subagent-session.jsonl",
);

describe("codex session parsing", () => {
  test("parses a direct session fixture", async () => {
    const parsedSession = await parseCodexSession(directFixturePath);
    const tokenDeltaPoints = buildTokenDeltaPoints(parsedSession.tokenPoints);

    expect(parsedSession.kind).toBe("direct");
    expect(parsedSession.sessionId).toBe("fixture-direct-session-1");
    expect(parsedSession.userMessageTimestamps).toHaveLength(1);
    expect(parsedSession.tokenPoints).toHaveLength(2);
    expect(parsedSession.primaryModel).toBe("gpt-5.4");
    expect(parsedSession.primaryReasoningEffort).toBe("xhigh");
    expect(parsedSession.agentSpawnRequests).toHaveLength(1);
    expect(parsedSession.agentSpawnRequests[0]?.agentType).toBe("reviewer");
    expect(parsedSession.taskWindows).toHaveLength(1);
    expect(parsedSession.taskWindows[0]?.turnId).toBe("turn-1");
    expect(parsedSession.taskWindows[0]?.completedAt?.toISOString()).toBe(
      "2026-03-26T19:40:11.000Z",
    );
    expect(parsedSession.finalTokenUsage?.practicalBurn).toBe(1050);
    expect(tokenDeltaPoints[0]?.deltaUsage.practicalBurn).toBe(800);
    expect(tokenDeltaPoints[1]?.deltaUsage.practicalBurn).toBe(250);
  });

  test("reads matching fixture files for a time window", async () => {
    const sessionReadResult = await readCodexSessions({
      sessionRootDirectory: fixtureRootDirectory,
      windowStart: new Date(2026, 2, 26, 0, 0, 0),
      windowEnd: new Date(2026, 2, 26, 23, 59, 59),
    });

    expect(sessionReadResult.sessions).toHaveLength(2);
    expect(sessionReadResult.sessions.map((session) => session.kind)).toEqual([
      "direct",
      "subagent",
    ]);
    expect(sessionReadResult.sessions[1]?.sourceFilePath).toBe(subagentFixturePath);
    expect(sessionReadResult.sessions[1]?.forkedFromSessionId).toBe(
      "fixture-direct-session-1",
    );
    expect(sessionReadResult.sessions[1]?.primaryModel).toBe("gpt-5.4-mini");
    expect(sessionReadResult.sessions[1]?.taskWindows[0]?.turnId).toBe("subagent-turn-1");
    expect(sessionReadResult.warnings).toEqual([]);
  });

  test("skips malformed session files and records warning metadata", async () => {
    const sessionRootDirectory = await mkdtemp(
      join(tmpdir(), "idletime-session-read-"),
    );
    const sessionDirectory = join(sessionRootDirectory, "2026", "03", "26");
    await mkdir(sessionDirectory, { recursive: true });

    await writeFile(
      join(sessionDirectory, "direct-session.jsonl"),
      await readFile(directFixturePath, "utf8"),
      "utf8",
    );
    await writeFile(
      join(sessionDirectory, "malformed-session.jsonl"),
      "{\"timestamp\":\"2026-03-26T19:50:00.000Z\",\"type\":\"event_msg\"",
      "utf8",
    );

    const sessionReadResult = await readCodexSessions({
      sessionRootDirectory,
      windowStart: new Date(2026, 2, 26, 0, 0, 0),
      windowEnd: new Date(2026, 2, 26, 23, 59, 59),
    });

    expect(sessionReadResult.sessions).toHaveLength(1);
    expect(sessionReadResult.sessions[0]?.sessionId).toBe(
      "fixture-direct-session-1",
    );
    expect(sessionReadResult.warnings).toHaveLength(1);
    expect(sessionReadResult.warnings[0]?.kind).toBe("malformed-session-file");
    expect(sessionReadResult.warnings[0]?.sourceFilePath).toBe(
      join(sessionDirectory, "malformed-session.jsonl"),
    );
    expect(typeof sessionReadResult.warnings[0]?.message).toBe("string");
  });

  test("uses last token usage when cumulative totals reset", () => {
    const tokenDeltaPoints = buildTokenDeltaPoints([
      createTokenPoint(
        "2026-03-26T19:34:10.000Z",
        createUsage(100, 0, 20, 120),
        createUsage(100, 0, 20, 120),
      ),
      createTokenPoint(
        "2026-03-26T19:40:10.000Z",
        createUsage(140, 0, 40, 180),
        createUsage(40, 0, 20, 60),
      ),
      createTokenPoint(
        "2026-03-26T19:41:10.000Z",
        createUsage(0, 0, 0, 950000),
        createUsage(0, 0, 0, 0),
      ),
      createTokenPoint(
        "2026-03-26T19:45:10.000Z",
        createUsage(25, 0, 15, 950040),
        createUsage(25, 0, 15, 40),
      ),
    ]);

    expect(tokenDeltaPoints.map((tokenDeltaPoint) => tokenDeltaPoint.deltaUsage.totalTokens))
      .toEqual([120, 60, 0, 40]);
    expect(tokenDeltaPoints.map((tokenDeltaPoint) => tokenDeltaPoint.deltaUsage.practicalBurn))
      .toEqual([120, 60, 0, 40]);
  });
});

function createTokenPoint(
  timestamp: string,
  usage: TokenUsage,
  lastUsage: TokenUsage | null,
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

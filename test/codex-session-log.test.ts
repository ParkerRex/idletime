import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildTokenDeltaPoints } from "../src/codex-session-log/extract-token-points.ts";
import { parseCodexSession } from "../src/codex-session-log/parse-codex-session.ts";
import { readCodexSessions } from "../src/codex-session-log/read-codex-sessions.ts";

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
    expect(parsedSession.finalTokenUsage?.practicalBurn).toBe(1050);
    expect(tokenDeltaPoints[0]?.deltaUsage.practicalBurn).toBe(800);
    expect(tokenDeltaPoints[1]?.deltaUsage.practicalBurn).toBe(250);
  });

  test("reads matching fixture files for a time window", async () => {
    const parsedSessions = await readCodexSessions({
      sessionRootDirectory: fixtureRootDirectory,
      windowStart: new Date(2026, 2, 26, 0, 0, 0),
      windowEnd: new Date(2026, 2, 26, 23, 59, 59),
    });

    expect(parsedSessions).toHaveLength(2);
    expect(parsedSessions.map((session) => session.kind)).toEqual([
      "direct",
      "subagent",
    ]);
    expect(parsedSessions[1]?.sourceFilePath).toBe(subagentFixturePath);
    expect(parsedSessions[1]?.forkedFromSessionId).toBe(
      "fixture-direct-session-1",
    );
    expect(parsedSessions[1]?.primaryModel).toBe("gpt-5.4-mini");
  });
});

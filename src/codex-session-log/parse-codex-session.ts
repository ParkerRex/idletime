import { readFile } from "node:fs/promises";
import {
  expectObject,
  readOptionalString,
  readString,
} from "./codex-log-values.ts";
import { classifySessionKind } from "./classify-session-kind.ts";
import { parseCodexLogLine } from "./codex-log-line.ts";
import { extractTokenPoints } from "./extract-token-points.ts";
import {
  extractTurnAttribution,
  resolvePrimaryModel,
  resolvePrimaryReasoningEffort,
} from "./extract-turn-attribution.ts";
import { extractTaskWindows } from "./task-windows.ts";
import { extractUserMessageTimestamps } from "./extract-user-message-timestamps.ts";
import type { ParsedSession } from "./types.ts";

export async function parseCodexSession(
  sourceFilePath: string,
): Promise<ParsedSession> {
  const rawFileText = await readFile(sourceFilePath, "utf8");
  const lineTexts = rawFileText
    .split("\n")
    .map((lineText) => lineText.trim())
    .filter((lineText) => lineText.length > 0);

  if (lineTexts.length === 0) {
    throw new Error(`${sourceFilePath} is empty.`);
  }

  const records = lineTexts.map((lineText, index) =>
    parseCodexLogLine(lineText, sourceFilePath, index + 1),
  );

  const sessionMetaRecord = records[0];
  if (!sessionMetaRecord || sessionMetaRecord.type !== "session_meta") {
    throw new Error(`${sourceFilePath} must start with a session_meta record.`);
  }

  const sessionMetaPayload = expectObject(
    sessionMetaRecord.payload,
    "session_meta.payload",
  );
  const firstRecord = records[0]!;
  const lastRecord = records[records.length - 1]!;
  const tokenPoints = extractTokenPoints(records);
  const userMessageTimestamps = extractUserMessageTimestamps(records);
  const { turnAttributions, agentSpawnRequests } =
    extractTurnAttribution(records);
  const sessionId = readString(
    sessionMetaPayload,
    "id",
    "session_meta.payload",
  );
  const cwd = readString(sessionMetaPayload, "cwd", "session_meta.payload");
  const forkedFromSessionId = readOptionalString(
    sessionMetaPayload,
    "forked_from_id",
  );
  const kind = classifySessionKind(sessionMetaPayload.source);
  const eventTimestamps = records
    .filter((record) => record.type !== "session_meta")
    .map((record) => record.timestamp);

  return {
    sessionId,
    sourceFilePath,
    cwd,
    kind,
    forkedFromSessionId,
    firstTimestamp: firstRecord.timestamp,
    lastTimestamp: lastRecord.timestamp,
    eventTimestamps:
      eventTimestamps.length > 0 ? eventTimestamps : [firstRecord.timestamp],
    tokenPoints,
    finalTokenUsage:
      tokenPoints.length > 0 ? tokenPoints[tokenPoints.length - 1]?.usage ?? null : null,
    userMessageTimestamps,
    turnAttributions,
    agentSpawnRequests,
    taskWindows: extractTaskWindows(records, {
      cwd,
      parentSessionId: forkedFromSessionId,
      sessionId,
      sessionKind: kind,
    }),
    primaryModel: resolvePrimaryModel(turnAttributions),
    primaryReasoningEffort:
      resolvePrimaryReasoningEffort(turnAttributions),
  };
}

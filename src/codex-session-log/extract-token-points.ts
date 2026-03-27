import { expectObject, readOptionalString } from "./codex-log-values.ts";
import { readTokenUsage, subtractTokenUsages } from "./token-usage.ts";
import type { CodexLogLine } from "./codex-log-line.ts";
import type { TokenDeltaPoint, TokenPoint } from "./types.ts";

export function extractTokenPoints(records: CodexLogLine[]): TokenPoint[] {
  const tokenPoints: TokenPoint[] = [];

  for (const record of records) {
    if (record.type !== "event_msg") {
      continue;
    }

    const payload = expectObject(record.payload, "event_msg.payload");
    if (readOptionalString(payload, "type") !== "token_count") {
      continue;
    }

    const info = payload.info;
    if (info === null || info === undefined) {
      continue;
    }

    const infoRecord = expectObject(info, "event_msg.payload.info");
    tokenPoints.push({
      timestamp: record.timestamp,
      usage: readTokenUsage(
        infoRecord.total_token_usage,
        "event_msg.payload.info.total_token_usage",
      ),
    });
  }

  return tokenPoints.sort(
    (leftPoint, rightPoint) =>
      leftPoint.timestamp.getTime() - rightPoint.timestamp.getTime(),
  );
}

export function buildTokenDeltaPoints(
  tokenPoints: TokenPoint[],
): TokenDeltaPoint[] {
  const deltaPoints: TokenDeltaPoint[] = [];
  let previousPoint: TokenPoint | null = null;

  for (const tokenPoint of tokenPoints) {
    deltaPoints.push({
      timestamp: tokenPoint.timestamp,
      cumulativeUsage: tokenPoint.usage,
      deltaUsage: previousPoint
        ? subtractTokenUsages(tokenPoint.usage, previousPoint.usage)
        : tokenPoint.usage,
    });

    previousPoint = tokenPoint;
  }

  return deltaPoints;
}

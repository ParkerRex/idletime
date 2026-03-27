import { expectObject, readOptionalString } from "./codex-log-values.ts";
import {
  readTokenUsage,
  subtractTokenUsages,
  zeroTokenUsage,
} from "./token-usage.ts";
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
    const lastUsageValue = infoRecord.last_token_usage;
    tokenPoints.push({
      timestamp: record.timestamp,
      usage: readTokenUsage(
        infoRecord.total_token_usage,
        "event_msg.payload.info.total_token_usage",
      ),
      lastUsage:
        lastUsageValue === null || lastUsageValue === undefined
          ? null
          : readTokenUsage(
              lastUsageValue,
              "event_msg.payload.info.last_token_usage",
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
      deltaUsage: resolveTokenDeltaUsage(tokenPoint, previousPoint),
    });

    previousPoint = tokenPoint;
  }

  return deltaPoints;
}

function resolveTokenDeltaUsage(
  tokenPoint: TokenPoint,
  previousPoint: TokenPoint | null,
) {
  // Modern Codex logs emit the per-event delta directly, while cumulative totals
  // can reset between tasks inside a long-lived session.
  if (tokenPoint.lastUsage) {
    return tokenPoint.lastUsage;
  }

  if (!previousPoint) {
    return tokenPoint.usage;
  }

  return subtractTokenUsages(tokenPoint.usage, previousPoint.usage)
    ?? zeroTokenUsage();
}

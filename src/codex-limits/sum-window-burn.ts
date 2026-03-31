import { buildTokenDeltaPoints } from "../codex-session-log/extract-token-points.ts";
import type { ParsedSession } from "../codex-session-log/types.ts";
import type { DateInterval } from "./types.ts";

export function sumWindowBurn(
  sessions: ParsedSession[],
  interval: DateInterval,
): number {
  let totalBurn = 0;

  for (const session of sessions) {
    for (const tokenDeltaPoint of buildTokenDeltaPoints(session.tokenPoints)) {
      const timestampMs = tokenDeltaPoint.timestamp.getTime();
      if (
        timestampMs < interval.start.getTime() ||
        timestampMs >= interval.end.getTime()
      ) {
        continue;
      }

      totalBurn += tokenDeltaPoint.deltaUsage.practicalBurn;
    }
  }

  return totalBurn;
}

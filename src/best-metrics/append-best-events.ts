import { appendFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { BestEvent, BestLedgerWriteOptions } from "./types.ts";

const bestEventsFileName = "best-events.ndjson";

export async function appendBestEvents(
  bestEvents: BestEvent[],
  options: BestLedgerWriteOptions = {},
): Promise<void> {
  if (bestEvents.length === 0) {
    return;
  }

  const stateDirectory = resolveBestStateDirectory(options);
  await mkdir(stateDirectory, { recursive: true });
  await appendFile(
    join(stateDirectory, bestEventsFileName),
    `${bestEvents.map(serializeBestEvent).join("\n")}\n`,
    "utf8",
  );
}

export function resolveBestEventsPath(
  options: BestLedgerWriteOptions = {},
): string {
  return join(resolveBestStateDirectory(options), bestEventsFileName);
}

function serializeBestEvent(bestEvent: BestEvent): string {
  return JSON.stringify({
    metric: bestEvent.metric,
    previousValue: bestEvent.previousValue,
    value: bestEvent.value,
    observedAt: bestEvent.observedAt.toISOString(),
    windowStart: bestEvent.windowStart.toISOString(),
    windowEnd: bestEvent.windowEnd.toISOString(),
    version: bestEvent.version,
  });
}

function resolveBestStateDirectory(
  options: BestLedgerWriteOptions,
): string {
  return options.stateDirectory ?? join(homedir(), ".idletime");
}

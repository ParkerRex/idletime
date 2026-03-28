import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  expectObject,
  readIsoTimestamp,
  readNumber,
} from "../codex-session-log/codex-log-values.ts";
import type {
  BestLedgerReadOptions,
  BestMetricKey,
  BestMetricRecord,
  BestMetricsLedger,
  SerializedBestMetricsLedger,
} from "./types.ts";
import { bestMetricsLedgerVersion } from "./types.ts";

const bestLedgerFileName = "bests-v1.json";

export async function readBestLedger(
  options: BestLedgerReadOptions = {},
): Promise<BestMetricsLedger | null> {
  try {
    const rawLedgerText = await readFile(resolveBestLedgerPath(options), "utf8");
    return parseBestLedger(JSON.parse(rawLedgerText));
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

export function parseBestLedger(value: unknown): BestMetricsLedger {
  const ledgerRecord = expectObject(value, "bestMetricsLedger");
  const version = readNumber(ledgerRecord, "version", "bestMetricsLedger");
  if (version !== bestMetricsLedgerVersion) {
    throw new Error(
      `bestMetricsLedger.version must be ${bestMetricsLedgerVersion}.`,
    );
  }

  return {
    version: bestMetricsLedgerVersion,
    initializedAt: readIsoTimestamp(
      ledgerRecord.initializedAt,
      "bestMetricsLedger.initializedAt",
    ),
    lastScannedAt: readIsoTimestamp(
      ledgerRecord.lastScannedAt,
      "bestMetricsLedger.lastScannedAt",
    ),
    bestConcurrentAgents: parseBestMetricRecord(
      ledgerRecord.bestConcurrentAgents,
      "bestMetricsLedger.bestConcurrentAgents",
    ),
    best24hRawBurn: parseBestMetricRecord(
      ledgerRecord.best24hRawBurn,
      "bestMetricsLedger.best24hRawBurn",
    ),
    best24hAgentSumMs: parseBestMetricRecord(
      ledgerRecord.best24hAgentSumMs,
      "bestMetricsLedger.best24hAgentSumMs",
    ),
  };
}

export function resolveBestLedgerPath(
  options: BestLedgerReadOptions = {},
): string {
  return join(resolveBestStateDirectory(options), bestLedgerFileName);
}

export function serializeBestLedger(ledger: BestMetricsLedger): string {
  const serializedLedger: SerializedBestMetricsLedger = {
    version: ledger.version,
    initializedAt: ledger.initializedAt.toISOString(),
    lastScannedAt: ledger.lastScannedAt.toISOString(),
    bestConcurrentAgents: serializeBestMetricRecord(ledger.bestConcurrentAgents),
    best24hRawBurn: serializeBestMetricRecord(ledger.best24hRawBurn),
    best24hAgentSumMs: serializeBestMetricRecord(ledger.best24hAgentSumMs),
  };

  return `${JSON.stringify(serializedLedger, null, 2)}\n`;
}

function parseBestMetricRecord(
  value: unknown,
  label: string,
): BestMetricRecord | null {
  if (value === null || value === undefined) {
    return null;
  }

  const record = expectObject(value, label);

  return {
    value: readNumber(record, "value", label),
    observedAt: readIsoTimestamp(record.observedAt, `${label}.observedAt`),
    windowStart: readIsoTimestamp(record.windowStart, `${label}.windowStart`),
    windowEnd: readIsoTimestamp(record.windowEnd, `${label}.windowEnd`),
  };
}

function serializeBestMetricRecord(
  record: BestMetricRecord | null,
) {
  if (!record) {
    return null;
  }

  return {
    value: record.value,
    observedAt: record.observedAt.toISOString(),
    windowStart: record.windowStart.toISOString(),
    windowEnd: record.windowEnd.toISOString(),
  };
}

function resolveBestStateDirectory(
  options: BestLedgerReadOptions,
): string {
  return options.stateDirectory ?? join(homedir(), ".idletime");
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

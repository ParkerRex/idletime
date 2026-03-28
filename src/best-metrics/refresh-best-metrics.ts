import { buildCurrentBestMetricValues } from "./build-current-best-metrics.ts";
import { appendBestEvents } from "./append-best-events.ts";
import { buildBestMetricCandidates } from "./build-best-metrics.ts";
import { readAllCodexSessions } from "./read-all-codex-sessions.ts";
import { readBestLedger } from "./read-best-ledger.ts";
import type {
  BestEvent,
  BestLedgerReadOptions,
  BestMetricCandidates,
  BestMetricKey,
  BestMetricRecord,
  BestMetricsLedger,
  CurrentBestMetricValues,
} from "./types.ts";
import { bestMetricsLedgerVersion } from "./types.ts";
import { writeBestLedger } from "./write-best-ledger.ts";

type RefreshBestMetricsOptions = BestLedgerReadOptions & {
  now?: Date;
  sessionRootDirectory?: string;
};

export type RefreshBestMetricsResult = {
  currentMetrics: CurrentBestMetricValues;
  ledger: BestMetricsLedger;
  newBestEvents: BestEvent[];
  refreshMode: "bootstrap" | "refresh";
};

export async function refreshBestMetrics(
  options: RefreshBestMetricsOptions = {},
): Promise<RefreshBestMetricsResult> {
  const refreshedAt = options.now ?? new Date();
  const existingLedger = await readBestLedger(options);
  const sessions = await readAllCodexSessions({
    sessionRootDirectory: options.sessionRootDirectory,
  });
  const bestMetricCandidates = buildBestMetricCandidates(sessions);
  const currentMetrics = buildCurrentBestMetricValues(sessions, {
    now: refreshedAt,
  });

  if (!existingLedger) {
    const bootstrappedLedger = {
      version: bestMetricsLedgerVersion,
      initializedAt: refreshedAt,
      lastScannedAt: refreshedAt,
      ...bestMetricCandidates,
    } satisfies BestMetricsLedger;
    await writeBestLedger(bootstrappedLedger, options);

    return {
      currentMetrics,
      ledger: bootstrappedLedger,
      newBestEvents: [],
      refreshMode: "bootstrap",
    };
  }

  const newBestEvents = buildNewBestEvents(existingLedger, bestMetricCandidates);
  const refreshedLedger = {
    ...existingLedger,
    lastScannedAt: refreshedAt,
    ...mergeBestMetricCandidates(existingLedger, bestMetricCandidates),
  };
  await writeBestLedger(refreshedLedger, options);
  await appendBestEvents(newBestEvents, options);

  return {
    currentMetrics,
    ledger: refreshedLedger,
    newBestEvents,
    refreshMode: "refresh",
  };
}

function mergeBestMetricCandidates(
  currentLedger: BestMetricsLedger,
  candidateLedger: BestMetricCandidates,
): BestMetricCandidates {
  return {
    bestConcurrentAgents: pickBetterRecord(
      currentLedger.bestConcurrentAgents,
      candidateLedger.bestConcurrentAgents,
    ),
    best24hRawBurn: pickBetterRecord(
      currentLedger.best24hRawBurn,
      candidateLedger.best24hRawBurn,
    ),
    best24hAgentSumMs: pickBetterRecord(
      currentLedger.best24hAgentSumMs,
      candidateLedger.best24hAgentSumMs,
    ),
  };
}

function pickBetterRecord(
  currentRecord: BestMetricRecord | null,
  candidateRecord: BestMetricRecord | null,
): BestMetricRecord | null {
  if (!candidateRecord) {
    return currentRecord;
  }

  if (!currentRecord || candidateRecord.value > currentRecord.value) {
    return candidateRecord;
  }

  return currentRecord;
}

function buildNewBestEvents(
  currentLedger: BestMetricsLedger,
  candidateLedger: BestMetricCandidates,
): BestEvent[] {
  return [
    buildNewBestEvent(
      "bestConcurrentAgents",
      currentLedger.bestConcurrentAgents,
      candidateLedger.bestConcurrentAgents,
    ),
    buildNewBestEvent(
      "best24hRawBurn",
      currentLedger.best24hRawBurn,
      candidateLedger.best24hRawBurn,
    ),
    buildNewBestEvent(
      "best24hAgentSumMs",
      currentLedger.best24hAgentSumMs,
      candidateLedger.best24hAgentSumMs,
    ),
  ].flatMap((bestEvent) => (bestEvent ? [bestEvent] : []));
}

function buildNewBestEvent(
  metric: BestMetricKey,
  currentRecord: BestMetricRecord | null,
  candidateRecord: BestMetricRecord | null,
): BestEvent | null {
  if (
    !candidateRecord ||
    (currentRecord !== null && candidateRecord.value <= currentRecord.value)
  ) {
    return null;
  }

  return {
    metric,
    previousValue: currentRecord?.value ?? null,
    value: candidateRecord.value,
    observedAt: candidateRecord.observedAt,
    windowStart: candidateRecord.windowStart,
    windowEnd: candidateRecord.windowEnd,
    version: bestMetricsLedgerVersion,
  };
}

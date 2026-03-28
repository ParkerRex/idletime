import { writeBestLedger } from "./write-best-ledger.ts";
import { deliverLocalNotifications } from "./notification-delivery.ts";
import type {
  BestLedgerWriteOptions,
  BestMetricKey,
  BestMetricsLedger,
  CurrentBestMetricValues,
} from "./types.ts";
import type { NotificationDeliveryOptions, NotificationPayload } from "./notification-delivery.ts";
import { appendBestEvents } from "./append-best-events.ts";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  expectObject,
  readIsoTimestamp,
  readNumber,
} from "../codex-session-log/codex-log-values.ts";

const nearBestNotificationStateFileName = "near-best-notifications-v1.json";
const nearBestNotificationVersion = 1;

type NearBestNotificationState = {
  version: number;
  nearBestEnabled: boolean;
  thresholdRatio: number;
  cooldownMs: number;
  lastNotifiedAt: Record<BestMetricKey, Date | null>;
};

type NotifyNearBestMetricsOptions = BestLedgerWriteOptions &
  NotificationDeliveryOptions & {
    now?: Date;
  };

export async function notifyNearBestMetrics(
  currentMetrics: CurrentBestMetricValues,
  ledger: BestMetricsLedger,
  options: NotifyNearBestMetricsOptions = {},
): Promise<BestMetricKey[]> {
  const now = options.now ?? new Date();
  const state = await ensureNearBestNotificationState(options);
  if (!state.nearBestEnabled) {
    return [];
  }

  const metricsToNotify = buildNearBestMetricKeys(currentMetrics, ledger, state, now);
  if (metricsToNotify.length === 0) {
    return [];
  }

  const nextState: NearBestNotificationState = {
    ...state,
    lastNotifiedAt: {
      ...state.lastNotifiedAt,
      ...Object.fromEntries(metricsToNotify.map((metric) => [metric, now])),
    },
  };
  await writeNearBestNotificationState(nextState, options);
  await deliverLocalNotifications(
    metricsToNotify.map((metric) =>
      buildNearBestNotification(metric, currentMetrics[metric], ledger[metric]?.value ?? 0)
    ),
    options,
  );

  return metricsToNotify;
}

async function ensureNearBestNotificationState(
  options: BestLedgerWriteOptions,
): Promise<NearBestNotificationState> {
  const existingState = await readNearBestNotificationState(options);
  if (existingState) {
    return existingState;
  }

  const defaultState = createDefaultNearBestNotificationState();
  await writeNearBestNotificationState(defaultState, options);
  return defaultState;
}

async function readNearBestNotificationState(
  options: BestLedgerWriteOptions,
): Promise<NearBestNotificationState | null> {
  try {
    const rawStateText = await readFile(resolveNearBestNotificationStatePath(options), "utf8");
    return parseNearBestNotificationState(JSON.parse(rawStateText));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

function parseNearBestNotificationState(value: unknown): NearBestNotificationState {
  const stateRecord = expectObject(value, "nearBestNotificationState");
  const version = readNumber(
    stateRecord,
    "version",
    "nearBestNotificationState",
  );
  if (version !== nearBestNotificationVersion) {
    throw new Error(
      `nearBestNotificationState.version must be ${nearBestNotificationVersion}.`,
    );
  }

  const lastNotifiedAtRecord = expectObject(
    stateRecord.lastNotifiedAt,
    "nearBestNotificationState.lastNotifiedAt",
  );

  return {
    version,
    nearBestEnabled: Boolean(stateRecord.nearBestEnabled),
    thresholdRatio: readNumber(
      stateRecord,
      "thresholdRatio",
      "nearBestNotificationState",
    ),
    cooldownMs: readNumber(
      stateRecord,
      "cooldownMs",
      "nearBestNotificationState",
    ),
    lastNotifiedAt: {
      bestConcurrentAgents: readOptionalIsoTimestamp(
        lastNotifiedAtRecord.bestConcurrentAgents,
        "nearBestNotificationState.lastNotifiedAt.bestConcurrentAgents",
      ),
      best24hRawBurn: readOptionalIsoTimestamp(
        lastNotifiedAtRecord.best24hRawBurn,
        "nearBestNotificationState.lastNotifiedAt.best24hRawBurn",
      ),
      best24hAgentSumMs: readOptionalIsoTimestamp(
        lastNotifiedAtRecord.best24hAgentSumMs,
        "nearBestNotificationState.lastNotifiedAt.best24hAgentSumMs",
      ),
    },
  };
}

async function writeNearBestNotificationState(
  state: NearBestNotificationState,
  options: BestLedgerWriteOptions,
): Promise<void> {
  const statePath = resolveNearBestNotificationStatePath(options);
  const stateDirectory = options.stateDirectory ?? join(homedir(), ".idletime");
  await mkdir(stateDirectory, { recursive: true });
  const temporaryPath = join(
    stateDirectory,
    `.near-best-notifications.${process.pid}.${Date.now()}.tmp`,
  );
  await writeFile(
    temporaryPath,
    `${JSON.stringify(
      {
        version: state.version,
        nearBestEnabled: state.nearBestEnabled,
        thresholdRatio: state.thresholdRatio,
        cooldownMs: state.cooldownMs,
        lastNotifiedAt: {
          bestConcurrentAgents: state.lastNotifiedAt.bestConcurrentAgents?.toISOString() ?? null,
          best24hRawBurn: state.lastNotifiedAt.best24hRawBurn?.toISOString() ?? null,
          best24hAgentSumMs: state.lastNotifiedAt.best24hAgentSumMs?.toISOString() ?? null,
        },
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await rename(temporaryPath, statePath);
}

function buildNearBestMetricKeys(
  currentMetrics: CurrentBestMetricValues,
  ledger: BestMetricsLedger,
  state: NearBestNotificationState,
  now: Date,
): BestMetricKey[] {
  return ([
    "bestConcurrentAgents",
    "best24hRawBurn",
    "best24hAgentSumMs",
  ] as BestMetricKey[]).filter((metric) => {
    const bestValue = ledger[metric]?.value ?? 0;
    if (bestValue <= 0) {
      return false;
    }

    const currentValue = currentMetrics[metric];
    if (currentValue <= 0 || currentValue >= bestValue) {
      return false;
    }

    if (currentValue / bestValue < state.thresholdRatio) {
      return false;
    }

    const lastNotifiedAt = state.lastNotifiedAt[metric];
    return (
      lastNotifiedAt === null ||
      now.getTime() - lastNotifiedAt.getTime() >= state.cooldownMs
    );
  });
}

function buildNearBestNotification(
  metric: BestMetricKey,
  currentValue: number,
  bestValue: number,
): NotificationPayload {
  return {
    title:
      metric === "bestConcurrentAgents"
        ? "Close to best concurrent agents"
        : metric === "best24hRawBurn"
          ? "Close to best 24hr raw burn"
          : "Close to best agent sum",
    body:
      metric === "bestConcurrentAgents"
        ? `${formatInteger(currentValue)} of ${formatInteger(bestValue)} concurrent agents`
        : metric === "best24hRawBurn"
          ? `${formatCompactInteger(currentValue)} of ${formatCompactInteger(bestValue)} 24hr raw burn`
          : `${formatAgentSumHours(currentValue)} of ${formatAgentSumHours(bestValue)} agent sum`,
  };
}

function createDefaultNearBestNotificationState(): NearBestNotificationState {
  return {
    version: nearBestNotificationVersion,
    nearBestEnabled: false,
    thresholdRatio: 0.97,
    cooldownMs: 24 * 60 * 60 * 1000,
    lastNotifiedAt: {
      bestConcurrentAgents: null,
      best24hRawBurn: null,
      best24hAgentSumMs: null,
    },
  };
}

function resolveNearBestNotificationStatePath(
  options: BestLedgerWriteOptions,
): string {
  return join(
    options.stateDirectory ?? join(homedir(), ".idletime"),
    nearBestNotificationStateFileName,
  );
}

function readOptionalIsoTimestamp(value: unknown, label: string): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  return readIsoTimestamp(value, label);
}

function formatAgentSumHours(durationMs: number): string {
  const hours = durationMs / 3_600_000;
  return hours >= 10
    ? Math.round(hours).toString()
    : (Math.round(hours * 10) / 10).toString();
}

function formatCompactInteger(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value)).toUpperCase();
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

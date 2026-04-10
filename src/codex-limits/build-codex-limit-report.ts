import { parseDurationToMs } from "../report-window/parse-duration.ts";
import { readCodexRateLimits } from "./read-codex-rate-limits.ts";
import { sumWindowBurn } from "./sum-window-burn.ts";
import type {
  BurnEstimate,
  CodexLimitReport,
  CodexLimitReportInput,
  CodexLimitWindowSnapshot,
  DateInterval,
  LimitMetric,
  NormalizedCodexRateLimits,
} from "./types.ts";

export async function buildCodexLimitReport(
  input: CodexLimitReportInput,
): Promise<CodexLimitReport> {
  const readRateLimits = input.readRateLimits ?? readCodexRateLimits;
  const rateLimits = await readRateLimits({ now: input.now });

  const todayWindow = buildTodayWindow(input.now);
  const lastHourWindow = buildInterval(
    new Date(input.now.getTime() - parseDurationToMs("1h")),
    input.now,
  );
  const weeklyCalibrationWindow = buildQuotaWindowInterval(
    rateLimits.weeklyWindow,
    input.now,
  );
  const fiveHourCalibrationWindow = buildQuotaWindowInterval(
    rateLimits.fiveHourWindow,
    input.now,
  );

  const todayBurnTokens = sumWindowBurn(input.sessions, todayWindow);
  const lastHourBurnTokens = sumWindowBurn(input.sessions, lastHourWindow);
  const todayCalibrationBurnTokens = weeklyCalibrationWindow
    ? sumWindowBurn(input.sessions, weeklyCalibrationWindow)
    : 0;
  const lastHourCalibrationBurnTokens = fiveHourCalibrationWindow
    ? sumWindowBurn(input.sessions, fiveHourCalibrationWindow)
    : 0;

  return {
    fetchedAt: rateLimits.fetchedAt,
    fiveHourRemaining: buildLimitMetric(rateLimits.fiveHourWindow),
    fiveHourWindowBurnTokens: lastHourCalibrationBurnTokens,
    lastHourBurnTokens,
    lastHourFiveHourBurn: buildBurnEstimate(
      rateLimits.fiveHourWindow,
      lastHourBurnTokens,
      lastHourCalibrationBurnTokens,
    ),
    source: rateLimits.source,
    todayBurnTokens,
    todayWeeklyBurn: buildBurnEstimate(
      rateLimits.weeklyWindow,
      todayBurnTokens,
      todayCalibrationBurnTokens,
    ),
    weeklyRemaining: buildLimitMetric(rateLimits.weeklyWindow),
    weeklyWindowBurnTokens: todayCalibrationBurnTokens,
  };
}

export function resolveCodexLimitLookbackStart(options: {
  defaultStart: Date;
  now: Date;
  rateLimits: NormalizedCodexRateLimits;
}): Date {
  const candidateTimestamps = [
    options.defaultStart.getTime(),
    options.now.getTime() - parseDurationToMs("1h"),
    options.now.getTime() - parseDurationToMs("7d"),
  ];

  if (options.rateLimits.weeklyWindow) {
    candidateTimestamps.push(
      options.rateLimits.weeklyWindow.resetsAt.getTime() -
        options.rateLimits.weeklyWindow.windowDurationMins * 60_000,
    );
  }

  if (options.rateLimits.fiveHourWindow) {
    candidateTimestamps.push(
      options.rateLimits.fiveHourWindow.resetsAt.getTime() -
        options.rateLimits.fiveHourWindow.windowDurationMins * 60_000,
    );
  }

  return new Date(Math.min(...candidateTimestamps));
}

function buildLimitMetric(
  window: CodexLimitWindowSnapshot | null,
): LimitMetric {
  if (!window) {
    return {
      kind: "unavailable",
      reason: "missing-rate-limit",
    };
  }

  return {
    kind: "available",
    resetsAt: window.resetsAt,
    remainingPercent: window.remainingPercent,
    usedPercent: window.usedPercent,
    windowDurationMins: window.windowDurationMins,
  };
}

function buildBurnEstimate(
  window: CodexLimitWindowSnapshot | null,
  localBurnTokens: number,
  calibrationWindowBurnTokens: number,
): BurnEstimate {
  if (!window) {
    return {
      kind: "unavailable",
      reason: "missing-rate-limit",
    };
  }

  if (window.usedPercent <= 0) {
    return {
      kind: "unavailable",
      reason: "zero-used-percent",
    };
  }

  if (localBurnTokens <= 0) {
    return {
      kind: "unavailable",
      reason: "zero-local-burn",
    };
  }

  if (calibrationWindowBurnTokens <= 0) {
    return {
      kind: "unavailable",
      reason: "zero-calibration-window-burn",
    };
  }

  return {
    kind: "estimated",
    calibrationWindowBurnTokens,
    localBurnTokens,
    percentPoints:
      (window.usedPercent * localBurnTokens) / calibrationWindowBurnTokens,
  };
}

function buildQuotaWindowInterval(
  window: CodexLimitWindowSnapshot | null,
  now: Date,
): DateInterval | null {
  if (!window) {
    return null;
  }

  return {
    start: new Date(
      window.resetsAt.getTime() - window.windowDurationMins * 60_000,
    ),
    end: now,
  };
}

function buildInterval(start: Date, end: Date): DateInterval {
  return { start, end };
}

function buildTodayWindow(now: Date): DateInterval {
  return {
    start: new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    ),
    end: now,
  };
}

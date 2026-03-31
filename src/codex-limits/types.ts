import type { ParsedSession } from "../codex-session-log/types.ts";

export type CodexLimitSource =
  | "app-server"
  | "status-fallback"
  | "fixture"
  | "unavailable";

export type CodexLimitWindowSnapshot = {
  resetsAt: Date;
  remainingPercent: number;
  usedPercent: number;
  windowDurationMins: number;
};

export type DateInterval = {
  start: Date;
  end: Date;
};

export type LimitMetric =
  | {
      kind: "available";
      resetsAt: Date;
      remainingPercent: number;
      usedPercent: number;
      windowDurationMins: number;
    }
  | {
      kind: "unavailable";
      reason:
        | "missing-rate-limit"
        | "probe-failed"
        | "status-unavailable"
        | "fixture-missing";
    };

export type BurnEstimate =
  | {
      kind: "estimated";
      calibrationWindowBurnTokens: number;
      localBurnTokens: number;
      percentPoints: number;
    }
  | {
      kind: "unavailable";
      reason:
        | "missing-rate-limit"
        | "zero-used-percent"
        | "zero-local-burn"
        | "zero-calibration-window-burn";
    };

export type NormalizedCodexRateLimits = {
  availability: "available" | "unavailable";
  fetchedAt: Date;
  fiveHourWindow: CodexLimitWindowSnapshot | null;
  reason?: string;
  source: CodexLimitSource;
  weeklyWindow: CodexLimitWindowSnapshot | null;
};

export type CodexLimitReport = {
  fetchedAt: Date;
  fiveHourRemaining: LimitMetric;
  fiveHourWindowBurnTokens: number;
  lastHourBurnTokens: number;
  lastHourFiveHourBurn: BurnEstimate;
  source: CodexLimitSource;
  todayBurnTokens: number;
  todayWeeklyBurn: BurnEstimate;
  weeklyRemaining: LimitMetric;
  weeklyWindowBurnTokens: number;
};

export type CodexLimitReportInput = {
  now: Date;
  sessions: ParsedSession[];
  readRateLimits?: ReadCodexRateLimitsFn;
};

export type ReadCodexRateLimitsFn = (
  options?: ReadCodexRateLimitsOptions,
) => Promise<NormalizedCodexRateLimits>;

export type ReadCodexRateLimitsOptions = {
  env?: Record<string, string | undefined>;
  now?: Date;
  readStatusText?: () => Promise<string>;
  runAppServer?: AppServerRunner;
  timeoutMs?: number;
};

export type AppServerRunner = (request: {
  input: string;
  timeoutMs: number;
  env?: Record<string, string | undefined>;
}) => Promise<string>;

export type CodexStatusRateLimits = {
  fetchedAt: Date;
  fiveHourWindow: CodexLimitWindowSnapshot | null;
  weeklyWindow: CodexLimitWindowSnapshot | null;
};

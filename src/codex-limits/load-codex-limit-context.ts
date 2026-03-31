import { readCodexSessions } from "../codex-session-log/read-codex-sessions.ts";
import type { SessionReadResult } from "../codex-session-log/types.ts";
import {
  buildCodexLimitReport,
  resolveCodexLimitLookbackStart,
} from "./build-codex-limit-report.ts";
import { readCodexRateLimits } from "./read-codex-rate-limits.ts";
import type { CodexLimitReport, ReadCodexRateLimitsFn } from "./types.ts";

export type CodexLimitContext = SessionReadResult & {
  codexLimitReport: CodexLimitReport;
};

export async function loadCodexLimitContext(options: {
  now: Date;
  readRateLimits?: ReadCodexRateLimitsFn;
  rateLimitEnv?: Record<string, string | undefined>;
  sessionRootDirectory?: string;
  summaryWindowStart: Date;
}): Promise<CodexLimitContext> {
  const readRateLimits = options.readRateLimits ?? ((readOptions) =>
    readCodexRateLimits({
      ...readOptions,
      env: options.rateLimitEnv ?? readOptions?.env,
    }));
  const rateLimits = await readRateLimits({ now: options.now });
  const sessionWindowStart = resolveCodexLimitLookbackStart({
    defaultStart: options.summaryWindowStart,
    now: options.now,
    rateLimits,
  });
  const sessionReadResult = await readCodexSessions({
    sessionRootDirectory: options.sessionRootDirectory,
    windowEnd: options.now,
    windowStart: sessionWindowStart,
  });

  return {
    ...sessionReadResult,
    codexLimitReport: await buildCodexLimitReport({
      now: options.now,
      readRateLimits: async () => rateLimits,
      sessions: sessionReadResult.sessions,
    }),
  };
}

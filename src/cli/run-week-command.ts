import type { BestMetricsLedger } from "../best-metrics/types.ts";
import { readBestLedger } from "../best-metrics/read-best-ledger.ts";
import { loadCodexLimitContext } from "../codex-limits/load-codex-limit-context.ts";
import { resolveWeekReportWindow } from "../report-window/resolve-report-window.ts";
import { buildBestPlaque } from "../reporting/render-best-plaque.ts";
import { buildSummaryReport } from "../reporting/build-summary-report.ts";
import { createRenderOptions } from "../reporting/render-theme.ts";
import { renderWeekReport } from "../reporting/render-week-report.ts";
import type { SummaryReport } from "../reporting/types.ts";
import type { ReadCodexRateLimitsFn } from "../codex-limits/types.ts";
import type { ParsedIdletimeCommand } from "./parse-idletime-command.ts";

export type WeekCommandResult = {
  bestLedger: BestMetricsLedger | null;
  summaryReport: SummaryReport;
};

export async function buildWeekCommandResult(
  command: ParsedIdletimeCommand,
  options: {
    now?: Date;
    rateLimitEnv?: Record<string, string | undefined>;
    readCodexRateLimits?: ReadCodexRateLimitsFn;
    sessionRootDirectory?: string;
    stateDirectory?: string;
  } = {},
): Promise<WeekCommandResult> {
  const window = resolveWeekReportWindow({ now: options.now });
  const bestLedgerPromise = readBestLedger({ stateDirectory: options.stateDirectory });
  const codexLimitContextPromise = loadCodexLimitContext({
    now: window.end,
    rateLimitEnv: options.rateLimitEnv,
    readRateLimits: options.readCodexRateLimits,
    sessionRootDirectory: options.sessionRootDirectory,
    summaryWindowStart: window.start,
  });
  const [bestLedger, codexLimitContext] = await Promise.all([
    bestLedgerPromise,
    codexLimitContextPromise,
  ]);
  const { codexLimitReport, sessions, warnings } = codexLimitContext;

  return {
    bestLedger,
    summaryReport: buildSummaryReport(sessions, {
      codexLimitReport,
      filters: command.filters,
      groupBy: command.groupBy,
      idleCutoffMs: command.idleCutoffMs,
      sessionReadWarnings: warnings,
      wakeWindow: command.wakeWindow,
      window,
    }),
  };
}

export async function runWeekCommand(
  command: ParsedIdletimeCommand,
  options: {
    now?: Date;
    rateLimitEnv?: Record<string, string | undefined>;
    readCodexRateLimits?: ReadCodexRateLimitsFn;
    sessionRootDirectory?: string;
    stateDirectory?: string;
  } = {},
): Promise<string> {
  const commandResult = await buildWeekCommandResult(command, options);

  return renderWeekReport(
    commandResult.summaryReport,
    createRenderOptions(command.shareMode),
    commandResult.bestLedger ? buildBestPlaque(commandResult.bestLedger) : null,
  );
}

import type { BestMetricsLedger } from "../best-metrics/types.ts";
import { readBestLedger } from "../best-metrics/read-best-ledger.ts";
import { loadCodexLimitContext } from "../codex-limits/load-codex-limit-context.ts";
import { resolveTrailingReportWindow } from "../report-window/resolve-report-window.ts";
import { buildHourlyReport } from "../reporting/build-hourly-report.ts";
import { buildBestPlaque } from "../reporting/render-best-plaque.ts";
import { buildSummaryReport } from "../reporting/build-summary-report.ts";
import { renderSummaryReport } from "../reporting/render-summary-report.ts";
import { createRenderOptions } from "../reporting/render-theme.ts";
import type { HourlyReport, SummaryReport } from "../reporting/types.ts";
import type { ReadCodexRateLimitsFn } from "../codex-limits/types.ts";
import type { ParsedIdletimeCommand } from "./parse-idletime-command.ts";

export type Last24hCommandResult = {
  bestLedger: BestMetricsLedger | null;
  hourlyReport: HourlyReport;
  summaryReport: SummaryReport;
};

export async function buildLast24hCommandResult(
  command: ParsedIdletimeCommand,
  options: {
    now?: Date;
    rateLimitEnv?: Record<string, string | undefined>;
    readCodexRateLimits?: ReadCodexRateLimitsFn;
    sessionRootDirectory?: string;
    stateDirectory?: string;
  } = {},
): Promise<Last24hCommandResult> {
  const window = resolveTrailingReportWindow({
    durationMs: command.hourlyWindowMs,
    now: options.now,
  });
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
  const summaryReport = buildSummaryReport(sessions, {
    codexLimitReport,
    filters: command.filters,
    groupBy: command.groupBy,
    idleCutoffMs: command.idleCutoffMs,
    sessionReadWarnings: warnings,
    wakeWindow: command.wakeWindow,
    window,
  });
  const hourlyReport = buildHourlyReport(sessions, {
    filters: command.filters,
    idleCutoffMs: command.idleCutoffMs,
    sessionReadWarnings: warnings,
    wakeWindow: command.wakeWindow,
    window,
  });

  return {
    bestLedger,
    hourlyReport,
    summaryReport,
  };
}

export async function runLast24hCommand(
  command: ParsedIdletimeCommand,
  options: {
    now?: Date;
    rateLimitEnv?: Record<string, string | undefined>;
    readCodexRateLimits?: ReadCodexRateLimitsFn;
    sessionRootDirectory?: string;
    stateDirectory?: string;
  } = {},
): Promise<string> {
  const commandResult = await buildLast24hCommandResult(command, options);

  return renderSummaryReport(
    commandResult.summaryReport,
    createRenderOptions(command.shareMode),
    commandResult.hourlyReport,
    commandResult.bestLedger ? buildBestPlaque(commandResult.bestLedger) : null,
  );
}

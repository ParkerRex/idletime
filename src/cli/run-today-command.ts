import { readCodexSessions } from "../codex-session-log/read-codex-sessions.ts";
import type { BestMetricsLedger } from "../best-metrics/types.ts";
import { readBestLedger } from "../best-metrics/read-best-ledger.ts";
import { resolveTodayReportWindow } from "../report-window/resolve-report-window.ts";
import { buildBestPlaque } from "../reporting/render-best-plaque.ts";
import { buildSummaryReport } from "../reporting/build-summary-report.ts";
import { renderSummaryReport } from "../reporting/render-summary-report.ts";
import { createRenderOptions } from "../reporting/render-theme.ts";
import type { SummaryReport } from "../reporting/types.ts";
import type { ParsedIdletimeCommand } from "./parse-idletime-command.ts";

export type TodayCommandResult = {
  bestLedger: BestMetricsLedger | null;
  summaryReport: SummaryReport;
};

export async function buildTodayCommandResult(
  command: ParsedIdletimeCommand,
  options: {
    now?: Date;
    sessionRootDirectory?: string;
    stateDirectory?: string;
  } = {},
): Promise<TodayCommandResult> {
  const window = resolveTodayReportWindow({ now: options.now });
  const bestLedgerPromise = readBestLedger({ stateDirectory: options.stateDirectory });
  const sessionsPromise = readCodexSessions({
    windowStart: window.start,
    windowEnd: window.end,
    sessionRootDirectory: options.sessionRootDirectory,
  });
  const [bestLedger, sessions] = await Promise.all([
    bestLedgerPromise,
    sessionsPromise,
  ]);

  return {
    bestLedger,
    summaryReport: buildSummaryReport(sessions, {
      filters: command.filters,
      groupBy: command.groupBy,
      idleCutoffMs: command.idleCutoffMs,
      wakeWindow: command.wakeWindow,
      window,
    }),
  };
}

export async function runTodayCommand(
  command: ParsedIdletimeCommand,
  options: {
    now?: Date;
    sessionRootDirectory?: string;
    stateDirectory?: string;
  } = {},
): Promise<string> {
  const commandResult = await buildTodayCommandResult(command, options);

  return renderSummaryReport(
    commandResult.summaryReport,
    createRenderOptions(command.shareMode),
    undefined,
    commandResult.bestLedger ? buildBestPlaque(commandResult.bestLedger) : null,
  );
}

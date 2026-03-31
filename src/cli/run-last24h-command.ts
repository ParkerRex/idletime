import { readCodexSessions } from "../codex-session-log/read-codex-sessions.ts";
import type { BestMetricsLedger } from "../best-metrics/types.ts";
import { readBestLedger } from "../best-metrics/read-best-ledger.ts";
import { resolveTrailingReportWindow } from "../report-window/resolve-report-window.ts";
import { buildHourlyReport } from "../reporting/build-hourly-report.ts";
import { buildBestPlaque } from "../reporting/render-best-plaque.ts";
import { buildSummaryReport } from "../reporting/build-summary-report.ts";
import { renderSummaryReport } from "../reporting/render-summary-report.ts";
import { createRenderOptions } from "../reporting/render-theme.ts";
import type { HourlyReport, SummaryReport } from "../reporting/types.ts";
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
    sessionRootDirectory?: string;
    stateDirectory?: string;
  } = {},
): Promise<Last24hCommandResult> {
  const window = resolveTrailingReportWindow({
    durationMs: command.hourlyWindowMs,
    now: options.now,
  });
  const bestLedgerPromise = readBestLedger({ stateDirectory: options.stateDirectory });
  const sessionsPromise = readCodexSessions({
    windowStart: window.start,
    windowEnd: window.end,
    sessionRootDirectory: options.sessionRootDirectory,
  });
  const [bestLedger, sessionReadResult] = await Promise.all([
    bestLedgerPromise,
    sessionsPromise,
  ]);
  const { sessions, warnings } = sessionReadResult;
  const summaryReport = buildSummaryReport(sessions, {
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

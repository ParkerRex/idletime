import { readCodexSessions } from "../codex-session-log/read-codex-sessions.ts";
import { resolveTrailingReportWindow } from "../report-window/resolve-report-window.ts";
import { buildHourlyReport } from "../reporting/build-hourly-report.ts";
import { renderHourlyReport } from "../reporting/render-hourly-report.ts";
import { createRenderOptions } from "../reporting/render-theme.ts";
import type { HourlyReport } from "../reporting/types.ts";
import type { ParsedIdletimeCommand } from "./parse-idletime-command.ts";

export type HourlyCommandResult = {
  hourlyReport: HourlyReport;
};

export async function buildHourlyCommandResult(
  command: ParsedIdletimeCommand,
  options: {
    now?: Date;
    sessionRootDirectory?: string;
  } = {},
): Promise<HourlyCommandResult> {
  const window = resolveTrailingReportWindow({
    durationMs: command.hourlyWindowMs,
    now: options.now,
  });
  const sessions = await readCodexSessions({
    windowStart: window.start,
    windowEnd: window.end,
    sessionRootDirectory: options.sessionRootDirectory,
  });
  const { sessions: parsedSessions, warnings } = sessions;

  return {
    hourlyReport: buildHourlyReport(parsedSessions, {
      filters: command.filters,
      idleCutoffMs: command.idleCutoffMs,
      sessionReadWarnings: warnings,
      wakeWindow: command.wakeWindow,
      window,
    }),
  };
}

export async function runHourlyCommand(
  command: ParsedIdletimeCommand,
  options: {
    now?: Date;
    sessionRootDirectory?: string;
  } = {},
): Promise<string> {
  const commandResult = await buildHourlyCommandResult(command, options);

  return renderHourlyReport(
    commandResult.hourlyReport,
    createRenderOptions(command.shareMode),
  );
}

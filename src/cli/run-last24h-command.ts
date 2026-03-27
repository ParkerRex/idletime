import { readCodexSessions } from "../codex-session-log/read-codex-sessions.ts";
import { resolveTrailingReportWindow } from "../report-window/resolve-report-window.ts";
import { buildHourlyReport } from "../reporting/build-hourly-report.ts";
import { buildSummaryReport } from "../reporting/build-summary-report.ts";
import { renderSummaryReport } from "../reporting/render-summary-report.ts";
import { createRenderOptions } from "../reporting/render-theme.ts";
import type { ParsedIdletimeCommand } from "./parse-idletime-command.ts";

export async function runLast24hCommand(
  command: ParsedIdletimeCommand,
): Promise<string> {
  const window = resolveTrailingReportWindow({ durationMs: command.hourlyWindowMs });
  const sessions = await readCodexSessions({
    windowStart: window.start,
    windowEnd: window.end,
  });
  const summaryReport = buildSummaryReport(sessions, {
    filters: command.filters,
    groupBy: command.groupBy,
    idleCutoffMs: command.idleCutoffMs,
    wakeWindow: command.wakeWindow,
    window,
  });
  const hourlyReport = buildHourlyReport(sessions, {
    filters: command.filters,
    idleCutoffMs: command.idleCutoffMs,
    wakeWindow: command.wakeWindow,
    window,
  });

  return renderSummaryReport(
    summaryReport,
    createRenderOptions(command.shareMode),
    hourlyReport,
  );
}

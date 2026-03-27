import { readCodexSessions } from "../codex-session-log/read-codex-sessions.ts";
import { resolveTodayReportWindow } from "../report-window/resolve-report-window.ts";
import { buildSummaryReport } from "../reporting/build-summary-report.ts";
import { renderSummaryReport } from "../reporting/render-summary-report.ts";
import { createRenderOptions } from "../reporting/render-theme.ts";
import type { ParsedIdletimeCommand } from "./parse-idletime-command.ts";

export async function runTodayCommand(
  command: ParsedIdletimeCommand,
): Promise<string> {
  const window = resolveTodayReportWindow();
  const sessions = await readCodexSessions({
    windowStart: window.start,
    windowEnd: window.end,
  });

  return renderSummaryReport(
    buildSummaryReport(sessions, {
      filters: command.filters,
      groupBy: command.groupBy,
      idleCutoffMs: command.idleCutoffMs,
      wakeWindow: command.wakeWindow,
      window,
    }),
    createRenderOptions(command.shareMode),
  );
}

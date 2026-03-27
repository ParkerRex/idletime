import { readCodexSessions } from "../codex-session-log/read-codex-sessions.ts";
import { resolveTrailingReportWindow } from "../report-window/resolve-report-window.ts";
import { buildHourlyReport } from "../reporting/build-hourly-report.ts";
import { renderHourlyReport } from "../reporting/render-hourly-report.ts";
import { createRenderOptions } from "../reporting/render-theme.ts";
import type { ParsedIdletimeCommand } from "./parse-idletime-command.ts";

export async function runHourlyCommand(
  command: ParsedIdletimeCommand,
): Promise<string> {
  const window = resolveTrailingReportWindow({ durationMs: command.hourlyWindowMs });
  const sessions = await readCodexSessions({
    windowStart: window.start,
    windowEnd: window.end,
  });

  return renderHourlyReport(
    buildHourlyReport(sessions, {
      filters: command.filters,
      idleCutoffMs: command.idleCutoffMs,
      wakeWindow: command.wakeWindow,
      window,
    }),
    createRenderOptions(command.shareMode),
  );
}

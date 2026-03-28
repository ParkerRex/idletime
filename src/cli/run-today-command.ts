import { readCodexSessions } from "../codex-session-log/read-codex-sessions.ts";
import { notifyNearBestMetrics } from "../best-metrics/near-best-notifications.ts";
import { notifyBestEvents } from "../best-metrics/notify-best-events.ts";
import { refreshBestMetrics } from "../best-metrics/refresh-best-metrics.ts";
import { resolveTodayReportWindow } from "../report-window/resolve-report-window.ts";
import { buildBestPlaque } from "../reporting/render-best-plaque.ts";
import { buildSummaryReport } from "../reporting/build-summary-report.ts";
import { renderSummaryReport } from "../reporting/render-summary-report.ts";
import { createRenderOptions } from "../reporting/render-theme.ts";
import type { ParsedIdletimeCommand } from "./parse-idletime-command.ts";

export async function runTodayCommand(
  command: ParsedIdletimeCommand,
): Promise<string> {
  const window = resolveTodayReportWindow();
  const bestMetrics = await refreshBestMetrics();
  await notifyBestEvents(bestMetrics.newBestEvents);
  await notifyNearBestMetrics(bestMetrics.currentMetrics, bestMetrics.ledger);
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
    undefined,
    buildBestPlaque(bestMetrics.ledger),
  );
}

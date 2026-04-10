import {
  buildBar,
  buildSparkline,
  formatCompactInteger,
  formatDurationHours,
  formatTimeRange,
  padRight,
} from "./report-formatting.ts";
import {
  buildLogoSection,
  resolveLogoSectionWidth,
} from "./render-logo-section.ts";
import { renderSessionReadWarnings } from "./render-session-read-warnings.ts";
import { renderPanel, renderSectionTitle } from "./render-shared-sections.ts";
import { dim, measureVisibleTextWidth, paint } from "./render-theme.ts";
import type { BestPlaque, RenderOptions, SummaryReport } from "./types.ts";

const weekBarWidth = 18;

export function renderWeekReport(
  report: SummaryReport,
  options: RenderOptions,
  bestPlaque: BestPlaque | null = null,
): string {
  const lines: string[] = [];
  const panelLines = renderPanel(
    `idletime week • ${report.window.label}`,
    [
      formatTimeRange(report.window.start, report.window.end, report.window),
      `${report.sessionCounts.total} sessions · ${formatDurationHours(report.metrics.strictEngagementMs)} focused · ${formatCompactInteger(report.tokenTotals.practicalBurn)} burn`,
      `${report.sessionCounts.direct} direct / ${report.sessionCounts.subagent} subagent`,
    ],
    options,
  );
  const panelWidth = measureVisibleTextWidth(panelLines[0] ?? "");
  const logoSectionWidth = resolveLogoSectionWidth(panelWidth, options);
  const warningLines = renderSessionReadWarnings(
    report.sessionReadWarnings,
    options,
  );
  const maxDayBurn = Math.max(
    ...report.weeklyBurnTrend.map((point) => point.practicalBurn),
    0,
  );

  lines.push(...buildLogoSection(logoSectionWidth, options, bestPlaque));
  lines.push("");
  lines.push(...panelLines);
  if (warningLines.length > 0) {
    lines.push("");
    lines.push(...warningLines);
  }
  lines.push("");
  lines.push(...renderSectionTitle("Weekly Burn", options));
  lines.push(
    `${paint(padRight("  line", 14), "muted", options)} ${paint(
      buildSparkline(report.weeklyBurnTrend.map((point) => point.practicalBurn)),
      "burn",
      options,
    )}  ${paint(
      padRight(formatCompactInteger(report.tokenTotals.practicalBurn), 7),
      "burn",
      options,
    )} ${dim("rolling 7d total", options)}`,
  );
  lines.push(
    `${paint(padRight("  days", 14), "muted", options)} ${dim(
      report.weeklyBurnTrend
        .map((point) => formatWeekdayLabel(point.start, report.window.timeZone))
        .join(" "),
      options,
    )}`,
  );
  lines.push("");
  lines.push(...renderSectionTitle("Daily Burn", options));

  for (const point of report.weeklyBurnTrend) {
    lines.push(
      `${paint(
        padRight(`  ${formatWeekdayLabel(point.start, report.window.timeZone)}`, 14),
        "muted",
        options,
      )} ${paint(
        buildBar(point.practicalBurn, maxDayBurn, weekBarWidth, "▇"),
        "burn",
        options,
      )}  ${paint(
        padRight(formatCompactInteger(point.practicalBurn), 7),
        "value",
        options,
      )} ${dim(formatMonthDay(point.start, report.window.timeZone), options)}`,
    );
  }

  return lines.join("\n");
}

function formatWeekdayLabel(timestamp: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(timestamp);
}

function formatMonthDay(timestamp: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(timestamp);
}

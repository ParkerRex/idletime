import { basename } from "node:path";
import {
  buildSparkline,
  formatDurationCompact,
  formatTimestamp,
  padRight,
  shortenPath,
} from "./report-formatting.ts";
import { buildLogoSection } from "./render-logo-section.ts";
import { renderPanel } from "./render-shared-sections.ts";
import { measureVisibleTextWidth, paint } from "./render-theme.ts";
import type { LiveReport, RenderOptions } from "./types.ts";

const bigDigitGlyphs: Record<string, [string, string, string]> = {
  "0": ["█▀█", "█ █", "▀▀▀"],
  "1": [" ▄█", "  █", "▄▄█"],
  "2": ["█▀█", " ▄▀", "█▄▄"],
  "3": ["█▀█", " ▀▄", "█▄█"],
  "4": ["█ █", "█▄█", "  █"],
  "5": ["█▀▀", "▀▀▄", "▄▄█"],
  "6": ["█▀▀", "█▀█", "█▄█"],
  "7": ["█▀█", "  █", "  █"],
  "8": ["█▀█", "█▄█", "█▄█"],
  "9": ["█▀█", "█▄█", "  █"],
};

export function renderLiveReport(
  report: LiveReport,
  options: RenderOptions,
): string {
  const headerLines = renderPanel(
    "idletime live",
    [
      buildScopeLine(report),
      `observed ${formatTimestamp(report.observedAt, { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })} • refresh 5s`,
      buildContextLine(report),
    ],
    options,
  );
  const panelWidth = measureVisibleTextWidth(headerLines[0] ?? "");
  const lines: string[] = [];

  lines.push(...buildLogoSection(panelWidth, options));
  lines.push("");
  lines.push(...headerLines);
  lines.push("");
  lines.push(...buildScoreboardSection(report, options));

  return lines.join("\n");
}

export function renderLiveErrorReport(
  workspacePrefix: string | null,
  error: unknown,
  options: RenderOptions,
): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const panelLines = renderPanel(
    "idletime live",
    [
      workspacePrefix
        ? `scope workspace • ${shortenPath(workspacePrefix, 40)}`
        : "scope global",
      "live refresh failed; retrying in 5s",
      errorMessage,
    ],
    options,
  );
  const panelWidth = measureVisibleTextWidth(panelLines[0] ?? "");

  return [...buildLogoSection(panelWidth, options), "", ...panelLines].join("\n");
}

function buildScopeLine(report: LiveReport): string {
  return report.scope === "workspace" && report.workspacePrefix
    ? `scope workspace • ${shortenPath(report.workspacePrefix, 40)}`
    : "scope global";
}

function buildContextLine(report: LiveReport): string {
  const filterParts: string[] = [];

  if (report.appliedFilters.model) {
    filterParts.push(`model ${report.appliedFilters.model}`);
  }

  if (report.appliedFilters.reasoningEffort) {
    filterParts.push(`effort ${report.appliedFilters.reasoningEffort}`);
  }

  if (report.appliedFilters.sessionKind) {
    filterParts.push(`kind ${report.appliedFilters.sessionKind}`);
  }

  return filterParts.length > 0 ? filterParts.join(" • ") : "all sessions";
}

function renderBigDigits(value: string): [string, string, string] {
  const rows: [string, string, string] = ["", "", ""];

  for (const character of value) {
    const glyph = bigDigitGlyphs[character] ?? ["   ", " ? ", "   "];
    rows[0] += `${glyph[0]} `;
    rows[1] += `${glyph[1]} `;
    rows[2] += `${glyph[2]} `;
  }

  return rows;
}

function buildScoreboardSection(
  report: LiveReport,
  options: RenderOptions,
): string[] {
  const waitingLabel = "waiting on you";
  const runningLabel = "running";
  const waitingDigits = renderBigDigits(report.waitingOnUserCount.toString());
  const runningDigits = renderBigDigits(report.runningCount.toString());
  const leftColumnWidth = Math.max(
    waitingLabel.length,
    ...waitingDigits.map((line) => line.length),
  );
  const rightColumnWidth = Math.max(
    runningLabel.length,
    ...runningDigits.map((line) => line.length),
  );
  const columnGap = "    ";
  const lines = [
    joinScoreboardColumns(
      waitingLabel,
      runningLabel,
      leftColumnWidth,
      rightColumnWidth,
      options,
    ),
    ...waitingDigits.map((line, lineIndex) =>
      joinScoreboardColumns(
        line,
        runningDigits[lineIndex] ?? "",
        leftColumnWidth,
        rightColumnWidth,
        options,
      ),
    ),
    "",
    `${paint("  recent     ", "muted", options)}${paint(
      buildSparkline(report.recentConcurrencyValues),
      "agent",
      options,
    )}`,
    ...buildRunningLocationLines(report, options),
    ...buildWaitingLocationLines(report, options),
    ...buildWaitingThreadLines(report, options),
    `${paint("  this turn  ", "muted", options)}${paint(
      `${report.doneThisTurnCount} done`,
      "value",
      options,
    )}`,
    `${paint("  today peak ", "muted", options)}${paint(
      `${report.peakTodayCount} concurrent`,
      "value",
      options,
    )}`,
  ];

  function joinScoreboardColumns(
    leftValue: string,
    rightValue: string,
    leftWidth: number,
    rightWidth: number,
    renderOptions: RenderOptions,
  ): string {
    return `  ${paint(
      padRight(leftValue, leftWidth),
      "agent",
      renderOptions,
    )}${columnGap}${paint(
      padRight(rightValue, rightWidth),
      "value",
      renderOptions,
    )}`;
  }

  return lines;
}

function buildRunningLocationLines(
  report: LiveReport,
  options: RenderOptions,
): string[] {
  if (report.runningLocations.length === 0) {
    return [
      `${paint("  running at ", "muted", options)}${paint(
        "no active tasks",
        "muted",
        options,
      )}`,
    ];
  }

  const visibleLocations = report.runningLocations.slice(0, 3);
  const lines = visibleLocations.map((location, locationIndex) => {
    const label = locationIndex === 0 ? "  running at " : "             ";
    return `${paint(label, "muted", options)}${paint(
      `${location.runningCount} ${formatLocationLabel(location.cwd)}`,
      "value",
      options,
    )}`;
  });
  const hiddenLocationCount = report.runningLocations.length - visibleLocations.length;

  if (hiddenLocationCount > 0) {
    lines.push(
      `${paint("             ", "muted", options)}${paint(
        `+${hiddenLocationCount} more`,
        "muted",
        options,
      )}`,
    );
  }

  return lines;
}

function buildWaitingLocationLines(
  report: LiveReport,
  options: RenderOptions,
): string[] {
  if (report.waitingOnUserLocations.length === 0) {
    return [
      `${paint("  waiting at ", "muted", options)}${paint(
        "nothing waiting",
        "muted",
        options,
      )}`,
    ];
  }

  const visibleLocations = report.waitingOnUserLocations.slice(0, 3);
  const lines = visibleLocations.map((location, locationIndex) => {
    const label = locationIndex === 0 ? "  waiting at " : "             ";
    return `${paint(label, "muted", options)}${paint(
      `${location.waitingCount} ${formatLocationLabel(location.cwd)}`,
      "value",
      options,
    )}`;
  });
  const hiddenLocationCount =
    report.waitingOnUserLocations.length - visibleLocations.length;

  if (hiddenLocationCount > 0) {
    lines.push(
      `${paint("             ", "muted", options)}${paint(
        `+${hiddenLocationCount} more`,
        "muted",
        options,
      )}`,
    );
  }

  return lines;
}

function buildWaitingThreadLines(
  report: LiveReport,
  options: RenderOptions,
): string[] {
  if (report.waitingThreads.length === 0) {
    return [];
  }

  return report.waitingThreads.slice(0, 3).map((waitingThread, waitingIndex) => {
    const label = waitingIndex === 0 ? "  top waiting " : "              ";
    return `${paint(label, "muted", options)}${paint(
      `${formatLocationLabel(waitingThread.cwd)} • ${formatDurationCompact(
        waitingThread.waitDurationMs,
      )} • ${formatThreadLabel(waitingThread.sessionId)}`,
      "value",
      options,
    )}`;
  });
}

function formatLocationLabel(cwd: string): string {
  if (cwd.endsWith("/.agents")) {
    return "~/.agents";
  }

  return basename(cwd) || shortenPath(cwd, 24);
}

function formatThreadLabel(sessionId: string): string {
  return sessionId.slice(-6);
}

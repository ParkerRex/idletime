import type { ReportWindow } from "../report-window/types.ts";

const integerFormatter = new Intl.NumberFormat("en-US");
const compactIntegerFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function formatDurationHours(durationMs: number): string {
  const hours = durationMs / 3_600_000;
  return `${hours.toFixed(1)}h`;
}

export function formatDurationClock(durationMs: number): string {
  const totalMinutes = Math.round(durationMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, "0")}m`;
}

export function formatInteger(value: number): string {
  return integerFormatter.format(Math.round(value));
}

export function formatCompactInteger(value: number): string {
  return compactIntegerFormatter.format(Math.round(value));
}

export function formatPercentage(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function formatSignedDurationHours(durationMs: number): string {
  const sign = durationMs >= 0 ? "+" : "-";
  return `${sign}${formatDurationHours(Math.abs(durationMs))}`;
}

export function formatTimestamp(
  timestamp: Date,
  reportWindow: Pick<ReportWindow, "timeZone">,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: reportWindow.timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export function formatTimeRange(
  startTimestamp: Date,
  endTimestamp: Date,
  reportWindow: Pick<ReportWindow, "timeZone">,
): string {
  return `${formatTimestamp(startTimestamp, reportWindow)} -> ${formatTimestamp(
    endTimestamp,
    reportWindow,
  )}`;
}

export function buildBar(
  value: number,
  maxValue: number,
  width: number,
  filledCharacter = "█",
  emptyCharacter = "·",
): string {
  if (maxValue <= 0 || value <= 0) {
    return emptyCharacter.repeat(width);
  }

  const filledCount = Math.max(1, Math.round((value / maxValue) * width));
  return `${filledCharacter.repeat(Math.min(width, filledCount))}${emptyCharacter.repeat(
    Math.max(0, width - filledCount),
  )}`;
}

export function buildSplitBar(
  segments: Array<{ filledCharacter: string; value: number }>,
  width: number,
  emptyCharacter = "·",
): string {
  const totalValue = segments.reduce(
    (currentTotal, segment) => currentTotal + Math.max(0, segment.value),
    0,
  );

  if (totalValue <= 0) {
    return emptyCharacter.repeat(width);
  }

  let remainingWidth = width;
  let builtBar = "";

  for (const [index, segment] of segments.entries()) {
    const segmentWidth =
      index === segments.length - 1
        ? remainingWidth
        : Math.min(
            remainingWidth,
            Math.round((Math.max(0, segment.value) / totalValue) * width),
          );

    builtBar += segment.filledCharacter.repeat(segmentWidth);
    remainingWidth -= segmentWidth;
  }

  return `${builtBar}${emptyCharacter.repeat(Math.max(0, remainingWidth))}`;
}

export function formatDurationCompact(durationMs: number): string {
  const totalMinutes = Math.round(durationMs / 60_000);
  if (totalMinutes >= 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h${minutes.toString().padStart(2, "0")}`;
  }

  return `${totalMinutes}m`;
}

export function formatHourBucketLabel(
  timestamp: Date,
  reportWindow: Pick<ReportWindow, "timeZone">,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: reportWindow.timeZone,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export function formatHourOfDay(
  timestamp: Date,
  reportWindow: Pick<ReportWindow, "timeZone">,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: reportWindow.timeZone,
    hour: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export function formatAxisTimeLabel(
  timestamp: Date,
  reportWindow: Pick<ReportWindow, "timeZone">,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: reportWindow.timeZone,
    hour: "numeric",
    hour12: true,
  })
    .format(timestamp)
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function buildSparkline(values: number[]): string {
  const levels = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"];
  const maxValue = Math.max(...values, 0);

  if (maxValue <= 0) {
    return "·".repeat(values.length);
  }

  return values
    .map((value) => {
      if (value <= 0) {
        return "·";
      }

      const levelIndex = Math.max(
        0,
        Math.round((value / maxValue) * (levels.length - 1)),
      );
      return levels[levelIndex]!;
    })
    .join("");
}

export function padRight(text: string, width: number): string {
  return `${text}${" ".repeat(Math.max(0, width - text.length))}`;
}

export function shortenPath(pathText: string, maxLength: number): string {
  if (pathText.length <= maxLength) {
    return pathText;
  }

  const pathSegments = pathText.split("/").filter((segment) => segment.length > 0);
  let shortenedPath = "";

  for (let index = pathSegments.length - 1; index >= 0; index -= 1) {
    const nextPath = `/${pathSegments[index]}${shortenedPath}`;
    if (nextPath.length + 4 > maxLength) {
      break;
    }
    shortenedPath = nextPath;
  }

  return `...${shortenedPath || pathText.slice(-(maxLength - 3))}`;
}

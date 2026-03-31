import type {
  CodexStatusRateLimits,
  CodexLimitWindowSnapshot,
} from "./types.ts";

export function parseCodexStatusRateLimits(
  text: string,
  now: Date = new Date(),
): CodexStatusRateLimits | null {
  const cleanText = stripAnsiCodes(text).trim();
  if (!cleanText) {
    return null;
  }

  const fiveHourLine = findLine(cleanText, /5h limit/i);
  const weeklyLine = findLine(cleanText, /weekly limit/i);

  const fiveHourWindow = fiveHourLine
    ? parseStatusLineWindow(fiveHourLine, 300, now)
    : null;
  const weeklyWindow = weeklyLine
    ? parseStatusLineWindow(weeklyLine, 10080, now)
    : null;

  if (!fiveHourWindow && !weeklyWindow) {
    return null;
  }

  return {
    fetchedAt: now,
    fiveHourWindow,
    weeklyWindow,
  };
}

function parseStatusLineWindow(
  line: string,
  windowDurationMins: number,
  now: Date,
): CodexLimitWindowSnapshot | null {
  const remainingPercent = parseRemainingPercent(line);
  const resetsAt = parseResetDate(line, now);
  if (remainingPercent === null || resetsAt === null) {
    return null;
  }

  return {
    resetsAt,
    remainingPercent,
    usedPercent: Math.max(0, 100 - remainingPercent),
    windowDurationMins,
  };
}

function parseRemainingPercent(line: string): number | null {
  const match = line.match(/(\d+(?:\.\d+)?)\s*%/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseResetDate(line: string, now: Date): Date | null {
  const rawResetText =
    captureResetText(line) ?? captureTrailingDateTime(line) ?? null;
  if (!rawResetText) {
    return null;
  }

  const cleaned = rawResetText
    .replace(/[()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const hhmmMatch = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const hours = Number(hhmmMatch[1]);
    const minutes = Number(hhmmMatch[2]);
    return anchorTimeToNow(now, hours, minutes);
  }

  const monthDayTimeMatch = cleaned.match(
    /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{1,2}):(\d{2})$/,
  );
  if (monthDayTimeMatch) {
    return buildDateFromMonthDay(
      now,
      monthDayTimeMatch[2]!,
      Number(monthDayTimeMatch[1]),
      Number(monthDayTimeMatch[3]),
      Number(monthDayTimeMatch[4]),
    );
  }

  const monthFirstTimeMatch = cleaned.match(
    /^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2})$/,
  );
  if (monthFirstTimeMatch) {
    return buildDateFromMonthDay(
      now,
      monthFirstTimeMatch[1]!,
      Number(monthFirstTimeMatch[2]),
      Number(monthFirstTimeMatch[3]),
      Number(monthFirstTimeMatch[4]),
    );
  }

  const monthSlashDayTimeMatch = cleaned.match(
    /^(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})$/,
  );
  if (monthSlashDayTimeMatch) {
    return buildDateFromMonthSlashDay(
      now,
      Number(monthSlashDayTimeMatch[1]),
      Number(monthSlashDayTimeMatch[2]),
      Number(monthSlashDayTimeMatch[3]),
      Number(monthSlashDayTimeMatch[4]),
    );
  }

  return null;
}

function captureResetText(line: string): string | null {
  const patterns = [
    /reset(?:s)?\s+at\s+([^)]+?)(?:\s*$|[.,])/i,
    /reset(?:s)?\s+in\s+([^)]+?)(?:\s*$|[.,])/i,
    /reset(?:s)?\s+([0-9][^)]+?)(?:\s*$|[.,])/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function captureTrailingDateTime(line: string): string | null {
  const patterns = [
    /(\d{1,2}:\d{2})\s+on\s+(\d{1,2}\s+[A-Za-z]{3})/i,
    /(\d{1,2}:\d{2})\s+on\s+([A-Za-z]{3}\s+\d{1,2})/i,
  ];

  for (const pattern of patterns) {
    const match = line.match(pattern);
    if (match) {
      return `${match[2]} ${match[1]}`;
    }
  }

  const directPatterns = [
    /\b(\d{1,2}:\d{2})\b/,
    /\b(\d{1,2}\s+[A-Za-z]{3}\s+\d{1,2}:\d{2})\b/,
    /\b([A-Za-z]{3}\s+\d{1,2}\s+\d{1,2}:\d{2})\b/,
    /\b(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2})\b/,
  ];

  for (const pattern of directPatterns) {
    const match = line.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function anchorTimeToNow(now: Date, hours: number, minutes: number): Date {
  const anchored = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0,
  );
  if (anchored.getTime() >= now.getTime()) {
    return anchored;
  }

  return new Date(anchored.getTime() + 24 * 60 * 60_000);
}

function buildDateFromMonthDay(
  now: Date,
  monthName: string,
  day: number,
  hours: number,
  minutes: number,
): Date | null {
  const monthIndex = resolveMonthIndex(monthName);
  if (monthIndex === null) {
    return null;
  }

  const anchored = new Date(
    now.getFullYear(),
    monthIndex,
    day,
    hours,
    minutes,
    0,
    0,
  );
  return anchored.getTime() >= now.getTime()
    ? anchored
    : new Date(anchored.getTime() + 365 * 24 * 60 * 60_000);
}

function buildDateFromMonthSlashDay(
  now: Date,
  month: number,
  day: number,
  hours: number,
  minutes: number,
): Date | null {
  const anchored = new Date(
    now.getFullYear(),
    month - 1,
    day,
    hours,
    minutes,
    0,
    0,
  );
  return anchored.getTime() >= now.getTime()
    ? anchored
    : new Date(anchored.getTime() + 365 * 24 * 60 * 60_000);
}

function resolveMonthIndex(monthName: string): number | null {
  const monthIndex = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ].indexOf(monthName.toLowerCase().slice(0, 3));
  return monthIndex >= 0 ? monthIndex : null;
}

function findLine(text: string, pattern: RegExp): string | null {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (pattern.test(line)) {
      return line.trim();
    }
  }
  return null;
}

function stripAnsiCodes(text: string): string {
  return text.replace(
    // eslint-disable-next-line no-control-regex
    /\u001b\[[0-9;]*m/g,
    "",
  );
}

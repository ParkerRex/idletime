type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

export function getZonedDateParts(
  timestamp: Date,
  timeZone: string,
): ZonedDateParts {
  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(timestamp);

  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
    hour: readPart(parts, "hour"),
    minute: readPart(parts, "minute"),
    second: readPart(parts, "second"),
  };
}

export function createUtcDateFromZonedParts(
  parts: ZonedDateParts,
  timeZone: string,
): Date {
  let candidate = new Date(
    Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    ),
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actualParts = getZonedDateParts(candidate, timeZone);
    const desiredTimestampMs = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const actualTimestampMs = Date.UTC(
      actualParts.year,
      actualParts.month - 1,
      actualParts.day,
      actualParts.hour,
      actualParts.minute,
      actualParts.second,
    );
    const adjustmentMs = desiredTimestampMs - actualTimestampMs;
    if (adjustmentMs === 0) {
      return candidate;
    }

    candidate = new Date(candidate.getTime() + adjustmentMs);
  }

  return candidate;
}

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  const cachedFormatter = formatterCache.get(timeZone);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

function readPart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): number {
  const part = parts.find((entry) => entry.type === type);
  if (!part) {
    throw new Error(`Missing ${type} part while formatting zoned date.`);
  }

  return Number(part.value);
}

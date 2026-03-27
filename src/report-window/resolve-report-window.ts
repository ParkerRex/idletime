import type { ReportWindow } from "./types.ts";

type ResolveWindowOptions = {
  durationMs?: number;
  now?: Date;
  timeZone?: string;
};

export function resolveTrailingReportWindow(
  options: ResolveWindowOptions = {},
): ReportWindow {
  const now = options.now ?? new Date();
  const durationMs = options.durationMs ?? 24 * 60 * 60 * 1000;

  return {
    label: `last${Math.round(durationMs / 3_600_000)}h`,
    start: new Date(now.getTime() - durationMs),
    end: now,
    timeZone: options.timeZone ?? getLocalTimeZone(),
  };
}

export function resolveTodayReportWindow(
  options: ResolveWindowOptions = {},
): ReportWindow {
  const now = options.now ?? new Date();

  return {
    label: "today",
    start: new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    ),
    end: now,
    timeZone: options.timeZone ?? getLocalTimeZone(),
  };
}

function getLocalTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

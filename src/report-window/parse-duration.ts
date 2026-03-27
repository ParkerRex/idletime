const durationPattern = /^(\d+)(m|h|d)$/;

export function parseDurationToMs(durationText: string): number {
  const match = durationPattern.exec(durationText.trim());
  if (!match) {
    throw new Error(`Unsupported duration "${durationText}". Use 15m, 24h, or 2d.`);
  }

  const value = Number(match[1]);
  const unit = match[2];
  const unitMultiplier =
    unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;

  return value * unitMultiplier;
}

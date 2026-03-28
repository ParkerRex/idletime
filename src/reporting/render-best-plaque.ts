import type { BestMetricsLedger } from "../best-metrics/types.ts";
import { formatCompactInteger, formatInteger } from "./report-formatting.ts";
import type { BestPlaque } from "./types.ts";

export function buildBestPlaque(
  ledger: BestMetricsLedger | null,
): BestPlaque {
  return {
    label: "BEST",
    concurrentAgentsText: `${formatInteger(
      ledger?.bestConcurrentAgents?.value ?? 0,
    )} concurrent agents`,
    rawBurnText: `${formatCompactInteger(
      ledger?.best24hRawBurn?.value ?? 0,
    ).toUpperCase()} 24hr raw burn`,
    agentSumText: `${formatAgentSumHours(
      ledger?.best24hAgentSumMs?.value ?? 0,
    )} agent sum`,
  };
}

export function buildBestPlaqueRows(
  bestPlaque: BestPlaque,
  availableWidth: number,
): string[] | null {
  const wideRows = [
    bestPlaque.label,
    bestPlaque.concurrentAgentsText,
    bestPlaque.rawBurnText,
    bestPlaque.agentSumText,
    "",
  ];
  if (rowsFitWidth(wideRows, availableWidth)) {
    return wideRows;
  }

  const compactRows = [
    bestPlaque.label,
    bestPlaque.concurrentAgentsText.replace(" agents", ""),
    bestPlaque.rawBurnText.replace(" 24hr ", " "),
    bestPlaque.agentSumText,
    "",
  ];
  if (rowsFitWidth(compactRows, availableWidth)) {
    return compactRows;
  }

  const microRows = [
    bestPlaque.label,
    compactRows[1]?.replace("concurrent", "conc") ?? "",
    compactRows[2]?.replace(" burn", "") ?? "",
    compactRows[3]?.replace(" agent sum", " sum") ?? "",
    "",
  ];

  return rowsFitWidth(microRows, availableWidth) ? microRows : null;
}

function formatAgentSumHours(durationMs: number): string {
  const hours = durationMs / 3_600_000;
  const roundedHours =
    hours >= 10 ? Math.round(hours).toString() : (Math.round(hours * 10) / 10).toString();

  return roundedHours.endsWith(".0")
    ? roundedHours.slice(0, -2)
    : roundedHours;
}

function rowsFitWidth(rows: string[], availableWidth: number): boolean {
  return availableWidth > 0 &&
    rows.every((row) => row.length <= availableWidth);
}

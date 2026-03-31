import { shortenPath } from "./report-formatting.ts";
import { dim, paint } from "./render-theme.ts";
import { renderSectionTitle } from "./render-shared-sections.ts";
import type { RenderOptions } from "./types.ts";
import type { SessionReadWarning } from "../codex-session-log/types.ts";

export function renderSessionReadWarnings(
  warnings: SessionReadWarning[],
  options: RenderOptions,
): string[] {
  if (warnings.length === 0) {
    return [];
  }

  const lines: string[] = [];
  lines.push(...renderSectionTitle("Warnings", options));
  lines.push(
    `${paint("  skipped", "muted", options)} ${paint(
      `${warnings.length} malformed session file${warnings.length === 1 ? "" : "s"}`,
      "value",
      options,
    )}`,
  );

  const visibleWarnings = warnings.slice(0, 3);
  for (const warning of visibleWarnings) {
    lines.push(
      `${paint("  •", "muted", options)} ${paint(
        shortenPath(warning.sourceFilePath, 34),
        "value",
        options,
      )} ${dim("—", options)} ${dim(warning.message, options)}`,
    );
  }

  const hiddenWarningCount = warnings.length - visibleWarnings.length;
  if (hiddenWarningCount > 0) {
    lines.push(
      `${paint("  ", "muted", options)}${dim(
        `+${hiddenWarningCount} more`,
        options,
      )}`,
    );
  }

  return lines;
}

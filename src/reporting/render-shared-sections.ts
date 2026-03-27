import { buildPanel, buildSectionTitle } from "./render-layout.ts";
import { dim, paint } from "./render-theme.ts";
import type { RenderOptions } from "./types.ts";

export function renderPanel(
  title: string,
  lines: string[],
  options: RenderOptions,
): string[] {
  return buildPanel(title, lines).map((line) => paint(line, "frame", options));
}

export function renderSectionTitle(
  title: string,
  options: RenderOptions,
): string[] {
  const [headingLine, ruleLine] = buildSectionTitle(title);
  return [
    paint(headingLine ?? title, "heading", options),
    dim(ruleLine ?? "", options),
  ];
}

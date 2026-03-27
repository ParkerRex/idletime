import type { RenderOptions } from "./types.ts";

type ThemeRole =
  | "active"
  | "agent"
  | "burn"
  | "frame"
  | "focus"
  | "heading"
  | "idle"
  | "muted"
  | "raw"
  | "value";

const roleStyles: Record<ThemeRole, string> = {
  focus: "1;38;2;236;239;148",
  active: "1;38;2;208;219;96",
  agent: "1;38;2;166;182;77",
  idle: "1;38;2;138;150;66",
  burn: "1;38;2;228;209;92",
  raw: "1;38;2;188;172;80",
  frame: "1;38;2;149;158;56",
  heading: "1;38;2;249;246;212",
  muted: "38;2;142;145;96",
  value: "1;38;2;242;236;179",
};

export function createRenderOptions(shareMode: boolean): RenderOptions {
  return {
    colorEnabled:
      Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined,
    shareMode,
    terminalWidth: process.stdout.columns ?? null,
  };
}

export function paint(
  text: string,
  role: ThemeRole,
  options: RenderOptions,
): string {
  return paintAnsi(text, roleStyles[role], options);
}

export function paintAnsi(
  text: string,
  style: string,
  options: RenderOptions,
): string {
  if (!options.colorEnabled || text.length === 0) {
    return text;
  }

  return `\u001b[${style}m${text}\u001b[0m`;
}

export function dim(text: string, options: RenderOptions): string {
  return paintAnsi(text, "2", options);
}

export function measureVisibleTextWidth(text: string): number {
  let visibleWidth = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\u001b" && text[index + 1] === "[") {
      index += 2;
      while (index < text.length && text[index] !== "m") {
        index += 1;
      }
      continue;
    }

    visibleWidth += 1;
  }

  return visibleWidth;
}

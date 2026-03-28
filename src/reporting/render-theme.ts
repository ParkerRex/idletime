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
  focus: "1;38;2;190;184;86",
  active: "1;38;2;157;168;60",
  agent: "1;38;2;124;138;55",
  idle: "1;38;2;105;118;50",
  burn: "1;38;2;190;161;55",
  raw: "1;38;2;153;132;52",
  frame: "1;38;2;118;126;50",
  heading: "1;38;2;201;190;102",
  muted: "38;2;111;115;78",
  value: "1;38;2;178;161;68",
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

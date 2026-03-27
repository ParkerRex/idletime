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
  | "value";

const roleStyles: Record<ThemeRole, string> = {
  focus: "1;38;2;56;189;248",
  active: "1;38;2;96;165;250",
  agent: "1;38;2;168;85;247",
  idle: "1;38;2;250;204;21",
  burn: "1;38;2;251;146;60",
  frame: "1;38;2;125;211;252",
  heading: "1;38;2;248;250;252",
  muted: "38;2;148;163;184",
  value: "1;38;2;226;232;240",
};

export function createRenderOptions(shareMode: boolean): RenderOptions {
  return {
    colorEnabled:
      Boolean(process.stdout.isTTY) && process.env.NO_COLOR === undefined,
    shareMode,
  };
}

export function paint(
  text: string,
  role: ThemeRole,
  options: RenderOptions,
): string {
  if (!options.colorEnabled || text.length === 0) {
    return text;
  }

  return `\u001b[${roleStyles[role]}m${text}\u001b[0m`;
}

export function dim(text: string, options: RenderOptions): string {
  if (!options.colorEnabled || text.length === 0) {
    return text;
  }

  return `\u001b[2m${text}\u001b[0m`;
}

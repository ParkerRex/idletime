import { padRight } from "./report-formatting.ts";
import { paintAnsi } from "./render-theme.ts";
import type { RenderOptions } from "./types.ts";

const baseBackgroundStyle = "48;2;12;15;8";
const wordmarkStyle = `${baseBackgroundStyle};1;38;2;247;245;204`;
const wordmarkLines = [
  "       ▄▄ ▄▄",
  "▀▀     ██ ██        ██   ▀▀",
  "██  ▄████ ██ ▄█▀█▄ ▀██▀▀ ██  ███▄███▄ ▄█▀█▄",
  "██  ██ ██ ██ ██▄█▀  ██   ██  ██ ██ ██ ██▄█▀",
  "██▄ ▀████ ██ ▀█▄▄▄  ██   ██▄ ██ ██ ██ ▀█▄▄▄",
];

type RgbColor = {
  blue: number;
  green: number;
  red: number;
};

const patternColors: RgbColor[] = [
  { red: 20, green: 24, blue: 10 },
  { red: 48, green: 58, blue: 18 },
  { red: 86, green: 96, blue: 24 },
  { red: 128, green: 138, blue: 30 },
  { red: 176, green: 188, blue: 40 },
  { red: 220, green: 228, blue: 78 },
];
const monochromePatternCharacters = ["░", "░", "▒", "▓", "█"];

export function buildLogoSection(
  requestedWidth: number,
  options: RenderOptions,
): string[] {
  const wordmarkWidth = Math.max(...wordmarkLines.map((line) => line.length));
  const sectionWidth = Math.max(requestedWidth, wordmarkWidth);
  const patternWidth = Math.max(0, sectionWidth - wordmarkWidth);

  return wordmarkLines.map((line, rowIndex) => {
    const paddedWordmark = padRight(line, wordmarkWidth);
    const patternTail = buildPatternTail(patternWidth, rowIndex, options);

    return `${paintAnsi(paddedWordmark, wordmarkStyle, options)}${patternTail}`;
  });
}

export function resolveLogoSectionWidth(
  minimumWidth: number,
  options: RenderOptions,
): number {
  return Math.max(minimumWidth, options.terminalWidth ?? 0);
}

function buildPatternTail(
  width: number,
  rowIndex: number,
  options: RenderOptions,
): string {
  if (!options.colorEnabled) {
    return buildMonochromePatternTail(width, rowIndex);
  }

  let patternTail = "";
  let currentStyle = "";
  let currentSegmentWidth = 0;

  for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
    const style = getPatternCellStyle(getPatternIntensity(width, rowIndex, columnIndex));
    if (style === currentStyle) {
      currentSegmentWidth += 1;
      continue;
    }

    if (currentSegmentWidth > 0) {
      patternTail += paintAnsi(" ".repeat(currentSegmentWidth), currentStyle, options);
    }

    currentStyle = style;
    currentSegmentWidth = 1;
  }

  if (currentSegmentWidth > 0) {
    patternTail += paintAnsi(" ".repeat(currentSegmentWidth), currentStyle, options);
  }

  return patternTail;
}

function buildMonochromePatternTail(width: number, rowIndex: number): string {
  let patternTail = "";

  for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
    const intensity = getPatternIntensity(width, rowIndex, columnIndex);
    const characterIndex = Math.min(
      monochromePatternCharacters.length - 1,
      Math.floor(intensity * monochromePatternCharacters.length),
    );
    patternTail += monochromePatternCharacters[characterIndex]!;
  }

  return patternTail;
}

function getPatternIntensity(
  width: number,
  rowIndex: number,
  columnIndex: number,
): number {
  const normalizedColumn =
    width <= 1 ? 0 : columnIndex / Math.max(1, width - 1);
  const envelope = 0.18 + 0.82 * Math.pow(normalizedColumn, 0.82);
  const wave =
    Math.sin((columnIndex + rowIndex * 1.9) / 2.9) * 0.22 +
    Math.cos((columnIndex - rowIndex * 2.7) / 6.3) * 0.18 +
    Math.sin((columnIndex + rowIndex * 3.4) / 10.5) * 0.12;
  const blockOffset =
    ((Math.floor(columnIndex / 2) + rowIndex) % 2 === 0 ? 0.06 : -0.04) +
    (rowIndex === 0 ? -0.06 : 0);
  return clamp(envelope + wave + blockOffset, 0, 1);
}

function getPatternCellStyle(intensity: number): string {
  const colorIndex = Math.min(
    patternColors.length - 1,
    Math.floor(intensity * patternColors.length),
  );
  const color = patternColors[colorIndex]!;

  return `48;2;${color.red};${color.green};${color.blue}`;
}

function clamp(value: number, minValue: number, maxValue: number): number {
  return Math.min(maxValue, Math.max(minValue, value));
}

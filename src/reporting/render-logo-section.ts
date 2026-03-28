import { padRight } from "./report-formatting.ts";
import { buildBestPlaqueRows } from "./render-best-plaque.ts";
import { paintAnsi } from "./render-theme.ts";
import type { BestPlaque, RenderOptions } from "./types.ts";

const baseBackgroundStyle = "48;2;12;15;8";
const plaqueInsetColumns = 3;
const plaqueTextStyle = "1;38;2;244;235;164";
const wordmarkStyle = `${baseBackgroundStyle};1;38;2;210;198;108`;
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
  { red: 42, green: 50, blue: 16 },
  { red: 71, green: 81, blue: 24 },
  { red: 101, green: 112, blue: 31 },
  { red: 136, green: 145, blue: 39 },
  { red: 177, green: 169, blue: 58 },
];
const monochromePatternCharacters = ["░", "░", "▒", "▓", "█"];

export function buildLogoSection(
  requestedWidth: number,
  options: RenderOptions,
  bestPlaque: BestPlaque | null = null,
): string[] {
  const wordmarkWidth = Math.max(...wordmarkLines.map((line) => line.length));
  const sectionWidth = Math.max(requestedWidth, wordmarkWidth);
  const patternWidth = Math.max(0, sectionWidth - wordmarkWidth);
  const plaqueRows = bestPlaque
    ? buildBestPlaqueRows(
        bestPlaque,
        Math.max(0, patternWidth - plaqueInsetColumns),
      )
    : null;

  return wordmarkLines.map((line, rowIndex) => {
    const paddedWordmark = padRight(line, wordmarkWidth);
    const patternTail = buildPatternTail(
      patternWidth,
      rowIndex,
      options,
      plaqueRows?.[rowIndex] ?? "",
    );

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
  plaqueRowText: string,
): string {
  if (!options.colorEnabled) {
    return buildMonochromePatternTail(width, rowIndex, plaqueRowText);
  }

  const overlayCharacters = createOverlayCharacters(width, plaqueRowText);
  const cellStyles = Array.from({ length: width }, (_, columnIndex) =>
    getPatternCellStyle(getPatternIntensity(width, rowIndex, columnIndex))
  );
  let patternTail = "";
  let currentStyle = "";
  let currentSegment = "";

  for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
    const overlayCharacter = overlayCharacters[columnIndex]!;
    const style =
      overlayCharacter === null
        ? cellStyles[columnIndex]!
        : `${cellStyles[columnIndex]!};${plaqueTextStyle}`;
    if (style === currentStyle) {
      currentSegment += overlayCharacter ?? " ";
      continue;
    }

    if (currentSegment.length > 0) {
      patternTail += paintAnsi(currentSegment, currentStyle, options);
    }

    currentStyle = style;
    currentSegment = overlayCharacter ?? " ";
  }

  if (currentSegment.length > 0) {
    patternTail += paintAnsi(currentSegment, currentStyle, options);
  }

  return patternTail;
}

function buildMonochromePatternTail(
  width: number,
  rowIndex: number,
  plaqueRowText: string,
): string {
  const overlayCharacters = createOverlayCharacters(width, plaqueRowText);
  let patternTail = "";

  for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
    const overlayCharacter = overlayCharacters[columnIndex]!;
    if (overlayCharacter !== null) {
      patternTail += overlayCharacter;
      continue;
    }

    const intensity = getPatternIntensity(width, rowIndex, columnIndex);
    const characterIndex = Math.min(
      monochromePatternCharacters.length - 1,
      Math.floor(intensity * monochromePatternCharacters.length),
    );
    patternTail += monochromePatternCharacters[characterIndex]!;
  }

  return patternTail;
}

function createOverlayCharacters(
  width: number,
  plaqueRowText: string,
): Array<string | null> {
  const overlayCharacters: Array<string | null> = Array.from(
    { length: width },
    () => null,
  );
  for (
    let index = 0;
    index < plaqueRowText.length && plaqueInsetColumns + index < width;
    index += 1
  ) {
    overlayCharacters[plaqueInsetColumns + index] = plaqueRowText[index]!;
  }

  return overlayCharacters;
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

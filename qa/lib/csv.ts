import { readFile } from "node:fs/promises";

export async function readCsvRows(
  filePath: string,
): Promise<Record<string, string>[]> {
  const csvText = await readFile(filePath, "utf8");
  return parseCsvRows(csvText);
}

function parseCsvRows(csvText: string): Record<string, string>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  const headerLine = lines[0];
  const rowLines = lines.slice(1);

  if (!headerLine) {
    return [];
  }

  const headers = parseCsvLine(headerLine);

  return rowLines.map((rowLine) => {
    const values = parseCsvLine(rowLine);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      quoted = !quoted;
      continue;
    }

    if (character === "," && !quoted) {
      values.push(currentValue);
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  values.push(currentValue);
  return values;
}

export function splitPipeList(value: string): string[] {
  return value
    .split("|")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

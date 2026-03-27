import {
  expectObject,
  readIsoTimestamp,
  readString,
} from "./codex-log-values.ts";

export type CodexLogLine = {
  timestamp: Date;
  type: string;
  payload: unknown;
};

export function parseCodexLogLine(
  lineText: string,
  sourceFilePath: string,
  lineNumber: number,
): CodexLogLine {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(lineText);
  } catch (error) {
    throw new Error(
      `Failed to parse JSON in ${sourceFilePath}:${lineNumber}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const record = expectObject(
    parsedValue,
    `${sourceFilePath}:${lineNumber}`,
  );

  return {
    timestamp: readIsoTimestamp(
      record.timestamp,
      `${sourceFilePath}:${lineNumber}.timestamp`,
    ),
    type: readString(record, "type", `${sourceFilePath}:${lineNumber}`),
    payload: record.payload,
  };
}

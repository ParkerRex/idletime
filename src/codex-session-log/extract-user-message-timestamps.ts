import { expectObject, readOptionalString } from "./codex-log-values.ts";
import type { CodexLogLine } from "./codex-log-line.ts";

export function extractUserMessageTimestamps(records: CodexLogLine[]): Date[] {
  const timestamps: Date[] = [];

  for (const record of records) {
    if (record.type !== "event_msg") {
      continue;
    }

    const payload = expectObject(record.payload, "event_msg.payload");
    if (readOptionalString(payload, "type") === "user_message") {
      timestamps.push(record.timestamp);
    }
  }

  return timestamps;
}

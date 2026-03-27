import { expectObject } from "./codex-log-values.ts";
import type { SessionKind } from "./types.ts";

export function classifySessionKind(sourceValue: unknown): SessionKind {
  if (
    sourceValue === undefined ||
    sourceValue === "cli" ||
    sourceValue === "exec" ||
    sourceValue === "vscode"
  ) {
    return "direct";
  }

  const sourceRecord = expectObject(sourceValue, "session_meta.payload.source");
  if ("subagent" in sourceRecord) {
    return "subagent";
  }

  if ("custom" in sourceRecord) {
    return "direct";
  }

  throw new Error("Unsupported session source payload.");
}

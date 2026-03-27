import {
  expectObject,
  readOptionalString,
  readString,
} from "./codex-log-values.ts";
import type { CodexLogLine } from "./codex-log-line.ts";
import type {
  AgentSpawnRequest,
  TurnAttribution,
} from "./types.ts";

type TurnAttributionExtraction = {
  agentSpawnRequests: AgentSpawnRequest[];
  turnAttributions: TurnAttribution[];
};

export function extractTurnAttribution(
  records: CodexLogLine[],
): TurnAttributionExtraction {
  const agentSpawnRequests: AgentSpawnRequest[] = [];
  const turnAttributions: TurnAttribution[] = [];

  for (const record of records) {
    if (record.type === "turn_context") {
      const payload = expectObject(record.payload, "turn_context.payload");
      turnAttributions.push({
        turnId: readString(payload, "turn_id", "turn_context.payload"),
        timestamp: record.timestamp,
        cwd: readString(payload, "cwd", "turn_context.payload"),
        model: readOptionalString(payload, "model"),
        reasoningEffort: readOptionalString(payload, "effort"),
      });
      continue;
    }

    if (record.type !== "response_item") {
      continue;
    }

    const payload = expectObject(record.payload, "response_item.payload");
    if (
      readOptionalString(payload, "type") !== "function_call" ||
      readOptionalString(payload, "name") !== "spawn_agent"
    ) {
      continue;
    }

    const argumentsText = readString(
      payload,
      "arguments",
      "response_item.payload",
    );

    let parsedArguments: unknown;

    try {
      parsedArguments = JSON.parse(argumentsText);
    } catch (error) {
      throw new Error(
        `spawn_agent arguments are not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const argumentsRecord = expectObject(
      parsedArguments,
      "spawn_agent.arguments",
    );

    agentSpawnRequests.push({
      timestamp: record.timestamp,
      agentType: readOptionalString(argumentsRecord, "agent_type"),
      model: readOptionalString(argumentsRecord, "model"),
      reasoningEffort: readOptionalString(
        argumentsRecord,
        "reasoning_effort",
      ),
    });
  }

  return {
    agentSpawnRequests,
    turnAttributions,
  };
}

export function resolvePrimaryModel(
  turnAttributions: TurnAttribution[],
): string | null {
  for (let index = turnAttributions.length - 1; index >= 0; index -= 1) {
    const model = turnAttributions[index]?.model;
    if (model) {
      return model;
    }
  }

  return null;
}

export function resolvePrimaryReasoningEffort(
  turnAttributions: TurnAttribution[],
): string | null {
  for (let index = turnAttributions.length - 1; index >= 0; index -= 1) {
    const reasoningEffort = turnAttributions[index]?.reasoningEffort;
    if (reasoningEffort) {
      return reasoningEffort;
    }
  }

  return null;
}

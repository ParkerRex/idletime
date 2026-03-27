import {
  expectObject,
  readNumber,
} from "./codex-log-values.ts";
import type { TokenUsage } from "./types.ts";

export function zeroTokenUsage(): TokenUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    reasoningOutputTokens: 0,
    totalTokens: 0,
    practicalBurn: 0,
  };
}

export function readTokenUsage(
  value: unknown,
  label: string,
): TokenUsage {
  const record = expectObject(value, label);

  const inputTokens = readNumber(record, "input_tokens", label);
  const cachedInputTokens = readNumber(record, "cached_input_tokens", label);
  const outputTokens = readNumber(record, "output_tokens", label);
  const reasoningOutputTokens = readNumber(
    record,
    "reasoning_output_tokens",
    label,
  );
  const totalTokens = readNumber(record, "total_tokens", label);

  return {
    inputTokens,
    cachedInputTokens,
    outputTokens,
    reasoningOutputTokens,
    totalTokens,
    practicalBurn: inputTokens - cachedInputTokens + outputTokens,
  };
}

export function subtractTokenUsages(
  currentUsage: TokenUsage,
  previousUsage: TokenUsage,
): TokenUsage {
  const nextUsage = {
    inputTokens: currentUsage.inputTokens - previousUsage.inputTokens,
    cachedInputTokens:
      currentUsage.cachedInputTokens - previousUsage.cachedInputTokens,
    outputTokens: currentUsage.outputTokens - previousUsage.outputTokens,
    reasoningOutputTokens:
      currentUsage.reasoningOutputTokens -
      previousUsage.reasoningOutputTokens,
    totalTokens: currentUsage.totalTokens - previousUsage.totalTokens,
    practicalBurn: currentUsage.practicalBurn - previousUsage.practicalBurn,
  };

  for (const [key, value] of Object.entries(nextUsage)) {
    if (value < 0) {
      throw new Error(`Token usage regressed for ${key}.`);
    }
  }

  return nextUsage;
}

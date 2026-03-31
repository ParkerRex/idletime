import type { SessionKind } from "../codex-session-log/types.ts";
import { parseDurationToMs } from "../report-window/parse-duration.ts";
import { parseWakeWindow } from "../reporting/wake-window.ts";
import type {
  SessionFilters,
  SummaryGroupBy,
  WakeWindow,
} from "../reporting/types.ts";
import { CliUsageError } from "./cli-errors.ts";
import {
  isCliCommandName,
  renderCliHelpText,
  type CliCommandName,
} from "./command-registry.ts";

export type IdletimeCommandName = CliCommandName;
export type IdletimeOutputFormat = "json" | "text";

export type ParsedIdletimeCommand = {
  commandName: IdletimeCommandName;
  filters: SessionFilters;
  groupBy: SummaryGroupBy[];
  helpRequested: boolean;
  hourlyWindowMs: number;
  idleCutoffMs: number;
  outputFormat: IdletimeOutputFormat;
  shareMode: boolean;
  versionRequested: boolean;
  wakeWindow: WakeWindow | null;
};

const defaultIdleCutoffMs = parseDurationToMs("15m");
const defaultWindowMs = parseDurationToMs("24h");

export function parseIdletimeCommand(argv: string[]): ParsedIdletimeCommand {
  const args = [...argv];
  const firstArgument = args[0];
  const commandName: IdletimeCommandName = isCliCommandName(firstArgument)
    ? firstArgument
    : "last24h";
  if (isCliCommandName(firstArgument)) {
    args.shift();
  }
  const filters: SessionFilters = {
    workspaceOnlyPrefix: null,
    sessionKind: null,
    model: null,
    reasoningEffort: null,
  };
  const groupBy: SummaryGroupBy[] = [];
  let helpRequested = false;
  let hourlyWindowMs = defaultWindowMs;
  let idleCutoffMs = defaultIdleCutoffMs;
  let outputFormat: IdletimeOutputFormat = "text";
  let shareMode = false;
  let versionRequested = false;
  let wakeWindow: WakeWindow | null = null;

  while (args.length > 0) {
    const argument = args.shift();
    if (!argument) {
      break;
    }

    if (argument === "--help" || argument === "-h" || argument === "help") {
      helpRequested = true;
      continue;
    }

    if (argument === "--version" || argument === "-v" || argument === "version") {
      versionRequested = true;
      continue;
    }

    if (argument === "--json") {
      outputFormat = "json";
      continue;
    }

    if (argument === "--window") {
      hourlyWindowMs = parseDurationOption(readFlagValue(argument, args), argument);
      continue;
    }

    if (argument === "--idle-cutoff") {
      idleCutoffMs = parseDurationOption(readFlagValue(argument, args), argument);
      continue;
    }

    if (argument === "--workspace-only") {
      filters.workspaceOnlyPrefix = readFlagValue(argument, args);
      continue;
    }

    if (argument === "--global") {
      filters.workspaceOnlyPrefix = null;
      continue;
    }

    if (argument === "--session-kind") {
      filters.sessionKind = parseSessionKind(readFlagValue(argument, args));
      continue;
    }

    if (argument === "--model") {
      filters.model = readFlagValue(argument, args);
      continue;
    }

    if (argument === "--effort") {
      filters.reasoningEffort = readFlagValue(argument, args);
      continue;
    }

    if (argument === "--wake") {
      wakeWindow = parseWakeWindowOption(readFlagValue(argument, args), argument);
      continue;
    }

    if (argument === "--share") {
      shareMode = true;
      continue;
    }

    if (argument === "--group-by") {
      const dimension = readFlagValue(argument, args);
      if (dimension !== "model" && dimension !== "effort") {
        throw new CliUsageError(`Unsupported group-by dimension "${dimension}".`);
      }
      if (!groupBy.includes(dimension)) {
        groupBy.push(dimension);
      }
      continue;
    }

    throw new CliUsageError(`Unknown argument "${argument}".`);
  }

  if (!helpRequested && !versionRequested) {
    validateParsedCommand({
      commandName,
      filters,
      groupBy,
      hourlyWindowMs,
      idleCutoffMs,
      outputFormat,
      shareMode,
      wakeWindow,
    });
  }

  return {
    commandName,
    filters,
    groupBy,
    helpRequested,
    hourlyWindowMs,
    idleCutoffMs,
    outputFormat,
    shareMode,
    versionRequested,
    wakeWindow,
  };
}

export function renderHelpText(): string {
  return renderCliHelpText();
}

function validateParsedCommand(input: {
  commandName: IdletimeCommandName;
  filters: SessionFilters;
  groupBy: SummaryGroupBy[];
  hourlyWindowMs: number;
  idleCutoffMs: number;
  outputFormat: IdletimeOutputFormat;
  shareMode: boolean;
  wakeWindow: WakeWindow | null;
}): void {
  if (input.outputFormat === "json" && input.shareMode) {
    throw new CliUsageError("--share is only supported for human-readable output.");
  }

  if (input.commandName !== "refresh-bests") {
    if (input.commandName === "doctor" || input.commandName === "update") {
      const unsupportedFlags: string[] = [];

      if (input.outputFormat !== "text") {
        unsupportedFlags.push("--json");
      }
      if (input.shareMode) {
        unsupportedFlags.push("--share");
      }
      if (input.hourlyWindowMs !== defaultWindowMs) {
        unsupportedFlags.push("--window");
      }
      if (input.idleCutoffMs !== defaultIdleCutoffMs) {
        unsupportedFlags.push("--idle-cutoff");
      }
      if (input.wakeWindow) {
        unsupportedFlags.push("--wake");
      }
      if (input.groupBy.length > 0) {
        unsupportedFlags.push("--group-by");
      }
      if (input.filters.workspaceOnlyPrefix) {
        unsupportedFlags.push("--workspace-only");
      }
      if (input.filters.sessionKind) {
        unsupportedFlags.push("--session-kind");
      }
      if (input.filters.model) {
        unsupportedFlags.push("--model");
      }
      if (input.filters.reasoningEffort) {
        unsupportedFlags.push("--effort");
      }

      if (unsupportedFlags.length > 0) {
        throw new CliUsageError(
          `${input.commandName} does not support ${unsupportedFlags.join(", ")}.`,
        );
      }

      return;
    }

    return;
  }

  const unsupportedFlags: string[] = [];

  if (input.outputFormat !== "text") {
    unsupportedFlags.push("--json");
  }
  if (input.shareMode) {
    unsupportedFlags.push("--share");
  }
  if (input.hourlyWindowMs !== defaultWindowMs) {
    unsupportedFlags.push("--window");
  }
  if (input.idleCutoffMs !== defaultIdleCutoffMs) {
    unsupportedFlags.push("--idle-cutoff");
  }
  if (input.wakeWindow) {
    unsupportedFlags.push("--wake");
  }
  if (input.groupBy.length > 0) {
    unsupportedFlags.push("--group-by");
  }
  if (input.filters.workspaceOnlyPrefix) {
    unsupportedFlags.push("--workspace-only");
  }
  if (input.filters.sessionKind) {
    unsupportedFlags.push("--session-kind");
  }
  if (input.filters.model) {
    unsupportedFlags.push("--model");
  }
  if (input.filters.reasoningEffort) {
    unsupportedFlags.push("--effort");
  }

  if (unsupportedFlags.length > 0) {
    throw new CliUsageError(
      `refresh-bests does not support ${unsupportedFlags.join(", ")}.`,
    );
  }
}

function parseSessionKind(sessionKindText: string): SessionKind {
  if (sessionKindText === "direct" || sessionKindText === "subagent") {
    return sessionKindText;
  }

  throw new CliUsageError(`Unsupported session kind "${sessionKindText}".`);
}

function readFlagValue(flagName: string, args: string[]): string {
  const value = args.shift();
  if (!value) {
    throw new CliUsageError(`${flagName} requires a value.`);
  }

  return value;
}

function parseDurationOption(value: string, flagName: string): number {
  try {
    return parseDurationToMs(value);
  } catch (error) {
    throw new CliUsageError(formatOptionError(error, flagName));
  }
}

function parseWakeWindowOption(value: string, flagName: string): WakeWindow {
  try {
    return parseWakeWindow(value);
  } catch (error) {
    throw new CliUsageError(formatOptionError(error, flagName));
  }
}

function formatOptionError(error: unknown, fallbackFlagName: string): string {
  if (error instanceof Error) {
    return error.message;
  }

  return `${fallbackFlagName} is invalid.`;
}

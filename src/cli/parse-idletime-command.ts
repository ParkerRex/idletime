import type { SessionKind } from "../codex-session-log/types.ts";
import { parseDurationToMs } from "../report-window/parse-duration.ts";
import { parseWakeWindow } from "../reporting/wake-window.ts";
import type { SessionFilters, SummaryGroupBy, WakeWindow } from "../reporting/types.ts";

export type IdletimeCommandName = "hourly" | "last24h" | "today";

export type ParsedIdletimeCommand = {
  commandName: IdletimeCommandName;
  filters: SessionFilters;
  groupBy: SummaryGroupBy[];
  helpRequested: boolean;
  hourlyWindowMs: number;
  idleCutoffMs: number;
  shareMode: boolean;
  versionRequested: boolean;
  wakeWindow: WakeWindow | null;
};

const defaultIdleCutoffMs = parseDurationToMs("15m");
const defaultWindowMs = parseDurationToMs("24h");

export function parseIdletimeCommand(argv: string[]): ParsedIdletimeCommand {
  const args = [...argv];
  const firstArgument = args[0];
  const commandName: IdletimeCommandName = isCommandName(firstArgument)
    ? firstArgument
    : "last24h";
  if (isCommandName(firstArgument)) {
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

    if (argument === "--version" || argument === "-v") {
      versionRequested = true;
      continue;
    }

    if (argument === "--window") {
      hourlyWindowMs = parseDurationToMs(readFlagValue(argument, args));
      continue;
    }

    if (argument === "--idle-cutoff") {
      idleCutoffMs = parseDurationToMs(readFlagValue(argument, args));
      continue;
    }

    if (argument === "--workspace-only") {
      filters.workspaceOnlyPrefix = readFlagValue(argument, args);
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
      wakeWindow = parseWakeWindow(readFlagValue(argument, args));
      continue;
    }

    if (argument === "--share") {
      shareMode = true;
      continue;
    }

    if (argument === "--group-by") {
      const dimension = readFlagValue(argument, args);
      if (dimension !== "model" && dimension !== "effort") {
        throw new Error(`Unsupported group-by dimension "${dimension}".`);
      }
      if (!groupBy.includes(dimension)) {
        groupBy.push(dimension);
      }
      continue;
    }

    throw new Error(`Unknown argument "${argument}".`);
  }

  return {
    commandName,
    filters,
    groupBy,
    helpRequested,
    hourlyWindowMs,
    idleCutoffMs,
    shareMode,
    versionRequested,
    wakeWindow,
  };
}

export function renderHelpText(): string {
  return [
    "idletime",
    "Track Codex focus, activity, idle time, and token burn from local session logs.",
    "",
    "Usage:",
    "  idletime [last24h|today|hourly] [options]",
    "  inside this repo: bun run idletime [last24h|today|hourly] [options]",
    "",
    "Modes:",
    "  last24h   default. visual trailing-24h dashboard with rhythm, spikes, and stats",
    "  today     local-midnight-to-now summary for the current day",
    "  hourly    trailing-window chart plus the detailed per-hour table",
    "",
    "How To Read The Dashboard:",
    "  focus     strict engagement inferred from actual user_message arrivals",
    "  active    broader direct-session activity in the main thread",
    "  idle      awake idle time when you pass --wake",
    "  quiet     non-active time when no wake window is supplied",
    "  burn      practical burn = input - cached_input + output",
    "",
    "Options:",
    "  --window <24h>          trailing window for hourly or last24h",
    "  --idle-cutoff <15m>     how long activity stays live after the last event",
    "  --workspace-only <dir>  include only sessions whose cwd starts with this path",
    "  --session-kind <kind>   direct or subagent",
    "  --model <name>          include only one primary model",
    "  --effort <level>        include only one primary reasoning effort",
    "  --wake <HH:MM-HH:MM>    turn quiet time into real awake idle time",
    "  --group-by <dimension>  model or effort; repeatable for summaries",
    "  --share                 trim the output into a screenshot card",
    "  --version               print the CLI version",
    "",
    "Examples:",
    "  idletime",
    "  idletime --wake 07:45-23:30",
    "  idletime --wake 07:45-23:30 --share",
    "  idletime today --workspace-only /path/to/demo-workspace",
    "  idletime hourly --window 24h --workspace-only /path/to/demo-workspace",
    "  idletime --version",
  ].join("\n");
}

function isCommandName(value: string | undefined): value is IdletimeCommandName {
  return value === "hourly" || value === "last24h" || value === "today";
}

function parseSessionKind(sessionKindText: string): SessionKind {
  if (sessionKindText === "direct" || sessionKindText === "subagent") {
    return sessionKindText;
  }

  throw new Error(`Unsupported session kind "${sessionKindText}".`);
}

function readFlagValue(flagName: string, args: string[]): string {
  const value = args.shift();
  if (!value) {
    throw new Error(`${flagName} requires a value.`);
  }

  return value;
}

export type CliCommandName =
  | "doctor"
  | "hourly"
  | "last24h"
  | "live"
  | "refresh-bests"
  | "update"
  | "today";

type CliCommandGroup = "mode" | "support";

export type CliCommandDefinition = {
  example: string;
  group: CliCommandGroup;
  name: CliCommandName;
  summary: string;
};

const cliCommandDefinitions = [
  {
    name: "last24h",
    group: "mode",
    summary: "default trailing-24h dashboard with rhythm, spikes, and stats",
    example: "idletime",
  },
  {
    name: "today",
    group: "mode",
    summary: "local-midnight-to-now summary for the current day",
    example: "idletime today",
  },
  {
    name: "hourly",
    group: "mode",
    summary: "trailing-window chart plus the detailed per-hour table",
    example: "idletime hourly --window 24h",
  },
  {
    name: "live",
    group: "mode",
    summary: "repainting task scoreboard; global by default",
    example: "idletime live",
  },
  {
    name: "refresh-bests",
    group: "support",
    summary: "full-history best-metrics refresh; updates BEST records",
    example: "idletime refresh-bests",
  },
  {
    name: "update",
    group: "support",
    summary: "install-aware update guidance for the current copy",
    example: "idletime update",
  },
  {
    name: "doctor",
    group: "support",
    summary: "environment and support diagnostics",
    example: "idletime doctor",
  },
] as const satisfies readonly CliCommandDefinition[];

const cliCommandNameSet = new Set<CliCommandName>(
  cliCommandDefinitions.map((definition) => definition.name),
);

export const commandUsageText =
  "idletime [last24h|today|hourly|live|refresh-bests|update|doctor] [options]";
export const launcherDefaultCommandName: CliCommandName = "last24h";

export function isCliCommandName(
  value: string | undefined,
): value is CliCommandName {
  return value !== undefined && cliCommandNameSet.has(value as CliCommandName);
}

export function getCliCommandDefinitions(): readonly CliCommandDefinition[] {
  return cliCommandDefinitions;
}

export function renderCliHelpText(): string {
  const modeDefinitions = cliCommandDefinitions.filter(
    (definition) => definition.group === "mode",
  );
  const supportDefinitions = cliCommandDefinitions.filter(
    (definition) => definition.group === "support",
  );

  return [
    "idletime",
    "Track Codex focus, activity, idle time, and token burn from local session logs.",
    "",
    "Usage:",
    `  ${commandUsageText}`,
    "  inside this repo: bun run idletime [last24h|today|hourly|live|refresh-bests|update|doctor] [options]",
    "  bare `idletime` opens the launcher when run in a terminal",
    "",
    "Modes:",
    ...renderHelpEntries(modeDefinitions),
    "",
    "Support:",
    ...renderHelpEntries(supportDefinitions),
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
    "  --json                  print a machine-readable JSON snapshot",
    "  --idle-cutoff <15m>     how long activity stays live after the last event",
    "  --global                clear workspace scoping and read all sessions",
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
    ...cliCommandDefinitions.map((definition) => `  ${definition.example}`),
    "  idletime --json",
    "  idletime live --json",
    "  idletime --version",
  ].join("\n");
}

function renderHelpEntries(
  definitions: readonly CliCommandDefinition[],
): string[] {
  return definitions.map(
    (definition) => `  ${definition.name.padEnd(14)} ${definition.summary}`,
  );
}

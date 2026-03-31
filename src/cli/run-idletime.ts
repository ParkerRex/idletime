import packageJson from "../../package.json";
import { reportCliError } from "./cli-errors.ts";
import { renderCliHelpText } from "./command-registry.ts";
import {
  parseIdletimeCommand,
  type ParsedIdletimeCommand,
} from "./parse-idletime-command.ts";
import {
  buildHourlyCommandResult,
  runHourlyCommand,
} from "./run-hourly-command.ts";
import {
  buildLast24hCommandResult,
  runLast24hCommand,
} from "./run-last24h-command.ts";
import { runLauncherCommand } from "./run-launcher-command.ts";
import { runLiveCommand, takeLiveSnapshot } from "./run-live-command.ts";
import { runDoctorCommand } from "./run-doctor-command.ts";
import { runRefreshBestsCommand } from "./run-refresh-bests-command.ts";
import { runUpdateCommand } from "./run-update-command.ts";
import {
  buildTodayCommandResult,
  runTodayCommand,
} from "./run-today-command.ts";
import {
  serializeHourlySnapshot,
} from "../reporting/serialize-hourly-report.ts";
import {
  serializeLiveSnapshot,
} from "../reporting/serialize-live-report.ts";
import {
  serializeSummarySnapshot,
} from "../reporting/serialize-summary-report.ts";
import type {
  JsonHourlySnapshotCommand,
  JsonLiveSnapshotCommand,
  JsonSummarySnapshotCommand,
} from "../reporting/types.ts";

export async function runIdletimeCli(argv: string[]): Promise<void> {
  try {
    const command = parseIdletimeCommand(argv);

    if (command.helpRequested) {
      console.log(renderCliHelpText());
      return;
    }

    if (command.versionRequested) {
      console.log(packageJson.version);
      return;
    }

    if (shouldOpenLauncher(argv)) {
      await runLauncherSelection(await runLauncherCommand(), command);
      return;
    }

    await runCommand(command);
  } catch (error) {
    reportCliError(error);
  }
}

async function runLauncherSelection(
  selection:
  | "doctor"
  | "help"
  | "quit"
  | "version"
  | "hourly"
  | "last24h"
  | "live"
  | "refresh-bests"
  | "update"
  | "today",
  command: ParsedIdletimeCommand,
): Promise<void> {
  if (selection === "quit") {
    return;
  }

  if (selection === "help") {
    console.log(renderCliHelpText());
    return;
  }

  if (selection === "version") {
    console.log(packageJson.version);
    return;
  }

  if (selection === "doctor") {
    console.log(runDoctorCommand());
    return;
  }

  if (selection === "update") {
    console.log(runUpdateCommand());
    return;
  }

  const selectedCommandName = selection as ParsedIdletimeCommand["commandName"];
  await runCommand({
    ...command,
    commandName: selectedCommandName,
  });
}

async function runCommand(command: ParsedIdletimeCommand): Promise<void> {
  if (command.commandName === "doctor") {
    console.log(runDoctorCommand());
    return;
  }

  if (command.commandName === "refresh-bests") {
    console.log(await runRefreshBestsCommand());
    return;
  }

  if (command.commandName === "update") {
    console.log(runUpdateCommand());
    return;
  }

  if (command.outputFormat === "json") {
    console.log(await buildJsonOutput(command));
    return;
  }

  if (command.commandName === "live") {
    await runLiveCommand(command);
    return;
  }

  const output =
    command.commandName === "hourly"
      ? await runHourlyCommand(command)
      : command.commandName === "today"
        ? await runTodayCommand(command)
        : await runLast24hCommand(command);

  console.log(output);
}

async function buildJsonOutput(command: ParsedIdletimeCommand): Promise<string> {
  const generatedAt = new Date();

  if (command.commandName === "live") {
    const liveSnapshot = await takeLiveSnapshot(command, {
      observedAt: generatedAt,
    });

    return serializeLiveSnapshot({
      command: buildJsonLiveSnapshotCommand(command),
      generatedAt,
      liveReport: liveSnapshot,
    });
  }

  if (command.commandName === "hourly") {
    const commandResult = await buildHourlyCommandResult(command, {
      now: generatedAt,
    });

    return serializeHourlySnapshot({
      command: buildJsonHourlySnapshotCommand(command),
      generatedAt,
      hourlyReport: commandResult.hourlyReport,
    });
  }

  if (command.commandName === "today") {
    const commandResult = await buildTodayCommandResult(command, {
      now: generatedAt,
    });

    return serializeSummarySnapshot({
      command: buildJsonSummarySnapshotCommand(command),
      generatedAt,
      hourlyReport: null,
      mode: "today",
      summaryReport: commandResult.summaryReport,
    });
  }

  const commandResult = await buildLast24hCommandResult(command, {
    now: generatedAt,
  });

  return serializeSummarySnapshot({
    command: buildJsonSummarySnapshotCommand(command),
    generatedAt,
    hourlyReport: commandResult.hourlyReport,
    mode: "last24h",
    summaryReport: commandResult.summaryReport,
  });
}

function shouldOpenLauncher(argv: string[]): boolean {
  return argv.length === 0 && process.stdout.isTTY && process.stdin.isTTY;
}

function buildJsonSummarySnapshotCommand(
  command: ParsedIdletimeCommand,
): JsonSummarySnapshotCommand {
  return {
    idleCutoffMs: command.idleCutoffMs,
    filters: { ...command.filters },
    groupBy: [...command.groupBy],
    wakeWindow: command.wakeWindow ? { ...command.wakeWindow } : null,
  };
}

function buildJsonHourlySnapshotCommand(
  command: ParsedIdletimeCommand,
): JsonHourlySnapshotCommand {
  return {
    idleCutoffMs: command.idleCutoffMs,
    filters: { ...command.filters },
    wakeWindow: command.wakeWindow ? { ...command.wakeWindow } : null,
  };
}

function buildJsonLiveSnapshotCommand(
  command: ParsedIdletimeCommand,
): JsonLiveSnapshotCommand {
  return {
    filters: { ...command.filters },
  };
}

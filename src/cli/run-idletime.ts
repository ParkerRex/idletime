import packageJson from "../../package.json";
import { parseIdletimeCommand, renderHelpText } from "./parse-idletime-command.ts";
import { runHourlyCommand } from "./run-hourly-command.ts";
import { runLast24hCommand } from "./run-last24h-command.ts";
import { runTodayCommand } from "./run-today-command.ts";

export async function runIdletimeCli(argv: string[]): Promise<void> {
  const command = parseIdletimeCommand(argv);

  if (command.helpRequested) {
    console.log(renderHelpText());
    return;
  }

  if (command.versionRequested) {
    console.log(packageJson.version);
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

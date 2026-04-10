import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import {
  getCliCommandDefinitions,
  launcherDefaultCommandName,
  type CliCommandName,
} from "./command-registry.ts";
import { createRenderOptions, dim, paint } from "../reporting/render-theme.ts";
import { buildLogoSection } from "../reporting/render-logo-section.ts";

export type LauncherSelection =
  | "doctor"
  | "help"
  | "quit"
  | "version"
  | CliCommandName;

export async function runLauncherCommand(): Promise<LauncherSelection> {
  const renderOptions = createRenderOptions(false);
  const launcherWidth = Math.max(stdout.columns ?? 0, 72);

  console.log(buildLogoSection(launcherWidth, renderOptions).join("\n"));
  console.log("");
  console.log(paint("idletime launcher", "heading", renderOptions));
  console.log(dim("Choose a mode or press Enter for the default dashboard.", renderOptions));
  console.log("");

  for (const [index, definition] of getCliCommandDefinitions().entries()) {
    const alias =
      definition.name === "update"
        ? " (u)"
        : definition.name === "doctor"
          ? " (d)"
          : "";
    const label = `${index + 1}. ${definition.name.padEnd(14)}${alias.padEnd(4)} ${definition.summary}`;
    console.log(label);
  }

  console.log("h. help          v. version       q. quit");

  const answer = await promptForSelection(renderOptions);
  return interpretLauncherSelection(answer);
}

async function promptForSelection(
  renderOptions: ReturnType<typeof createRenderOptions>,
): Promise<string> {
  const interfaceHandle = createInterface({
    input: stdin,
    output: stdout,
    terminal: true,
  });

  return await new Promise<string>((resolve) => {
    let hasResolved = false;
    const finish = (value: string) => {
      if (hasResolved) {
        return;
      }

      hasResolved = true;
      interfaceHandle.close();
      resolve(value);
    };

    interfaceHandle.once("SIGINT", () => finish("q"));
    interfaceHandle.question(
      paint(`Select [Enter=${launcherDefaultCommandName}, 1-8, help, version, quit]: `, "value", renderOptions),
      (answer) => finish(answer),
    );
  });
}

export function interpretLauncherSelection(
  selectionText: string,
): LauncherSelection {
  const normalizedSelection = selectionText.trim().toLowerCase();

  if (
    normalizedSelection === "" ||
    normalizedSelection === "1" ||
    normalizedSelection === "last24h"
  ) {
    return "last24h";
  }

  if (normalizedSelection === "2" || normalizedSelection === "today") {
    return "today";
  }

  if (normalizedSelection === "3" || normalizedSelection === "week") {
    return "week";
  }

  if (normalizedSelection === "4" || normalizedSelection === "hourly") {
    return "hourly";
  }

  if (normalizedSelection === "5" || normalizedSelection === "live") {
    return "live";
  }

  if (
    normalizedSelection === "6" ||
    normalizedSelection === "update" ||
    normalizedSelection === "u"
  ) {
    return "update";
  }

  if (
    normalizedSelection === "7" ||
    normalizedSelection === "refresh-bests"
  ) {
    return "refresh-bests";
  }

  if (
    normalizedSelection === "8" ||
    normalizedSelection === "doctor" ||
    normalizedSelection === "d"
  ) {
    return "doctor";
  }

  if (normalizedSelection === "h" || normalizedSelection === "help") {
    return "help";
  }

  if (normalizedSelection === "v" || normalizedSelection === "version") {
    return "version";
  }

  if (normalizedSelection === "q" || normalizedSelection === "quit") {
    return "quit";
  }

  return "last24h";
}

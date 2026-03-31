import { homedir } from "node:os";
import { join } from "node:path";
import packageJson from "../../package.json";
import { getCliCommandDefinitions } from "./command-registry.ts";
import {
  detectInstallContext,
  renderInstallModeLine,
} from "./install-context.ts";

export function runDoctorCommand(): string {
  const homeDirectory = homedir();
  const sessionRootDirectory = join(homeDirectory, ".codex", "sessions");
  const stateDirectory = join(homeDirectory, ".idletime");
  const installContext = detectInstallContext();
  const supportedCommands = getCliCommandDefinitions()
    .map((definition) => definition.name)
    .join(", ");

  return [
    "idletime doctor",
    `Version: ${packageJson.version}`,
    `Platform: ${process.platform}`,
    `Node: ${process.version}`,
    `TTY: stdout=${booleanLabel(process.stdout.isTTY)} stdin=${booleanLabel(process.stdin.isTTY)}`,
    `Current directory: ${process.cwd()}`,
    renderInstallModeLine(installContext),
    `Session root: ${sessionRootDirectory}`,
    `Best state directory: ${stateDirectory}`,
    `Supported commands: ${supportedCommands}`,
    "Try: idletime --help, idletime, idletime live",
  ].join("\n");
}

function booleanLabel(value: boolean): string {
  return value ? "yes" : "no";
}

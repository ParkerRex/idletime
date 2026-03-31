import { describe, expect, test } from "bun:test";
import {
  detectInstallContext,
  renderInstallUpdateGuidance,
} from "../src/cli/install-context.ts";
import {
  parseIdletimeCommand,
  renderHelpText,
} from "../src/cli/parse-idletime-command.ts";
import { runDoctorCommand } from "../src/cli/run-doctor-command.ts";
import { interpretLauncherSelection } from "../src/cli/run-launcher-command.ts";

describe("idletime command parsing", () => {
  test("defaults to last24h without share mode", () => {
    const parsedCommand = parseIdletimeCommand([]);

    expect(parsedCommand.commandName).toBe("last24h");
    expect(parsedCommand.outputFormat).toBe("text");
    expect(parsedCommand.shareMode).toBe(false);
  });

  test("accepts share mode and wake window flags together", () => {
    const parsedCommand = parseIdletimeCommand([
      "--share",
      "--wake",
      "07:45-23:30",
    ]);

    expect(parsedCommand.commandName).toBe("last24h");
    expect(parsedCommand.shareMode).toBe(true);
    expect(parsedCommand.wakeWindow?.label).toBe("07:45-23:30");
  });

  test("accepts the live command", () => {
    const parsedCommand = parseIdletimeCommand(["live"]);

    expect(parsedCommand.commandName).toBe("live");
    expect(parsedCommand.filters.workspaceOnlyPrefix).toBeNull();
  });

  test("accepts explicit global live scope", () => {
    const parsedCommand = parseIdletimeCommand(["live", "--global"]);

    expect(parsedCommand.commandName).toBe("live");
    expect(parsedCommand.filters.workspaceOnlyPrefix).toBeNull();
  });

  test("accepts the json output flag", () => {
    const parsedCommand = parseIdletimeCommand(["hourly", "--json"]);

    expect(parsedCommand.commandName).toBe("hourly");
    expect(parsedCommand.outputFormat).toBe("json");
  });

  test("accepts refresh-bests as a command", () => {
    const parsedCommand = parseIdletimeCommand(["refresh-bests"]);

    expect(parsedCommand.commandName).toBe("refresh-bests");
  });

  test("accepts update as a command", () => {
    const parsedCommand = parseIdletimeCommand(["update"]);

    expect(parsedCommand.commandName).toBe("update");
  });

  test("accepts doctor as a command", () => {
    const parsedCommand = parseIdletimeCommand(["doctor"]);

    expect(parsedCommand.commandName).toBe("doctor");
  });

  test("rejects share mode in json output", () => {
    expect(() => parseIdletimeCommand(["--json", "--share"])).toThrow(
      "--share is only supported for human-readable output.",
    );
  });

  test("rejects dashboard flags on refresh-bests", () => {
    expect(() =>
      parseIdletimeCommand(["refresh-bests", "--workspace-only", "/tmp/demo"]),
    ).toThrow("refresh-bests does not support --workspace-only.");
  });

  test("rejects other unsupported flags on refresh-bests", () => {
    expect(() => parseIdletimeCommand(["refresh-bests", "--json"])).toThrow(
      "refresh-bests does not support --json.",
    );
    expect(() =>
      parseIdletimeCommand(["refresh-bests", "--window", "12h"]),
    ).toThrow("refresh-bests does not support --window.");
    expect(() =>
      parseIdletimeCommand(["refresh-bests", "--group-by", "model"]),
    ).toThrow("refresh-bests does not support --group-by.");
  });

  test("rejects dashboard flags on update", () => {
    expect(() => parseIdletimeCommand(["update", "--json"])).toThrow(
      "update does not support --json.",
    );
  });

  test("lets help short-circuit before refresh-bests flag validation", () => {
    const parsedCommand = parseIdletimeCommand([
      "refresh-bests",
      "--help",
      "--workspace-only",
      "/tmp/demo",
    ]);

    expect(parsedCommand.helpRequested).toBe(true);
  });

  test("renders help text with the doctor command and launcher note", () => {
    const helpText = renderHelpText();

    expect(helpText).toContain("doctor");
    expect(helpText).toContain("update");
    expect(helpText).toContain("bare `idletime` opens the launcher");
  });

  test("renders doctor output with environment details", () => {
    const doctorText = runDoctorCommand();

    expect(doctorText).toContain("idletime doctor");
    expect(doctorText).toContain("Install mode:");
    expect(doctorText).toContain("Session root:");
    expect(doctorText).toContain("Best state directory:");
  });

  test("renders install update guidance for each supported mode", () => {
    expect(renderInstallUpdateGuidance({ mode: "bun-global" })).toContain(
      "bun add -g idletime@latest --force",
    );
    expect(renderInstallUpdateGuidance({ mode: "npm-global" })).toContain(
      "npm install -g idletime@latest",
    );
    expect(renderInstallUpdateGuidance({ mode: "source-tree" })).toContain(
      "This checkout is not updated through the packaged-binary path.",
    );
    expect(renderInstallUpdateGuidance({ mode: "bunx" })).toContain(
      "bunx idletime@latest --help",
    );
    expect(renderInstallUpdateGuidance({ mode: "npx" })).toContain(
      "npx idletime@latest --help",
    );
    expect(renderInstallUpdateGuidance({ mode: "unknown" })).toContain(
      "Run idletime doctor or see the README install section.",
    );
  });

  test("detects install mode from runtime paths and hints", () => {
    expect(
      detectInstallContext({
        argv1: "/Users/parkerrex/Projects/idletime/src/cli/idletime-bin.ts",
        env: {},
        execPath: "/usr/bin/node",
        modulePath: "/Users/parkerrex/Projects/idletime/src/cli/install-context.ts",
      }).mode,
    ).toBe("source-tree");

    expect(
      detectInstallContext({
        argv1: "/tmp/bun/install/global/node_modules/idletime/dist/idletime.js",
        env: { BUN_INSTALL: "/tmp/bun" },
        execPath: "/usr/bin/node",
        modulePath: "/tmp/bun/install/global/node_modules/idletime/dist/idletime.js",
      }).mode,
    ).toBe("bun-global");

    expect(
      detectInstallContext({
        argv1: "/tmp/npm/_npx/abc/node_modules/idletime/dist/idletime.js",
        env: { npm_execpath: "/usr/local/lib/node_modules/npm/bin/npx-cli.js" },
        execPath: "/usr/bin/node",
        modulePath: "/tmp/npm/_npx/abc/node_modules/idletime/dist/idletime.js",
      }).mode,
    ).toBe("npx");

    expect(
      detectInstallContext({
        argv1: "/tmp/bun/install/cache/idletime@0.2.0/node_modules/idletime/dist/idletime.js",
        env: { npm_config_user_agent: "bun/1.3.5 bunx" },
        execPath: "/usr/bin/node",
        modulePath: "/tmp/bun/install/cache/idletime@0.2.0/node_modules/idletime/dist/idletime.js",
      }).mode,
    ).toBe("bunx");
  });

  test("interprets launcher selections without state", () => {
    expect(interpretLauncherSelection("")).toBe("last24h");
    expect(interpretLauncherSelection("d")).toBe("doctor");
    expect(interpretLauncherSelection("5")).toBe("update");
    expect(interpretLauncherSelection("6")).toBe("refresh-bests");
  });
});

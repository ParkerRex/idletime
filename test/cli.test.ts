import { describe, expect, test } from "bun:test";
import { parseIdletimeCommand } from "../src/cli/parse-idletime-command.ts";

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

  test("lets help short-circuit before refresh-bests flag validation", () => {
    const parsedCommand = parseIdletimeCommand([
      "refresh-bests",
      "--help",
      "--workspace-only",
      "/tmp/demo",
    ]);

    expect(parsedCommand.helpRequested).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import { parseIdletimeCommand } from "../src/cli/parse-idletime-command.ts";

describe("idletime command parsing", () => {
  test("defaults to last24h without share mode", () => {
    const parsedCommand = parseIdletimeCommand([]);

    expect(parsedCommand.commandName).toBe("last24h");
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
});

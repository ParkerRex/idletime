import { readCodexSessions } from "../codex-session-log/read-codex-sessions.ts";
import { resolveTrailingReportWindow } from "../report-window/resolve-report-window.ts";
import { buildLiveReport } from "../reporting/build-live-report.ts";
import {
  renderLiveErrorReport,
  renderLiveReport,
} from "../reporting/render-live-report.ts";
import { createRenderOptions } from "../reporting/render-theme.ts";
import type { LiveReport } from "../reporting/types.ts";
import type { ParsedIdletimeCommand } from "./parse-idletime-command.ts";

const liveRefreshIntervalMs = 5_000;
const enterLiveScreenSequence = "\u001b[?1049h\u001b[2J\u001b[H\u001b[?25l";
const exitLiveScreenSequence = "\u001b[0m\u001b[?25h\u001b[?1049l";

export async function runLiveCommand(
  command: ParsedIdletimeCommand,
): Promise<void> {
  const renderOptions = createRenderOptions(false);

  if (!process.stdout.isTTY) {
    const liveReport = await takeLiveSnapshot(command);

    console.log(
      renderLiveReport(liveReport, renderOptions),
    );
    return;
  }

  let shouldStop = false;
  let previousFrameLineCount = 0;
  const canCaptureInput =
    process.stdin.isTTY && typeof process.stdin.setRawMode === "function";
  const stopLiveLoop = () => {
    shouldStop = true;
  };
  const handleInput = (input: Buffer | string) => {
    const inputText = typeof input === "string" ? input : input.toString("utf8");

    if (inputText.includes("\u0003") || inputText.toLowerCase().includes("q")) {
      stopLiveLoop();
    }
  };
  process.on("SIGINT", stopLiveLoop);
  process.on("SIGTERM", stopLiveLoop);
  if (canCaptureInput) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", handleInput);
  }
  process.stdout.write(enterLiveScreenSequence);

  try {
    while (!shouldStop) {
      const observedAt = new Date();

      try {
        const liveReport = await takeLiveSnapshot(command, {
          observedAt,
        });
        previousFrameLineCount = drawFrame(
          renderLiveReport(liveReport, renderOptions),
          previousFrameLineCount,
        );
      } catch (error) {
        previousFrameLineCount = drawFrame(
          renderLiveErrorReport(command.filters.workspaceOnlyPrefix, error, renderOptions),
          previousFrameLineCount,
        );
      }

      if (shouldStop) {
        break;
      }

      await waitForNextRefresh();
    }
  } finally {
    process.off("SIGINT", stopLiveLoop);
    process.off("SIGTERM", stopLiveLoop);
    if (canCaptureInput) {
      process.stdin.off("data", handleInput);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    process.stdout.write(exitLiveScreenSequence);
  }
}

export async function takeLiveSnapshot(
  command: ParsedIdletimeCommand,
  options: {
    observedAt?: Date;
    sessionRootDirectory?: string;
  } = {},
): Promise<LiveReport> {
  const observedAt = options.observedAt ?? new Date();
  const recentWindow = resolveTrailingReportWindow({
    durationMs: 24 * 60 * 60 * 1000,
    now: observedAt,
  });
  const sessionReadResult = await readCodexSessions({
    windowStart: recentWindow.start,
    windowEnd: observedAt,
    sessionRootDirectory: options.sessionRootDirectory,
  });
  const { sessions, warnings } = sessionReadResult;

  return buildLiveReport(sessions, {
    filters: command.filters,
    observedAt,
    sessionReadWarnings: warnings,
  });
}

function drawFrame(frameText: string, previousFrameLineCount: number): number {
  const frameLines = frameText.split("\n");

  process.stdout.write("\u001b[H");

  for (const [lineIndex, line] of frameLines.entries()) {
    if (lineIndex > 0) {
      process.stdout.write("\n\r");
    }

    process.stdout.write("\u001b[2K");
    process.stdout.write(line);
  }

  for (
    let lineIndex = frameLines.length;
    lineIndex < previousFrameLineCount;
    lineIndex += 1
  ) {
    process.stdout.write("\n\r\u001b[2K");
  }

  return frameLines.length;
}

function waitForNextRefresh(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, liveRefreshIntervalMs);
  });
}

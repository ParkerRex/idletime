import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { parseCodexStatusRateLimits } from "./parse-codex-status-rate-limits.ts";
import type {
  AppServerRunner,
  CodexLimitSource,
  CodexLimitWindowSnapshot,
  NormalizedCodexRateLimits,
  ReadCodexRateLimitsOptions,
} from "./types.ts";

const fixtureEnvKey = "IDLETIME_CODEX_RATE_LIMIT_FIXTURE";
const timeoutMsDefault = 10_000;

export async function readCodexRateLimits(
  options: ReadCodexRateLimitsOptions = {},
): Promise<NormalizedCodexRateLimits> {
  const now = options.now ?? new Date();
  const env = { ...process.env, ...options.env };
  const fixturePath = env[fixtureEnvKey];

  if (fixturePath) {
    try {
      return await readFixtureRateLimits(fixturePath, now);
    } catch (error) {
      return {
        availability: "unavailable",
        fetchedAt: now,
        fiveHourWindow: null,
        reason: error instanceof Error ? error.message : "fixture unavailable",
        source: "unavailable",
        weeklyWindow: null,
      };
    }
  }

  try {
    const appServerResponse = await readAppServerResponse({
      env,
      runAppServer: options.runAppServer,
      timeoutMs: options.timeoutMs ?? timeoutMsDefault,
    });
    const normalizedAppServerResponse = normalizeAppServerResponse(
      appServerResponse,
      now,
      "app-server",
    );

    if (normalizedAppServerResponse.availability === "available") {
      return normalizedAppServerResponse;
    }
  } catch (error) {
    return readFallbackRateLimits({
      env,
      now,
      readStatusText: options.readStatusText,
      reason: error instanceof Error ? error.message : "codex rate limits unavailable",
      timeoutMs: options.timeoutMs ?? timeoutMsDefault,
    });
  }

  return readFallbackRateLimits({
    env,
    now,
    readStatusText: options.readStatusText,
    reason: "no rate limits available",
    timeoutMs: options.timeoutMs ?? timeoutMsDefault,
  });
}

async function readFixtureRateLimits(
  fixturePath: string,
  now: Date,
): Promise<NormalizedCodexRateLimits> {
  const rawFixtureText = await readFile(fixturePath, "utf8");
  const parsedFixture = parseAppServerText(rawFixtureText);
  if (typeof parsedFixture === "string") {
    const parsedStatus = parseCodexStatusRateLimits(parsedFixture, now);
    if (parsedStatus) {
      return {
        availability: "available",
        fetchedAt: parsedStatus.fetchedAt,
        fiveHourWindow: parsedStatus.fiveHourWindow,
        source: "fixture",
        weeklyWindow: parsedStatus.weeklyWindow,
      };
    }
  }

  return normalizeAnyRateLimitPayload(parsedFixture, now, "fixture");
}

async function readAppServerResponse(options: {
  env: Record<string, string | undefined>;
  runAppServer?: AppServerRunner;
  timeoutMs: number;
}): Promise<unknown> {
  if (options.runAppServer) {
    const responseText = await options.runAppServer({
      env: options.env,
      input: buildAppServerTranscript(),
      timeoutMs: options.timeoutMs,
    });
    return parseAppServerText(responseText);
  }

  const executable = resolveCodexExecutable(options.env);
  const child = spawn(
    executable,
    ["-s", "read-only", "-a", "untrusted", "app-server"],
    {
      env: { ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    },
  );

  const stderrChunks: string[] = [];
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderrChunks.push(chunk);
  });

  const responsePromise = new Promise<unknown>((resolve, reject) => {
    const stdout = createInterface({ input: child.stdout });
    let resolved = false;
    let initializeAcknowledged = false;

    stdout.on("line", (line: string) => {
      const parsedLine = tryParseJson(line);
      if (!isRecord(parsedLine)) {
        return;
      }

      if (parsedLine.id === 1 && !initializeAcknowledged) {
        initializeAcknowledged = true;
        setTimeout(() => {
          child.stdin.write(
            `${JSON.stringify({ method: "initialized", params: {} })}\n`,
          );
          child.stdin.write(
            `${JSON.stringify({
              id: 2,
              method: "account/rateLimits/read",
              params: {},
            })}\n`,
          );
        }, 0);
        return;
      }

      if (parsedLine.id !== 2 || resolved) {
        return;
      }

      resolved = true;
      resolve(parsedLine.result ?? parsedLine);
      stdout.close();
      child.stdin.end();
      child.kill("SIGTERM");
    });

    child.once("error", reject);
    child.once("close", (code) => {
      if (resolved) {
        return;
      }
      if (code === 0) {
        reject(new Error("Codex app-server exited before returning rate limits."));
        return;
      }
      reject(new Error(`Codex app-server exited with code ${code ?? "unknown"}.`));
    });
  });

  child.stdin.write(
    `${JSON.stringify({
      id: 1,
      method: "initialize",
      params: {
        clientInfo: {
          name: "idletime",
          title: "idletime",
          version: "0.2.0",
        },
      },
    })}\n`,
  );

  return Promise.race([
    responsePromise,
    timeout(options.timeoutMs).then(() => {
      child.kill("SIGKILL");
      throw new Error(
        `Timed out reading Codex app-server: ${stderrChunks.join("").trim()}`,
      );
    }),
  ]);
}

function buildAppServerTranscript(): string {
  return [
    JSON.stringify({
      id: 1,
      method: "initialize",
      params: {
        clientInfo: {
          name: "idletime",
          title: "idletime",
          version: "0.2.0",
        },
      },
    }),
    JSON.stringify({
      method: "initialized",
      params: {},
    }),
    JSON.stringify({
      id: 2,
      method: "account/rateLimits/read",
      params: {},
    }),
  ].join("\n") + "\n";
}

async function tryReadStatusText(options: {
  env: Record<string, string | undefined>;
  readStatusText?: () => Promise<string>;
  timeoutMs: number;
}): Promise<string | null> {
  if (options.readStatusText) {
    return options.readStatusText();
  }

  const executable = resolveCodexExecutable(options.env);
  const child = spawn(executable, ["-s", "read-only", "-a", "untrusted"], {
    env: { ...options.env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdoutChunks.push(chunk);
  });
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk: string) => {
    stderrChunks.push(chunk);
  });

  child.stdin.write("/status\n");
  child.stdin.end();

  try {
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        child.once("exit", (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(`Codex status probe exited with code ${code ?? "unknown"}.`));
        });
        child.once("error", reject);
      }),
      timeout(options.timeoutMs).then(() => {
        child.kill("SIGKILL");
        throw new Error(
          `Timed out reading Codex status: ${stderrChunks.join("").trim()}`,
        );
      }),
    ]);
    return stdoutChunks.join("");
  } catch {
    return null;
  }
}

async function readFallbackRateLimits(options: {
  env: Record<string, string | undefined>;
  now: Date;
  readStatusText?: () => Promise<string>;
  reason: string;
  timeoutMs: number;
}): Promise<NormalizedCodexRateLimits> {
  const statusText = await tryReadStatusText({
    env: options.env,
    readStatusText: options.readStatusText,
    timeoutMs: options.timeoutMs,
  });

  if (statusText) {
    const parsedStatus = parseCodexStatusRateLimits(statusText, options.now);
    if (parsedStatus) {
      return {
        availability: "available",
        fetchedAt: parsedStatus.fetchedAt,
        fiveHourWindow: parsedStatus.fiveHourWindow,
        source: "status-fallback",
        weeklyWindow: parsedStatus.weeklyWindow,
      };
    }
  }

  return {
    availability: "unavailable",
    fetchedAt: options.now,
    fiveHourWindow: null,
    reason: options.reason,
    source: "unavailable",
    weeklyWindow: null,
  };
}

function normalizeAnyRateLimitPayload(
  payload: unknown,
  now: Date,
  source: CodexLimitSource,
): NormalizedCodexRateLimits {
  if (isRecord(payload)) {
    if ("fiveHourWindow" in payload || "weeklyWindow" in payload) {
      return normalizeNormalizedFixture(payload, now, source);
    }
    if ("rateLimitsByLimitId" in payload || "rateLimits" in payload) {
      return normalizeAppServerResponse(payload, now, source);
    }
  }

  throw new Error("Unsupported Codex limit fixture format.");
}

function normalizeAppServerResponse(
  payload: unknown,
  now: Date,
  source: CodexLimitSource,
): NormalizedCodexRateLimits {
  if (!isRecord(payload)) {
    throw new Error("Invalid Codex app-server response.");
  }

  const response = selectRateLimitsResponse(payload);
  return normalizeResponseObject(response ?? payload, now, source);
}

function selectRateLimitsResponse(payload: Record<string, unknown>): unknown {
  const byLimitId = payload.rateLimitsByLimitId;
  if (isRecord(byLimitId) && isRecord(byLimitId.codex)) {
    return byLimitId.codex;
  }

  if (isRecord(payload.rateLimits)) {
    return payload.rateLimits;
  }

  return null;
}

function normalizeNormalizedFixture(
  payload: Record<string, unknown>,
  now: Date,
  source: CodexLimitSource,
): NormalizedCodexRateLimits {
  return {
    availability: "available",
    fetchedAt: now,
    fiveHourWindow: normalizeWindow(
      isRecord(payload.fiveHourWindow) ? payload.fiveHourWindow : null,
    ),
    source,
    weeklyWindow: normalizeWindow(
      isRecord(payload.weeklyWindow) ? payload.weeklyWindow : null,
    ),
  };
}

function normalizeResponseObject(
  payload: unknown,
  now: Date,
  source: CodexLimitSource,
): NormalizedCodexRateLimits {
  if (!isRecord(payload)) {
    throw new Error("Invalid Codex rate-limit payload.");
  }

  const fiveHourWindow = normalizeWindow(
    isRecord(payload.primary) ? payload.primary : null,
  );
  const weeklyWindow = normalizeWindow(
    isRecord(payload.secondary) ? payload.secondary : null,
  );

  return {
    availability:
      fiveHourWindow || weeklyWindow ? "available" : "unavailable",
    fetchedAt: now,
    fiveHourWindow,
    reason:
      fiveHourWindow || weeklyWindow ? undefined : "no rate limits available",
    source,
    weeklyWindow,
  };
}

function normalizeWindow(
  payload: Record<string, unknown> | null,
): CodexLimitWindowSnapshot | null {
  if (!payload) {
    return null;
  }

  const usedPercent = toNumber(payload.usedPercent);
  const windowDurationMins = toNumber(payload.windowDurationMins);
  const resetsAt = payload.resetsAt;

  if (
    usedPercent === null ||
    windowDurationMins === null ||
    resetsAt === null ||
    resetsAt === undefined
  ) {
    return null;
  }

  const resetDate =
    resetsAt instanceof Date
      ? resetsAt
      : typeof resetsAt === "number"
        ? new Date(resetsAt * 1000)
        : typeof resetsAt === "string"
          ? Number.isFinite(Number(resetsAt))
            ? new Date(Number(resetsAt) * 1000)
            : new Date(resetsAt)
          : null;

  if (!resetDate || Number.isNaN(resetDate.getTime())) {
    return null;
  }

  return {
    resetsAt: resetDate,
    remainingPercent: Math.max(0, 100 - usedPercent),
    usedPercent,
    windowDurationMins,
  };
}

function parseAppServerText(value: string): unknown {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of [...lines].reverse()) {
    const parsed = tryParseJson(line);
    if (!parsed) {
      continue;
    }

    if (isRecord(parsed) && "result" in parsed) {
      return parsed.result;
    }

    return parsed;
  }

  return tryParseJson(value) ?? value;
}

function resolveCodexExecutable(env: Record<string, string | undefined>): string {
  return env.CODEX_BINARY?.trim() || "codex";
}

function timeout(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs);
  });
}

function tryParseJson(value: string): unknown | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

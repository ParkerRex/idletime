import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readCsvRows, splitPipeList } from "./lib/csv.ts";

const qaDirectoryPath = fileURLToPath(new URL("./", import.meta.url));
const repositoryRootPath = fileURLToPath(new URL("../", import.meta.url));
const packageJsonPath = join(repositoryRootPath, "package.json");

type JourneyRow = {
  journey_id: string;
  title: string;
  command: string;
  expected_substrings: string;
  forbidden_substrings: string;
};

const packageJson = await Bun.file(packageJsonPath).json();
const packageVersion = packageJson.version as string;
const journeyRows = (await readCsvRows(
  join(qaDirectoryPath, "data", "user-journeys.csv"),
)) as JourneyRow[];
const qaSandboxPath = await mkdtemp(join(tmpdir(), "idletime-qa-"));
const packDirectoryPath = join(qaSandboxPath, "pack");
const bunInstallPath = join(qaSandboxPath, "bun-install");
const homeDirectoryPath = join(qaSandboxPath, "home");

try {
  await mkdir(packDirectoryPath, { recursive: true });
  await mkdir(bunInstallPath, { recursive: true });
  await mkdir(homeDirectoryPath, { recursive: true });

  await seedCodexSessions(homeDirectoryPath);
  await runCommand(["bun", "run", "build"]);

  const packageArchivePath = await packPackage(packDirectoryPath);
  const installEnvironment = {
    ...process.env,
    BUN_INSTALL: bunInstallPath,
  };

  await runCommand(["bun", "add", "-g", packageArchivePath], installEnvironment);

  for (const journeyRow of journeyRows) {
    await runJourney(journeyRow, {
      ...installEnvironment,
      HOME: homeDirectoryPath,
      PATH: `${join(bunInstallPath, "bin")}:${process.env.PATH ?? ""}`,
    });
  }

  console.log(`QA shell journeys passed: ${journeyRows.length} scenarios.`);
} finally {
  await rm(qaSandboxPath, { force: true, recursive: true });
}

async function runJourney(
  journeyRow: JourneyRow,
  environment: NodeJS.ProcessEnv,
) {
  const commandOutput = await runShellCommand(journeyRow.command, environment);
  const expectedSubstrings = splitPipeList(
    interpolatePlaceholders(journeyRow.expected_substrings),
  );
  const forbiddenSubstrings = splitPipeList(journeyRow.forbidden_substrings);

  for (const expectedSubstring of expectedSubstrings) {
    if (!commandOutput.includes(expectedSubstring)) {
      throw new Error(
        `Journey ${journeyRow.journey_id} is missing expected text "${expectedSubstring}".`,
      );
    }
  }

  for (const forbiddenSubstring of forbiddenSubstrings) {
    if (commandOutput.includes(forbiddenSubstring)) {
      throw new Error(
        `Journey ${journeyRow.journey_id} matched forbidden text "${forbiddenSubstring}".`,
      );
    }
  }

  console.log(`PASS ${journeyRow.journey_id}: ${journeyRow.title}`);
}

function interpolatePlaceholders(value: string): string {
  return value.replaceAll("{{PACKAGE_VERSION}}", packageVersion);
}

async function packPackage(packDirectoryPath: string): Promise<string> {
  const packOutput = await runCommand(
    ["npm", "pack", "--json", "--pack-destination", packDirectoryPath],
  );
  const packEntries = JSON.parse(packOutput.stdout) as Array<{ filename: string }>;
  const packageArchiveName = packEntries[0]?.filename;

  if (!packageArchiveName) {
    throw new Error("npm pack did not return a package filename.");
  }

  return join(packDirectoryPath, packageArchiveName);
}

async function seedCodexSessions(homeDirectoryPath: string) {
  const now = new Date();
  const millisecondsSinceStartOfDay =
    now.getHours() * 60 * 60 * 1000 +
    now.getMinutes() * 60 * 1000 +
    now.getSeconds() * 1000 +
    now.getMilliseconds();
  const earliestSafeLookbackMs = Math.max(60_000, millisecondsSinceStartOfDay - 60_000);
  const lookbackMs = Math.min(10 * 60_000, earliestSafeLookbackMs);
  const directStart = new Date(now.getTime() - lookbackMs);
  const directTimes = [
    directStart,
    new Date(directStart.getTime() + 60_000),
    new Date(directStart.getTime() + 120_000),
    new Date(directStart.getTime() + 180_000),
    new Date(directStart.getTime() + 240_000),
  ];
  const subagentTime = new Date(directStart.getTime() + 210_000);

  const directSessionId = "qa-direct-session";
  const directSessionLines = [
    createRecord(directTimes[0]!, "session_meta", {
      id: directSessionId,
      timestamp: directTimes[0]!.toISOString(),
      cwd: "/tmp/idletime-qa-workspace",
      source: "cli",
    }),
    createRecord(directTimes[0]!, "turn_context", {
      turn_id: "qa-turn-1",
      cwd: "/tmp/idletime-qa-workspace",
      model: "gpt-5.4",
      effort: "high",
    }),
    createRecord(directTimes[0]!, "event_msg", {
      type: "user_message",
      message: "show me idle time",
    }),
    createRecord(directTimes[1]!, "event_msg", {
      type: "token_count",
      info: createTokenInfo(
        createTokenUsage(100, 20, 120),
        createTokenUsage(100, 20, 120),
      ),
    }),
    createRecord(directTimes[2]!, "event_msg", {
      type: "token_count",
      info: createTokenInfo(
        createTokenUsage(140, 40, 180),
        createTokenUsage(40, 20, 60),
      ),
    }),
    createRecord(directTimes[3]!, "event_msg", {
      type: "token_count",
      info: createTokenInfo(
        {
          input_tokens: 0,
          cached_input_tokens: 0,
          output_tokens: 0,
          reasoning_output_tokens: 0,
          total_tokens: 950000,
        },
        {
          input_tokens: 0,
          cached_input_tokens: 0,
          output_tokens: 0,
          reasoning_output_tokens: 0,
          total_tokens: 0,
        },
      ),
    }),
    createRecord(directTimes[4]!, "event_msg", {
      type: "token_count",
      info: createTokenInfo(
        {
          input_tokens: 25,
          cached_input_tokens: 0,
          output_tokens: 15,
          reasoning_output_tokens: 0,
          total_tokens: 950040,
        },
        {
          input_tokens: 25,
          cached_input_tokens: 0,
          output_tokens: 15,
          reasoning_output_tokens: 0,
          total_tokens: 40,
        },
      ),
    }),
  ];

  const subagentSessionLines = [
    createRecord(subagentTime, "session_meta", {
      id: "qa-subagent-session",
      timestamp: subagentTime.toISOString(),
      forked_from_id: directSessionId,
      cwd: "/tmp/idletime-qa-workspace",
      source: {
        subagent: {
          thread_spawn: {
            parent_thread_id: directSessionId,
            depth: 1,
            agent_nickname: "QAReviewer",
            agent_role: "reviewer",
          },
        },
      },
    }),
    createRecord(subagentTime, "turn_context", {
      turn_id: "qa-subagent-turn-1",
      cwd: "/tmp/idletime-qa-workspace",
      model: "gpt-5.4-mini",
      effort: "medium",
    }),
    createRecord(new Date(subagentTime.getTime() + 15_000), "event_msg", {
      type: "token_count",
      info: createTokenInfo(
        createTokenUsage(60, 10, 70),
        createTokenUsage(60, 10, 70),
      ),
    }),
  ];

  await writeSessionFile(homeDirectoryPath, directTimes[0]!, "qa-direct.jsonl", directSessionLines);
  await writeSessionFile(homeDirectoryPath, subagentTime, "qa-subagent.jsonl", subagentSessionLines);
}

async function writeSessionFile(
  homeDirectoryPath: string,
  timestamp: Date,
  filename: string,
  lines: string[],
) {
  const sessionsDirectoryPath = join(
    homeDirectoryPath,
    ".codex",
    "sessions",
    String(timestamp.getFullYear()),
    String(timestamp.getMonth() + 1).padStart(2, "0"),
    String(timestamp.getDate()).padStart(2, "0"),
  );

  await mkdir(sessionsDirectoryPath, { recursive: true });
  await writeFile(join(sessionsDirectoryPath, filename), `${lines.join("\n")}\n`);
}

function createRecord(timestamp: Date, type: string, payload: object): string {
  return JSON.stringify({
    timestamp: timestamp.toISOString(),
    type,
    payload,
  });
}

function createTokenUsage(
  inputTokens: number,
  outputTokens: number,
  totalTokens: number,
) {
  return {
    input_tokens: inputTokens,
    cached_input_tokens: 0,
    output_tokens: outputTokens,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

function createTokenInfo(totalUsage: object, lastUsage: object) {
  return {
    total_token_usage: totalUsage,
    last_token_usage: lastUsage,
    model_context_window: 950000,
  };
}

async function runShellCommand(
  commandText: string,
  environment: NodeJS.ProcessEnv,
): Promise<string> {
  const commandOutput = await runCommand(
    ["/bin/sh", "-lc", commandText],
    environment,
  );
  return `${commandOutput.stdout}${commandOutput.stderr}`;
}

async function runCommand(
  command: string[],
  environment: NodeJS.ProcessEnv = process.env,
) {
  const processHandle = Bun.spawn({
    cmd: command,
    cwd: repositoryRootPath,
    env: environment,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
  ]);
  const exitCode = await processHandle.exited;

  if (exitCode !== 0) {
    throw new Error(
      `Command failed (${command.join(" ")}):\n${stdout}${stderr}`.trim(),
    );
  }

  return { stdout, stderr };
}

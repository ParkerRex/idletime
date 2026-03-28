import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseCodexSession } from "../codex-session-log/parse-codex-session.ts";
import type { ParsedSession } from "../codex-session-log/types.ts";

type ReadAllCodexSessionsOptions = {
  sessionRootDirectory?: string;
};

const defaultSessionRootDirectory = join(homedir(), ".codex", "sessions");

export async function readAllCodexSessions(
  options: ReadAllCodexSessionsOptions = {},
): Promise<ParsedSession[]> {
  const sessionRootDirectory =
    options.sessionRootDirectory ?? defaultSessionRootDirectory;
  const sessionFiles = await listAllSessionFiles(sessionRootDirectory);
  const parsedSessionResults = await Promise.allSettled(
    sessionFiles.map((sessionFilePath) => parseCodexSession(sessionFilePath)),
  );
  const parsedSessions = parsedSessionResults.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

  return parsedSessions.sort(
    (leftSession, rightSession) =>
      leftSession.firstTimestamp.getTime() -
      rightSession.firstTimestamp.getTime(),
  );
}

async function listAllSessionFiles(rootDirectory: string): Promise<string[]> {
  const pendingDirectories = [rootDirectory];
  const sessionFiles: string[] = [];

  while (pendingDirectories.length > 0) {
    const currentDirectory = pendingDirectories.pop()!;
    const directoryEntries = await readDirectoryEntries(currentDirectory);

    for (const directoryEntry of directoryEntries) {
      const entryPath = join(currentDirectory, directoryEntry.name);
      if (directoryEntry.isDirectory()) {
        pendingDirectories.push(entryPath);
        continue;
      }

      if (directoryEntry.isFile() && directoryEntry.name.endsWith(".jsonl")) {
        sessionFiles.push(entryPath);
      }
    }
  }

  return sessionFiles.sort();
}

async function readDirectoryEntries(directoryPath: string) {
  try {
    return await readdir(directoryPath, { withFileTypes: true });
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      return [];
    }

    throw error;
  }
}

function isMissingDirectoryError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}

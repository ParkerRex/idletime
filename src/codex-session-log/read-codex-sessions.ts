import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseCodexSession } from "./parse-codex-session.ts";
import type { ParsedSession, SessionReadOptions } from "./types.ts";

const defaultSessionRootDirectory = join(homedir(), ".codex", "sessions");

export async function readCodexSessions(
  options: SessionReadOptions,
): Promise<ParsedSession[]> {
  if (options.windowEnd.getTime() < options.windowStart.getTime()) {
    throw new Error("windowEnd must be later than windowStart.");
  }

  const sessionRootDirectory =
    options.sessionRootDirectory ?? defaultSessionRootDirectory;
  const candidateFiles = await listCandidateSessionFiles(
    sessionRootDirectory,
    options.windowStart,
    options.windowEnd,
  );
  const parsedSessions = await Promise.all(
    candidateFiles.map((candidateFile) => parseCodexSession(candidateFile)),
  );

  return parsedSessions
    .filter(
      (parsedSession) =>
        parsedSession.lastTimestamp.getTime() >= options.windowStart.getTime() &&
        parsedSession.firstTimestamp.getTime() <= options.windowEnd.getTime(),
    )
    .sort(
      (leftSession, rightSession) =>
        leftSession.firstTimestamp.getTime() -
        rightSession.firstTimestamp.getTime(),
    );
}

async function listCandidateSessionFiles(
  sessionRootDirectory: string,
  windowStart: Date,
  windowEnd: Date,
): Promise<string[]> {
  const candidateDirectories = buildCandidateDirectories(
    sessionRootDirectory,
    windowStart,
    windowEnd,
  );
  const candidateFiles: string[] = [];

  for (const candidateDirectory of candidateDirectories) {
    const directoryEntries = await readDirectoryEntries(candidateDirectory);
    for (const directoryEntry of directoryEntries) {
      if (directoryEntry.isFile() && directoryEntry.name.endsWith(".jsonl")) {
        candidateFiles.push(join(candidateDirectory, directoryEntry.name));
      }
    }
  }

  return candidateFiles.sort();
}

function buildCandidateDirectories(
  sessionRootDirectory: string,
  windowStart: Date,
  windowEnd: Date,
): string[] {
  const firstDirectoryDate = startOfLocalDay(
    new Date(windowStart.getTime() - 24 * 60 * 60 * 1000),
  );
  const lastDirectoryDate = startOfLocalDay(windowEnd);
  const directories: string[] = [];

  for (
    const currentDate = new Date(firstDirectoryDate);
    currentDate.getTime() <= lastDirectoryDate.getTime();
    currentDate.setDate(currentDate.getDate() + 1)
  ) {
    directories.push(
      join(
        sessionRootDirectory,
        currentDate.getFullYear().toString().padStart(4, "0"),
        `${currentDate.getMonth() + 1}`.padStart(2, "0"),
        `${currentDate.getDate()}`.padStart(2, "0"),
      ),
    );
  }

  return directories;
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

function startOfLocalDay(timestamp: Date): Date {
  return new Date(
    timestamp.getFullYear(),
    timestamp.getMonth(),
    timestamp.getDate(),
    0,
    0,
    0,
    0,
  );
}

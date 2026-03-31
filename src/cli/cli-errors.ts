export const cliUsageErrorExitCode = 2;
export const cliInternalErrorExitCode = 1;

export class CliUsageError extends Error {
  override name = "CliUsageError";
}

export function isCliUsageError(error: unknown): error is CliUsageError {
  return error instanceof CliUsageError;
}

export function reportCliError(error: unknown): void {
  if (isCliUsageError(error)) {
    console.error(`Error: ${error.message}`);
    process.exitCode = cliUsageErrorExitCode;
    return;
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`Internal error: ${message}`);

  if (process.env.IDLETIME_DEBUG === "1" || process.env.MO_DEBUG === "1") {
    console.error(error);
  }

  console.error("Run `idletime doctor` for environment details.");
  process.exitCode = cliInternalErrorExitCode;
}

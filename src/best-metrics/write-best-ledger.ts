import { mkdir, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveBestLedgerPath, serializeBestLedger } from "./read-best-ledger.ts";
import type { BestLedgerWriteOptions, BestMetricsLedger } from "./types.ts";

export async function writeBestLedger(
  ledger: BestMetricsLedger,
  options: BestLedgerWriteOptions = {},
): Promise<void> {
  const ledgerPath = resolveBestLedgerPath(options);
  const stateDirectory = options.stateDirectory ?? ledgerPath.slice(
    0,
    ledgerPath.lastIndexOf("/"),
  );
  await mkdir(stateDirectory, { recursive: true });

  const temporaryPath = join(
    stateDirectory,
    `.bests-v1.${process.pid}.${Date.now()}.tmp`,
  );
  await writeFile(temporaryPath, serializeBestLedger(ledger), "utf8");
  await rename(temporaryPath, ledgerPath);
}

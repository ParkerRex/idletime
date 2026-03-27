import { chmod, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectoryPath = fileURLToPath(
  new URL("../../dist/", import.meta.url),
);
const outputFilePath = fileURLToPath(
  new URL("../../dist/idletime.js", import.meta.url),
);
const entrypointPath = fileURLToPath(
  new URL("../cli/idletime-bin.ts", import.meta.url),
);

await rm(outputDirectoryPath, { force: true, recursive: true });
await mkdir(outputDirectoryPath, { recursive: true });

const buildResult = await Bun.build({
  banner: "#!/usr/bin/env node",
  entrypoints: [entrypointPath],
  format: "esm",
  outdir: outputDirectoryPath,
  packages: "bundle",
  sourcemap: "none",
  target: "node",
});

if (!buildResult.success) {
  for (const logEntry of buildResult.logs) {
    console.error(logEntry.message);
  }

  process.exitCode = 1;
  throw new Error("Failed to build release package.");
}

await rename(join(outputDirectoryPath, "idletime-bin.js"), outputFilePath);
await chmod(outputFilePath, 0o755);
console.log("Built dist/idletime.js");

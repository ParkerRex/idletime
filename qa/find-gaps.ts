import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { readCsvRows } from "./lib/csv.ts";

const qaDirectoryPath = fileURLToPath(new URL("./", import.meta.url));
const repositoryRootPath = fileURLToPath(new URL("../", import.meta.url));

type CoverageRow = {
  surface: string;
  layer: string;
  required: string;
  status: string;
  evidence: string;
};

const journeyRows = await readCsvRows(
  join(qaDirectoryPath, "data", "user-journeys.csv"),
);
const coverageRows = (await readCsvRows(
  join(qaDirectoryPath, "data", "coverage-matrix.csv"),
)) as CoverageRow[];

const journeyIds = new Set(journeyRows.map((journeyRow) => journeyRow.journey_id));
const gaps: string[] = [];

for (const coverageRow of coverageRows) {
  if (coverageRow.required !== "yes") {
    continue;
  }

  if (coverageRow.status !== "covered") {
    gaps.push(
      `${coverageRow.surface} (${coverageRow.layer}) is required but marked ${coverageRow.status}.`,
    );
    continue;
  }

  if (coverageRow.evidence.startsWith("journey:")) {
    const journeyId = coverageRow.evidence.slice("journey:".length);
    if (!journeyIds.has(journeyId)) {
      gaps.push(
        `${coverageRow.surface} (${coverageRow.layer}) references missing journey ${journeyId}.`,
      );
    }
    continue;
  }

  if (coverageRow.evidence.startsWith("file:")) {
    const filePath = join(
      repositoryRootPath,
      coverageRow.evidence.slice("file:".length),
    );
    if (!existsSync(filePath)) {
      gaps.push(
        `${coverageRow.surface} (${coverageRow.layer}) references missing file ${coverageRow.evidence.slice("file:".length)}.`,
      );
    }
    continue;
  }

  gaps.push(
    `${coverageRow.surface} (${coverageRow.layer}) uses unsupported evidence reference ${coverageRow.evidence}.`,
  );
}

if (gaps.length > 0) {
  console.error("QA coverage gaps:");
  for (const gap of gaps) {
    console.error(`- ${gap}`);
  }
  process.exit(1);
}

console.log(
  `QA coverage matrix is complete: ${coverageRows.filter((coverageRow) => coverageRow.required === "yes").length} required checks mapped.`,
);

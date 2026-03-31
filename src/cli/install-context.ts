import { realpathSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

export type InstallMode =
  | "bun-global"
  | "bunx"
  | "npx"
  | "npm-global"
  | "source-tree"
  | "unknown";

export type InstallContext = {
  mode: InstallMode;
};

export type InstallContextProbe = {
  argv1: string | null;
  env: NodeJS.ProcessEnv;
  execPath: string;
  modulePath: string;
};

export function detectInstallContext(
  probe: InstallContextProbe = getInstallContextProbe(),
): InstallContext {
  const entrypointPath = resolvePath(probe.argv1);
  const modulePath = resolvePath(probe.modulePath);
  const execPath = resolvePath(probe.execPath);
  const candidatePaths = [entrypointPath, modulePath, execPath].filter(
    (path): path is string => path !== null,
  );

  if (
    candidatePaths.some((path) => hasSourceTreeMarker(path)) ||
    hasSourceTreeMarker(modulePath) ||
    hasSourceTreeMarker(entrypointPath)
  ) {
    return { mode: "source-tree" };
  }

  if (isBunxInstall(candidatePaths, probe.env)) {
    return { mode: "bunx" };
  }

  if (isNpxInstall(candidatePaths, probe.env)) {
    return { mode: "npx" };
  }

  if (isBunGlobalInstall(candidatePaths, probe.env)) {
    return { mode: "bun-global" };
  }

  if (isNpmGlobalInstall(candidatePaths)) {
    return { mode: "npm-global" };
  }

  return { mode: "unknown" };
}

export function getInstallContextProbe(): InstallContextProbe {
  return {
    argv1: process.argv[1] ?? null,
    env: process.env,
    execPath: process.execPath,
    modulePath: fileURLToPath(import.meta.url),
  };
}

export function renderInstallModeLine(context: InstallContext): string {
  return `Install mode: ${context.mode}`;
}

export function renderInstallUpdateGuidance(context: InstallContext): string {
  switch (context.mode) {
    case "bun-global":
      return [
        renderInstallModeLine(context),
        "Recommended update: bun add -g idletime@latest --force",
      ].join("\n");
    case "npm-global":
      return [
        renderInstallModeLine(context),
        "Recommended update: npm install -g idletime@latest",
      ].join("\n");
    case "bunx":
      return [
        renderInstallModeLine(context),
        "This is a one-off runner; there is nothing persistent to update.",
        "Next run: bunx idletime@latest --help",
      ].join("\n");
    case "npx":
      return [
        renderInstallModeLine(context),
        "This is a one-off runner; there is nothing persistent to update.",
        "Next run: npx idletime@latest --help",
      ].join("\n");
    case "source-tree":
      return [
        renderInstallModeLine(context),
        "This checkout is not updated through the packaged-binary path.",
        "Use git pull or your normal branch update flow, then run bun run idletime again.",
      ].join("\n");
    case "unknown":
      return [
        renderInstallModeLine(context),
        "I could not confidently determine how this copy of idletime was installed.",
        "Run idletime doctor or see the README install section.",
      ].join("\n");
  }
}

function isBunGlobalInstall(
  candidatePaths: readonly string[],
  env: NodeJS.ProcessEnv,
): boolean {
  const bunInstallRoot = resolvePath(env.BUN_INSTALL);
  if (!bunInstallRoot) {
    return false;
  }

  const globalMarkers = [
    "/install/global/",
    "/global/node_modules/idletime/",
    "/global/bin/",
  ];

  return candidatePaths.some(
    (path) =>
      path.startsWith(`${bunInstallRoot}/`) &&
      globalMarkers.some((marker) => path.includes(marker)),
  );
}

function isBunxInstall(
  candidatePaths: readonly string[],
  env: NodeJS.ProcessEnv,
): boolean {
  const userAgent = env.npm_config_user_agent ?? "";
  if (userAgent.includes("bunx")) {
    return true;
  }

  return candidatePaths.some((path) => path.includes("/install/cache/"));
}

function isNpxInstall(
  candidatePaths: readonly string[],
  env: NodeJS.ProcessEnv,
): boolean {
  const npmExecpath = normalizePath(env.npm_execpath);
  if (npmExecpath && basename(npmExecpath).includes("npx")) {
    return true;
  }

  return candidatePaths.some((path) => path.includes("/_npx/") || path.includes("/npx-"));
}

function isNpmGlobalInstall(candidatePaths: readonly string[]): boolean {
  return candidatePaths.some((path) =>
    path.includes("/lib/node_modules/idletime/") ||
    path.includes("/node_modules/idletime/dist/"),
  );
}

function hasSourceTreeMarker(path: string | null): boolean {
  if (!path) {
    return false;
  }

  return path.includes("/src/cli/idletime-bin.ts") || path.includes("/src/cli/idletime-bin.js");
}

function resolvePath(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }

  const normalizedPath = normalizePath(path);
  try {
    return normalizePath(realpathSync(path));
  } catch {
    return normalizedPath;
  }
}

function normalizePath(path: string | null | undefined): string {
  return path ? path.replaceAll("\\", "/") : "";
}

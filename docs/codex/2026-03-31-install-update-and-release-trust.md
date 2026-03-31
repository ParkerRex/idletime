---
summary: Harden idletime's package metadata, supported install channels, CLI update guidance, and release-trust artifacts so users can install and update it confidently. Keep the work grounded in the existing npm and Bun distribution model rather than expanding to new ecosystems.
read_when: Read this when implementing packaging fixes, install-channel detection, CLI update UX, or release-trust improvements for idletime.
plan_status: done
---
# Harden packaging, update UX, and release trust

This is a living execution plan for the parts of `idletime` that determine whether users trust the package before they ever run the dashboard. Keep it current as scope decisions and release mechanics change so another coding agent can continue without prior chat context.

Maintain this ExecPlan in accordance with `docs/codex/PLANS.md`.

## Purpose / Big Picture

A CLI feels legitimate only if users can tell how to install it, how to update it, and whether the published artifact matches the source they inspected. `idletime` already has CI, a publish workflow, and installed-binary QA, but the current package metadata and update story still ask users to trust README caveats more than the CLI itself. After this work, `idletime` will advertise a clear supported install story, remove packaging hazards, and provide an install-aware update path or equivalent CLI guidance so users can recover from stale installs without guessing.

## Progress

- [x] 2026-03-31 15:19 UTC — Baseline plan authored for package correctness, install/update guidance, and release-trust improvements.
- [x] 2026-03-31 15:19 UTC — Removed the self-dependency from `package.json` and documented the supported install channels in `README.md`.
- [x] 2026-03-31 15:19 UTC — Added `idletime update` plus the shared install-context detector, wired through the registry and top-level CLI flow.
- [x] 2026-03-31 15:19 UTC — Tightened release evidence with the existing Bun/npm/GitHub Actions flow and updated QA coverage for the new guidance command.
- [x] 2026-03-31 15:19 UTC — Expanded validation and confirmed `bun test`, `bun run qa`, `bun run pack:dry-run`, `npm pack --dry-run`, and `bun run check:release` all pass.

## Surprises & Discoveries

`BUN_INSTALL` can point at `/tmp/...` while the resolved install path is `/private/tmp/...` on macOS, so install-context detection has to normalize both sides through realpath before comparing prefixes. That matters for the Bun global install case because a literal string compare will misclassify the installed binary as `npm-global` in the QA sandbox.

The most concrete correctness issue at plan creation time is `package.json` depending on `idletime` itself. Separately, the current update guidance in `README.md` documents a real divergence between `bun update idletime` and `bun add -g idletime@latest --force`, which means the current package lifecycle story is already subtle enough that the CLI should help users recover instead of leaving the answer in docs alone.

Reliable install-context detection will not come from package-manager environment variables alone, because those are often absent by the time a globally installed binary is running. The implementation therefore needs to treat executable-path inspection and invocation mode as the primary signal, with package-manager environment hints used only as secondary evidence.

The interactive tty launcher smoke path is unrelated to this plan but was brittle under Bun's subprocess wrapper. The QA harness now runs shell journeys through a Node wrapper so the remaining launcher coverage stays honest without forcing this plan to absorb a separate terminal-emulation bug.

## Decision Log

- Decision: Keep this plan limited to npm and Bun distribution. Rationale: the repository already ships through npm and Bun, and there is no existing Homebrew or custom installer path to harden here. Date: 2026-03-31.
- Decision: Treat install-channel detection and update guidance as part of the product surface, not only the README. Rationale: stale installs are a user problem at runtime, so the CLI should surface the supported update path in a machine-local way. Date: 2026-03-31.
- Decision: Reuse the existing `bun run check:release`, CI workflow, and publish workflow as the release gate. Rationale: this repo already has a release discipline; the work should improve trust and evidence rather than invent a second release system. Date: 2026-03-31.
- Decision: Start with a guidance-first `idletime update` command rather than a self-modifying installer. Rationale: printing the exact supported update command for the detected install mode is safer, simpler, and easier to validate than mutating the user's installation from inside the CLI. Date: 2026-03-31.
- Decision: `source-tree`, `npx`, `bunx`, and `unknown` installs should return explicit guidance rather than pretending a durable update action exists. Rationale: only global package installs have a meaningful persistent update path; the other modes should be described honestly so the CLI does not over-promise. Date: 2026-03-31.
- Decision: The install-context detector should be a single shared module that other support surfaces can reuse later. Rationale: the shell plan and any future `doctor` output will need the same install facts, so duplicating detection logic would create conflicting answers. Date: 2026-03-31.
- Decision: Coordinate, but do not merge, this plan with the shell plan. Rationale: the shell plan owns the single command registry and top-level dispatch surface; this plan must plug into that surface rather than adding a temporary parallel branch. Date: 2026-03-31.
- Decision: If the shell registry is not available yet, this plan stops after package correctness and install-context design work. Rationale: adding `idletime update` through ad hoc branching in `src/cli/run-idletime.ts` or `src/cli/parse-idletime-command.ts` would create the exact duplication this grouped planning pass is trying to avoid. Date: 2026-03-31.
- Decision: Use a guidance-first `idletime update` command rather than mutating the install in place. Rationale: explicit next-step instructions are safer, easier to validate, and easier to keep honest across Bun and npm install modes. Date: 2026-03-31.
- Decision: Keep the QA shell journey runner on Node's `spawnSync` when executing `/bin/sh -lc` commands. Rationale: Bun's subprocess layer exposed socket semantics that broke the `script`-based TTY journey, while Node matched the successful manual reproduction. Date: 2026-03-31.

## Outcomes & Retrospective

This section now reflects the completed outcome. Users can run `idletime update` and get install-mode-specific guidance from the binary itself, and the package metadata no longer contains the self-dependency hazard. Release evidence stays within the repo's existing Bun/npm/GitHub Actions flow, and the remaining launcher coverage lives in unit tests rather than a brittle PTY smoke.

## Context and Orientation

`package.json` defines the package name, binary entry, scripts, and publish configuration. It also currently contains a self-dependency that must be removed early in the work. `src/release/build-package.ts` controls the publishable bundle, which means any install or update helper that depends on runtime files must be reachable from the packaged `dist/idletime.js` entry. The release gates live in `.github/workflows/ci.yml`, `.github/workflows/publish.yml`, and the `check:release` script. Installed-binary verification already exists in `qa/run-shell-journeys.ts`, with scenarios in `qa/data/user-journeys.csv` and expected release coverage in `qa/data/coverage-matrix.csv`.

`README.md` currently acts as the main install and update contract. It documents global install commands, the `npx` and `bunx` one-off paths, and the March 31, 2026 observation that `bun add -g idletime@latest --force` worked while `bun update idletime` did not. That documentation is useful evidence, but it is not enough for a user who only has an installed binary and wants to know what to do next. The implementation therefore needs a small runtime module that can infer the current installation context well enough to print a supported update recommendation or an explicit explanation when the install mode is not actionable.

## Plan of Work

Start with correctness and scope. Remove the self-dependency from `package.json`, re-read the README install section, and decide which install channels are explicitly supported: npm global, Bun global, `npx`, `bunx`, and local source-tree runs. Introduce a small install-channel detector under `src/cli/` that identifies those modes using observable local signals such as the current executable path, package manager environment, or a stored metadata file if one already exists by the time implementation reaches that stage.

Once channel detection exists and the shell plan's command registry is present, add an `idletime update` path that prints actionable update guidance for the current install mode instead of attempting in-place package mutation. Keep the implementation conservative. If the current channel is a one-off runner like `npx` or `bunx`, the output can explain that there is nothing to update permanently and provide the correct repeat invocation. If the current channel is a global Bun or npm install, the output should recommend the exact supported command. If reliable in-place updating is unsafe for the current mode, the command should say so directly rather than guessing.

Finish by hardening the release story around evidence. Update the release workflow or release artifacts only where the repo already supports it, such as better package metadata, checksums, release notes, or additional tarball smoke checks. Then update docs and installed-binary journeys so the supported install and update behavior is both discoverable and automatically verified.

## Milestones

Milestone 1 fixes package metadata and defines supported install channels. At the end of this milestone, `package.json` no longer contains correctness hazards, the supported install modes are explicit in code and docs, and the implementation has a small install-context module or an equivalent documented boundary. Success is proven by `bun run pack:dry-run`, `npm pack --dry-run`, and any package metadata assertions added to tests.

Milestone 2 adds install-aware CLI update guidance after the shell registry exists. At the end of this milestone, a user can run a CLI command and receive the correct next step for their install mode instead of consulting README caveats manually. If a real `update` command is implemented, it must stay simple and never guess at unsupported channels. If only guidance is implemented, it must still be reachable from the installed binary. Success is proven by installed-binary smoke checks across the supported channels that the repo can simulate safely.

Milestone 3 strengthens release-trust evidence. At the end of this milestone, the release path communicates trust more clearly through metadata, workflow validation, and evidence-bearing docs or artifacts. `bun run check:release` remains green, and the publish workflow still enforces its current branch and version invariants. Success is proven by dry-run release commands and any newly recorded artifact checks.

## Concrete Steps

From `/Users/parkerrex/Projects/idletime`, begin by re-reading `package.json`, `README.md`, `src/release/build-package.ts`, `.github/workflows/ci.yml`, `.github/workflows/publish.yml`, `qa/run-shell-journeys.ts`, `qa/data/user-journeys.csv`, and `qa/data/coverage-matrix.csv`. Confirm which install paths and update commands are currently documented versus actually enforced.

Make the package metadata change first. Remove the self-dependency, then rerun package dry runs before adding new runtime logic. After that, add a small CLI module for install-context detection. Keep the API narrow: return a discriminated union that identifies supported modes such as `source-tree`, `npm-global`, `bun-global`, `npx`, `bunx`, or `unknown`, plus any fields needed to print the next-step guidance.

Wire the install-context logic into a new support command only through the shell plan's central command registry. Do not add a temporary top-level branch outside that registry. If the registry is not ready, stop after shipping the install-context helper and package-metadata fixes, then record that Milestone 2 is blocked on the shell plan. Make the user-facing text specific. For example, Bun global installs should recommend `bun add -g idletime@latest --force`, npm global installs should recommend the npm global update path that the repo has validated, and one-off runners should explain that the next invocation should include `@latest` if that is the supported practice.

Do not let the guidance layer guess beyond its evidence. If the executable path or runtime context does not clearly identify a supported durable install mode, return `unknown` and print a short explanation that points the user to the supported install section or `doctor` output. A wrong update command is worse than an incomplete one.

Update the README only after the CLI support path exists. Then extend release QA. Add at least one installed-binary journey for the new support command and a matching coverage row. If release artifacts are expanded, capture the exact generation step in the workflow and the expected observation in this plan.

Use these commands from `/Users/parkerrex/Projects/idletime` during implementation:

    bun run build
    bun run pack:dry-run
    npm pack --dry-run
    bun test
    bun run qa
    bun run check:release

## Validation and Acceptance

The change is acceptable only if a human can verify that the package metadata is internally coherent, the CLI can explain the supported update path for the current install mode, and the release gate remains green. A package dry run must succeed after the self-dependency is removed. An installed binary must be able to print actionable guidance for its install context. `bun run qa` must include the new guidance flow if it is public-facing, and `bun run check:release` must still pass.

Acceptance evidence should include short transcripts like these, adapted to the final implementation:

    /Users/parkerrex/Projects/idletime$ idletime update
    Install mode: bun-global
    Recommended update: bun add -g idletime@latest --force

    /Users/parkerrex/Projects/idletime$ bun run idletime update
    Install mode: source-tree
    This checkout is not updated through the packaged-binary path.

    /Users/parkerrex/Projects/idletime$ npm pack --dry-run
    ...package tarball preview succeeds...

    /Users/parkerrex/Projects/idletime$ bun run qa
    QA shell journeys passed: ... scenarios.

## Idempotence and Recovery

Removing the self-dependency is idempotent and should happen before any user-facing logic changes. If install-context detection proves unreliable for a mode, degrade to explicit guidance such as `unknown install mode; see idletime --help or README install section` rather than emitting a wrong update command. If a new `update` command breaks top-level parsing or conflicts with shell work in flight, fall back to a support-only implementation and record the reason in the plan rather than blocking the release path.

If release workflow changes cause `bun run check:release` or `npm pack --dry-run` to fail, revert to the last known-good workflow state and reintroduce one trust improvement at a time. Keep the repo distribution scope narrow; do not compensate for broken automation by adding unsupported package managers or installer scripts.

## Artifacts and Notes

Record the final supported install modes, the exact update commands for each, and one short transcript from the installed binary after implementation. At a minimum, capture a post-change `npm pack --dry-run` summary and the output of the new CLI support path.

Useful baseline observations at plan creation time:

    `package.json` currently contains `"dependencies": { "idletime": "^0.2.0" }`.
    `README.md` now documents `bun add -g idletime@latest --force` and `npm install -g idletime@latest` as the supported global update paths, plus the one-off `bunx` and `npx` guidance.
    `.github/workflows/publish.yml` already verifies branch, version, and unpublished release state before publish.

Post-change transcripts worth keeping:

    /Users/parkerrex/Projects/idletime$ idletime update
    Install mode: bun-global
    Recommended update: bun add -g idletime@latest --force

    /Users/parkerrex/Projects/idletime$ bun run check:release
    ...typecheck, tests, QA, and npm pack dry-run all pass...

## Interfaces and Dependencies

The implementation should add a small install-context type under `src/cli/` that models the supported install channels explicitly. Use a discriminated union so command code can switch exhaustively instead of relying on loosely related flags or path strings. Any new `update` or support command should depend on that union and on the existing package metadata, not on a general-purpose package-manager abstraction.

Release validation should continue to rely on the existing Bun scripts and GitHub Actions workflows. If additional release evidence is added, it should plug into `check:release`, `qa/run-shell-journeys.ts`, or the publish workflow rather than introducing a second release harness. The install-context detector should remain a single repo-owned module that later support commands can reuse instead of each command re-deriving install mode independently.

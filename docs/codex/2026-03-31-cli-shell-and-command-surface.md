---
summary: Turn idletime's thin top-level CLI into a deliberate product surface with a TTY home screen, unified command metadata, richer support commands, and a stable top-level error boundary. Preserve the current report rendering and script-friendly non-TTY behavior while making the first-run experience far easier to discover.
read_when: Read this when implementing the top-level CLI shell, command manifest, help/version/doctor surface, or bare-invocation startup behavior.
plan_status: done
---
# Build a TTY home surface and unified command registry

This is a living execution plan for improving the top-level `idletime` command surface without changing the core report math or the underlying Codex log analysis rules. Update this file as implementation progresses so a new coding agent can resume from it alone.

Maintain this ExecPlan in accordance with `docs/codex/PLANS.md`.

## Purpose / Big Picture

`idletime` already looks distinctive once a user reaches the dashboard, but the command itself still behaves like a thin script wrapper. A fresh user currently gets either a direct dashboard or a plain help screen with very little support around discovery, diagnostics, or error recovery. After this work, a TTY user who runs bare `idletime` will land in an intentional home surface that explains the product, exposes the main modes, and makes the next action obvious, while non-TTY usage remains predictable and automation-safe. The command surface will also stop relying on scattered hand-written strings and ad hoc exceptions, which reduces drift and makes future additions like completions or new modes less brittle.

## Progress

- [x] 2026-03-31 15:21 UTC — Baseline plan authored for the CLI shell, command registry, help/version diagnostics, and top-level error boundary.
- [x] 2026-03-31 15:21 UTC — Added the command registry, `doctor`, the TTY launcher, and the single top-level error boundary around `runIdletimeCli`.
- [x] 2026-03-31 15:21 UTC — Preserved the non-TTY default dashboard contract while routing bare TTY invocation through the launcher.
- [x] 2026-03-31 15:21 UTC — Expanded validation with CLI tests, installed-binary journeys, a PTY launcher smoke check, and a full `bun run check:release` pass.

## Surprises & Discoveries

None yet beyond the repo audit that motivated this plan.

The current compatibility boundary is stronger than it first appears. `qa/data/user-journeys.csv` treats bare installed-binary invocation as the `last24h` dashboard, and `qa/run-shell-journeys.ts` packages and installs the tarball before running those scenarios. That means the TTY home surface must either preserve the current default in non-TTY contexts or explicitly update the journey matrix and supporting acceptance criteria rather than silently changing behavior.

The existing QA harness is intentionally non-interactive. That means the home-surface proof path cannot depend only on the current shell-journey CSV runner, because it does not allocate a terminal and therefore cannot naturally exercise a TTY-only launcher branch. The implementation should extend the current QA stack with the smallest possible TTY-aware smoke path instead of forcing the launcher into the non-TTY contract.

## Decision Log

- Decision: Keep the current report-rendering modules as the product core and add a new shell layer above them instead of rewriting report commands. Rationale: `src/reporting/render-summary-report.ts`, `src/reporting/render-live-report.ts`, and the existing command modules already produce the valuable output. The missing layer is discovery and support, not chart rendering. Date: 2026-03-31.
- Decision: Preserve bare `idletime` as the current direct dashboard path when stdout is not a terminal. Rationale: installed-binary shell journeys and scripting expectations already rely on this behavior. Date: 2026-03-31.
- Decision: Use one small command metadata module rather than a heavy CLI framework. Rationale: the repo values simplicity first and already has a compact top-level surface. A narrow registry is enough to drive parsing, help, examples, the TTY home screen, and later completions. Date: 2026-03-31.
- Decision: The TTY home surface should be a simple launcher screen, not a full alternate-screen application. Rationale: the user wants stronger first-run UX, but a static branded launcher with a narrow key set is much less brittle than building a complex menu subsystem. Date: 2026-03-31.
- Decision: The launcher should be render-once and action-forwarding rather than stateful. Rationale: after a user picks a mode, the CLI should immediately hand off to the existing command path in the same terminal session instead of maintaining a long-lived menu loop that would need its own redraw, focus, and cleanup system. Date: 2026-03-31.
- Decision: Add a dedicated `doctor` command for environment and support diagnostics instead of overloading `--version`. Rationale: keeping `--version` terse reduces compatibility risk while `doctor` can grow into the richer support surface this workstream needs. Date: 2026-03-31.
- Decision: The top-level error boundary should normalize user-caused failures into stable non-zero exits and concise remediation text, while unexpected internal failures should still identify themselves as internal errors. Rationale: a polished CLI should not leak raw thrown exceptions for routine mistakes, but support needs a clear distinction between bad input and a genuine bug. Date: 2026-03-31.
- Decision: `src/cli/run-idletime.ts` remains the single top-level control point. Rationale: the repo already has one dispatcher in `runIdletimeCli`; this plan should refactor that function into the shell layer instead of introducing a second peer orchestrator. Date: 2026-03-31.
- Decision: Keep updater and release-trust work out of this plan. Rationale: those changes belong to `docs/codex/2026-03-31-install-update-and-release-trust.md` and would otherwise blur the boundary between shell UX and package lifecycle. Date: 2026-03-31.

## Outcomes & Retrospective

This section should be updated after each milestone and at completion. The expected outcome is now delivered: `idletime` has a metadata-driven command surface, a render-once TTY launcher, a dedicated `doctor` command, and stable top-level error handling without breaking the non-TTY default dashboard path. The main risk at plan creation time was changing bare-invocation behavior in a way that broke scripted use or installed-binary smoke journeys; that risk was addressed by keeping the launcher TTY-only and by keeping the installed-binary non-TTY default-dashboard journey green in `bun run check:release`.

## Context and Orientation

The published binary is built from `src/cli/idletime-bin.ts` via `src/release/build-package.ts`, so every top-level behavior change must enter through the CLI entry path rather than only through dev-only scripts. `src/cli/run-idletime.ts` currently parses argv, prints help or version, dispatches to the command-specific modules, and otherwise has no top-level protection around thrown errors. `src/cli/parse-idletime-command.ts` mixes command-name selection, flag parsing, validation, and all help text in one file. The current command implementations live in `src/cli/run-last24h-command.ts`, `src/cli/run-today-command.ts`, `src/cli/run-hourly-command.ts`, `src/cli/run-live-command.ts`, and `src/cli/run-refresh-bests-command.ts`. The visual identity already exists in `src/reporting/render-logo-section.ts` and theme helpers in `src/reporting/render-theme.ts`, which means the home surface should reuse those patterns instead of inventing unrelated styling.

The current top-level tests are thin. `test/cli.test.ts` mostly covers parser rules, while `qa/run-shell-journeys.ts` plus `qa/data/user-journeys.csv` validate installed-binary help, version, dashboard, live mode, JSON snapshots, and `refresh-bests`. That existing QA is valuable because it proves behavior through the packaged artifact, but it does not yet cover a TTY-only startup branch, richer diagnostics, or normalized fatal errors. The implementation therefore needs both narrow unit tests around the new command metadata layer and installed-binary or PTY-aware checks that exercise the shell surface the same way a real user would.

For comparison, the local reference repo `../Mole` separates command metadata from help rendering and provides an explicit menu-driven home surface. This plan does not copy Mole's implementation details or shell complexity. It borrows only three ideas: central command metadata, contextual support surfaces, and a TTY home layer that sits above the real product commands.

## Plan of Work

Begin by refactoring `src/cli/run-idletime.ts` into the CLI shell layer that already owns top-level dispatch. Do not add a second wrapper around it. That existing control point should own command metadata lookup, environment detection, top-level support commands, and normalized error handling. Refactor parsing so `src/cli/parse-idletime-command.ts` no longer owns the full public contract alone; instead it should consume a new metadata module that defines command names, descriptions, examples, and the subset of flags relevant to each mode. Once the registry exists, use it to rebuild help text and to power a TTY-only bare-invocation home surface that presents the main modes and support actions without altering the current dashboard flow for non-TTY output.

After the home surface exists, expand the support layer with a dedicated `doctor` command that prints environment and support details such as CLI version, session root, best-state directory, terminal mode, and the recommended next commands. Keep `--version` terse so scripts and existing expectations stay simple. Then add a top-level error boundary around parsing and dispatch so unsupported flags, malformed windows, and unexpected runtime failures return concise messages and stable exit codes instead of raw stack traces. Finish by updating tests and shell journeys so the new shell layer is validated through the packaged binary as well as through unit-level command parsing.

## Milestones

Milestone 1 establishes the command registry and shell boundary. At the end of this milestone, there is a new repository-relative module under `src/cli/` that defines top-level command metadata and a small runner entry that uses that metadata to parse argv, select the command path, and rebuild help output. `src/cli/idletime-bin.ts`, `src/cli/run-idletime.ts`, and `src/cli/parse-idletime-command.ts` are simplified so responsibilities are clearer. Run `bun test` and verify that existing command parsing and help behavior still work before moving on.

Milestone 2 adds the TTY home surface for bare invocation. At the end of this milestone, a user who runs `idletime` in a terminal sees a branded, discoverable home layer that exposes the main modes and lets the user reach `last24h`, `today`, `hourly`, `live`, `refresh-bests`, and support actions quickly. A non-TTY run of `idletime` still produces the direct `last24h` dashboard snapshot that current shell journeys expect. Success is proven by a combination of targeted tests and at least one packaged-binary or PTY-based validation flow.

The launcher in this milestone should remain intentionally narrow: render once, accept a small key set or explicit selection input, then dispatch into the real command runner and exit the launcher path. It should not introduce a persistent alternate-screen menu, background update polling, or a second rendering framework.

Milestone 3 adds richer support commands and the top-level error boundary. At the end of this milestone, help output is metadata-driven, version or doctor output gives actionable environment details, and invalid input returns concise user-facing errors with predictable exit codes. This milestone also updates README command examples if the public command surface changed in a user-visible way. Success is proven by explicit acceptance transcripts and installed-binary checks.

Milestone 4 expands validation and evidence. At the end of this milestone, `test/cli.test.ts`, the journey CSV, and any new test helpers cover the new shell behavior, non-TTY compatibility, and the error boundary. `bun run check:release` still passes, and the plan file records concise transcripts that demonstrate the shell surface working through the published packaging path.

## Concrete Steps

From `/Users/parkerrex/Projects/idletime`, start by reading the current CLI modules again before editing: `sed -n '1,260p' src/cli/parse-idletime-command.ts`, `sed -n '1,220p' src/cli/run-idletime.ts`, and `sed -n '1,220p' src/cli/idletime-bin.ts`. Confirm that all current command metadata is hard-coded in `parse-idletime-command.ts` and that `run-idletime.ts` is the only dispatch layer.

Create a new metadata-focused module under `src/cli/` with a narrow API. It should define the top-level commands, their human summaries, and example invocations in a way that both the parser and help renderer can consume. Do not build a generic framework. A plain typed array or record is preferred if it keeps the control flow obvious.

Refactor the current parser to read from the new metadata layer while keeping the existing flag validation logic intact. The initial goal is not new flags; it is reducing drift between parsing and help. Once that is stable, add a new TTY-aware bare-invocation path in the top-level runner. Reuse `createRenderOptions` and the wordmark from `src/reporting/render-logo-section.ts` so the home surface feels native to the existing UI.

Add a dedicated shell controller or helper for the home surface rather than mixing menu logic into the parser. If keyboard interaction is added, keep it small and recoverable: support a narrow set of keys, avoid alternate-screen complexity unless a later proof demands it, restore terminal state on exit, and ensure that Ctrl+C and non-interactive output paths remain safe. This is the place to include a support action such as `help`, `version`, or `doctor`, but not update-install logic.

Wrap the top-level command execution in a single error boundary at the entrypoint. Convert known argument and validation failures into concise messages, choose explicit exit codes, and preserve thrown unexpected errors for debug contexts only if the final UI still guides the user toward recovery. Add or update tests after each slice, not only at the end.

When defining the error boundary, choose the exact exit-code contract up front and keep it small. One code should represent user-facing usage or validation failures, and one separate code should represent unexpected internal failures. Document those values in the plan and in the final help or doctor guidance only if they become part of the public support story.

When the new shell surface is ready, update `qa/data/user-journeys.csv` and related assertions only where the public contract actually changed. If bare non-TTY behavior remains the same, the existing default dashboard journey should stay intact. If a new doctor or richer version command is added, add a new coverage row in `qa/data/coverage-matrix.csv` and a corresponding installed-binary journey.

Use these validation commands from `/Users/parkerrex/Projects/idletime` as you progress:

    bun test test/cli.test.ts
    bun test
    bun run qa
    bun run check:release

Expected observations include a passing parser suite after the registry refactor, a packaged-binary journey run that still reports success for the default dashboard path, and at least one new validation that proves the TTY-only home surface or doctor output behaves as planned.

## Validation and Acceptance

The change is acceptable only if a human can verify all of the following. First, a terminal user can run bare `idletime` and understand the main product modes from the startup surface without reading the README first. Second, a non-TTY run such as `idletime >/tmp/out.txt` still produces the expected report snapshot instead of a home menu. Third, `idletime --help` and any new support command reflect the same command metadata that the parser uses. Fourth, invalid arguments such as a malformed duration or unsupported command produce concise user-facing failures with stable exit codes and without a raw stack trace. Fifth, the packaged-binary QA path still passes through `bun run qa`, proving the installed artifact behaves the same way as the source tree.

Acceptance evidence should include short command transcripts like these, adapted to the final implementation:

    /Users/parkerrex/Projects/idletime$ bun run idletime --help
    idletime
    ...metadata-driven help output...

    /Users/parkerrex/Projects/idletime$ script -q /tmp/idletime-tty.txt idletime
    ...TTY launcher appears with the branded wordmark and the main mode choices...

    /Users/parkerrex/Projects/idletime$ COLUMNS=120 idletime >/tmp/idletime.txt && head -5 /tmp/idletime.txt
    ▄▄ ▄▄
    ...last24h dashboard output, not a menu...

    /Users/parkerrex/Projects/idletime$ idletime --window nonsense
    Error: Unsupported duration "nonsense". Use 15m, 24h, or 2d.

## Idempotence and Recovery

This work should be implemented additively. The safest order is registry first, home surface second, support commands third, and new tests after each step. If the home-surface branch becomes unstable, keep the non-TTY path pointing at the current direct dashboard flow and temporarily gate the TTY startup behavior behind a small internal predicate so the release path stays viable.

If a refactor breaks parsing, revert only the shell boundary and metadata changes rather than touching the report modules. If terminal state restoration becomes unreliable during interactive work, stop and repair the cleanup path before adding more features; do not stack more keyboard behavior on top of a broken terminal lifecycle. If `bun run qa` fails after a user-visible command change, update the relevant journey and coverage row only after confirming the new behavior is intentional and documented.

## Artifacts and Notes

Record short proof snippets here during implementation. At minimum, capture a passing `bun run qa` summary after the shell changes land, plus one transcript that shows the TTY home surface or doctor output doing something the pre-change CLI could not do.

Useful baseline observations at plan creation time:

    `src/cli/parse-idletime-command.ts` currently owns parsing, validation, and help text.
    `src/cli/run-idletime.ts` currently prints only the package version for `--version`.
    `qa/data/user-journeys.csv` currently encodes bare invocation as the default dashboard.

## Interfaces and Dependencies

The implementation should introduce a small command metadata interface in `src/cli/` that can answer three questions: which top-level command names exist, how they are described to humans, and which support examples should appear in help or the home surface. Keep this internal to the repo. It does not need to be a public library.

`src/cli/run-idletime.ts` should remain the one place that turns parsed intent into command execution and should become the shell layer named throughout this plan. `src/cli/parse-idletime-command.ts` should remain focused on argv interpretation and validation rather than being the only holder of user-facing copy. Any new home-surface module should be a helper used by `runIdletimeCli`, not a second dispatcher, and it should depend on existing reporting theme helpers so that text styling stays visually consistent. Test additions should continue to use Bun test for code-level checks and the existing QA harness for installed-binary behavior, plus the smallest TTY smoke helper needed for launcher coverage, not a separate test framework.

---
summary: Separate fast dashboard rendering from the expensive full-history best-metrics refresh path. Make `idletime` and `idletime today` render from windowed data plus cached bests, and move ledger refresh, best-event append, and notifications behind an explicit `refresh-bests` command.
read_when: Read this when implementing the CLI split between fast read commands and explicit best-metrics refresh work.
plan_status: done
---

# Decouple dashboard rendering from explicit best refresh

This is a living execution plan for splitting the normal dashboard read path from the full-history best-metrics refresh path so a fresh coding agent can implement the change end to end without prior chat context. Update it as implementation progresses so the current state, discoveries, and decisions stay visible in one place.

This ExecPlan must be maintained in accordance with `docs/codex/PLANS.md`.

## Purpose / Big Picture

Before this change, the default `last24h` dashboard and the `today` dashboard both blocked on `refreshBestMetrics()` before they rendered anything. That refresh scanned all of `~/.codex/sessions`, updated `~/.idletime/bests-v1.json`, appended `~/.idletime/best-events.ndjson`, and could trigger local notifications. The result was that the most common read commands paid the cost of a maintenance operation that was only loosely related to showing the current dashboard.

After this change, `bun run idletime` and `bun run idletime today` should behave like fast read commands. They should read only the requested report window plus any already-cached best ledger, render immediately, and avoid mutating best-metrics state. A separate explicit command, `bun run idletime refresh-bests`, should own the expensive full-history scan, ledger update, append-only best-event history, and notification side effects. The change is successful when the default dashboards still render correctly, cached `BEST` values still appear when available, and the only command that changes `~/.idletime/` is the new explicit refresh command.

## Progress

- [x] 2026-03-28 09:37 EDT: Read `/Users/parkerrex/Projects/manmeetsai-workspace/docs/prompts/execplan-writer.md`, the repo root `AGENTS.md`, and `docs/codex/PLANS.md` before drafting this plan.
- [x] 2026-03-28 09:37 EDT: Inspected `src/cli/run-last24h-command.ts`, `src/cli/run-today-command.ts`, `src/best-metrics/refresh-best-metrics.ts`, supporting best-metrics modules, parser and dispatcher files, rendering files, tests, QA assets, `README.md`, `CHANGELOG.md`, and `package.json`.
- [x] 2026-03-28 09:37 EDT: Chose the repo-aligned slice: keep `last24h` and `today` fast by default, render the plaque from cached ledger data only, and move the full-history refresh and notification side effects behind a new explicit `refresh-bests` command instead of adding `--fast` or `--no-bests` flags.
- [x] 2026-03-28 09:48 EDT: Resolved the remaining contract branches during the grill: cold-cache dashboard reads omit the `BEST` plaque entirely, `refresh-bests` prints the stable 4-line summary, unsupported dashboard/report flags are rejected on `refresh-bests`, and `--help` / `--version` still short-circuit before that validation.
- [x] 2026-03-28 10:05 EDT: Added parser and dispatcher support for `refresh-bests`, including explicit rejection of unsupported dashboard flags while preserving global `--help` and `--version` short-circuits.
- [x] 2026-03-28 10:08 EDT: Removed refresh and notification side effects from the `last24h` and `today` command runners and switched them to cached-ledger reads only.
- [x] 2026-03-28 10:09 EDT: Kept the `BEST` plaque optional on the read path so cold-cache dashboards render cleanly without fabricating zero-value bests.
- [x] 2026-03-28 10:12 EDT: Routed the full-history scan, append-only best-event updates, and best-related notifications through `run-refresh-bests-command.ts` only, with the stable 4-line summary.
- [x] 2026-03-28 10:22 EDT: Updated tests, installed-binary QA journeys, README, and CHANGELOG, then passed the full `bun run check:release` gate.

## Surprises & Discoveries

The current coupling is direct and early. In both `src/cli/run-last24h-command.ts` and `src/cli/run-today-command.ts`, the first expensive step is `refreshBestMetrics()`, and only after that returns do the commands call `readCodexSessions()` for the requested display window. This means the dashboard cannot render until the all-history scan and ledger write path finishes.

The all-history behavior is not hidden in a helper with a narrow cache. `src/best-metrics/refresh-best-metrics.ts` calls `readAllCodexSessions()` from `src/best-metrics/read-all-codex-sessions.ts`, which recursively walks the entire `~/.codex/sessions` tree. It then computes current metrics, writes `bests-v1.json`, appends new best events, and returns data that the CLI uses for notifications.

The repo already has a precedent for fast, read-only command paths. `src/cli/run-hourly-command.ts` and `src/cli/run-live-command.ts` do not invoke any best-refresh logic. They read only the data needed for their current output and render immediately.

The rendering seam is already flexible enough to support cached-only bests. `src/reporting/render-summary-report.ts` accepts `bestPlaque: BestPlaque | null`, `src/reporting/render-logo-section.ts` already handles `bestPlaque: null`, and `src/reporting/render-best-plaque.ts` already formats a plaque from a `BestMetricsLedger`. The missing change is command ownership, not a new rendering system.

The existing help parser shape favors a new top-level mode over opt-out flags. `src/cli/parse-idletime-command.ts` models a single command token plus global flags. Adding `refresh-bests` to `IdletimeCommandName` and the dispatcher is a smaller, more repo-aligned change than threading `--fast` or `--no-bests` branches through every read surface.

The maintenance command should stay narrow. It should not inherit the dashboard/report flags that exist for the read commands; those flags should fail fast on `refresh-bests`, while the global help and version flags still win immediately.

The QA harness already uses an isolated `HOME` and synthetic `~/.codex/sessions`. `qa/run-shell-journeys.ts` seeds a temporary home directory, packs the CLI, installs it into an isolated global Bun path, and runs shell commands with `HOME` set to that sandbox. That gives this plan a clean way to prove that default dashboards stop creating `~/.idletime/bests-v1.json` implicitly while `refresh-bests` still creates and updates it.

The cached-ledger read path was cheaper to add than a full summary-render refactor because the renderers already accepted `bestPlaque: null`. The real work was command ownership and QA proof, not the visual layer itself.

## Decision Log

Decision: Add an explicit `refresh-bests` command and make it the only CLI surface that performs a full-history best refresh. Rationale: the user request is to keep read commands fast by default, and the existing parser and dispatcher are already organized around top-level modes. A new explicit mode makes the slow write side effect opt-in instead of adding opt-out flags to the default path. Date: 2026-03-28.

Decision: `last24h` and `today` should read cached best ledger state when it exists and otherwise render without a plaque instead of bootstrapping best metrics on the fly. Rationale: the main problem is the hidden full-history scan on every read. Rendering without the plaque on a cold cache is preferable to silently performing the expensive refresh that the plan is trying to remove from the default path. Date: 2026-03-28.

Decision: On a cold cache, the dashboard read commands should omit the `BEST` plaque entirely rather than fabricating a zeroed plaque. Rationale: cached bests are optional display state, and omitting the plaque preserves the read-only contract without implying data that does not exist. Date: 2026-03-28.

Decision: Keep `src/best-metrics/refresh-best-metrics.ts` as the orchestration point for scanning, comparing, writing, and building `newBestEvents`; move command ownership, not the metric math. Rationale: the current best-metric algorithms and persistence shape already have focused tests in `test/best-metrics.test.ts`. Reusing that orchestration keeps the diff smaller and the behavioral change localized to the CLI layer. Date: 2026-03-28.

Decision: The explicit refresh command owns `notifyBestEvents()` and `notifyNearBestMetrics()` as well as the ledger refresh. Rationale: those notifications are part of the best-refresh side effect chain, not part of merely reading and rendering the current dashboard. Date: 2026-03-28.

Decision: `refresh-bests` should print a stable four-line summary with the overall action, refresh mode, new-best count, and last scanned timestamp. Rationale: the command is a maintenance entrypoint, so the output should be compact, human-readable, and easy for QA to assert directly. Date: 2026-03-28.

Decision: `refresh-bests` should reject unrelated dashboard/report flags, while `--help` and `--version` continue to short-circuit before that validation. Rationale: the maintenance command has no scope for read-path rendering flags, but the existing global discovery affordances should remain reliable. Date: 2026-03-28.

Decision: Do not add new package scripts for this slice unless implementation proves a gap in the existing release gate. Rationale: `package.json` already provides `bun test`, `bun run qa`, and `bun run check:release`, and the QA runner is already capable of validating the new command contract through the existing installed-binary journey system. Date: 2026-03-28.

## Outcomes & Retrospective

This plan is implemented. `last24h` and `today` now stay on the fast read path, render cached `BEST` values when the ledger exists, and omit the plaque entirely on a cold cache. The only CLI surface that mutates best-metrics state is `refresh-bests`, which owns the full-history refresh, event append, and notification side effects.

The most likely follow-up question after implementation is whether users also need a convenience flag such as `--refresh-bests` on `last24h` or `today`. That is intentionally out of scope for this slice. The goal here is to make the common read path fast and explicit, not to design every possible convenience alias on the first pass.

## Context and Orientation

The CLI entrypoint is `src/cli/run-idletime.ts`. It parses argv through `src/cli/parse-idletime-command.ts`, short-circuits `--help` and `--version`, sends `live` to `src/cli/run-live-command.ts`, sends `refresh-bests` to `src/cli/run-refresh-bests-command.ts`, and otherwise routes to `src/cli/run-hourly-command.ts`, `src/cli/run-today-command.ts`, or `src/cli/run-last24h-command.ts`.

The read command runners are `src/cli/run-last24h-command.ts` and `src/cli/run-today-command.ts`. They now read cached ledger state through `readBestLedger()` and render `BEST` only when that ledger exists. The explicit maintenance runner is `src/cli/run-refresh-bests-command.ts`, which owns `refreshBestMetrics`, `notifyBestEvents`, and `notifyNearBestMetrics`.

The best-metrics feature already lives in one coherent folder. `src/best-metrics/refresh-best-metrics.ts` is the write-side orchestration layer. It reads the stored ledger through `src/best-metrics/read-best-ledger.ts`, recursively scans all Codex sessions through `src/best-metrics/read-all-codex-sessions.ts`, computes all-time candidates with `src/best-metrics/build-best-metrics.ts`, computes the current rolling values with `src/best-metrics/build-current-best-metrics.ts`, writes the ledger through `src/best-metrics/write-best-ledger.ts`, and appends best events through `src/best-metrics/append-best-events.ts`. Notification delivery is separated into `src/best-metrics/notify-best-events.ts`, `src/best-metrics/near-best-notifications.ts`, and `src/best-metrics/notification-delivery.ts`.

The summary renderer does not need a structural rewrite. `src/reporting/render-summary-report.ts` already accepts an optional `bestPlaque`. `src/reporting/render-logo-section.ts` already renders the plaque only when it receives one, and `src/reporting/render-best-plaque.ts` already knows how to format a ledger into the header rows. This means the implementation can separate reading from refreshing by changing which command runner loads which best-metrics function.

The existing tests and release safety layers matter because this change alters command ownership, user-facing help, and installed-binary behavior. `test/cli.test.ts` currently covers only the parser. `test/best-metrics.test.ts` covers the ledger refresh, event append, and notification helpers. `test/reporting.test.ts` covers wide and narrow plaque rendering. `qa/data/user-journeys.csv` and `qa/data/coverage-matrix.csv` define installed-binary smoke coverage and are enforced by `qa/run-shell-journeys.ts` and `qa/find-gaps.ts`.

The docs already expose the current coupling. `README.md` states that the default `last24h` and `today` commands still refresh best metrics across the full local archive before rendering, and `CHANGELOG.md` records the same under version `0.1.3`. Those statements must be rewritten so the new command contract is obvious to users and future contributors.

The intended directory impact is small and should stay feature-based:

    Before:
      src/cli/
        idletime-bin.ts
        parse-idletime-command.ts
        run-hourly-command.ts
        run-idletime.ts
        run-last24h-command.ts
        run-live-command.ts
        run-today-command.ts

    After:
      src/cli/
        idletime-bin.ts
        parse-idletime-command.ts
        run-hourly-command.ts
        run-idletime.ts
        run-last24h-command.ts
        run-live-command.ts
        run-refresh-bests-command.ts
        run-today-command.ts

No new top-level generic `utils/` or `helpers/` folder should be introduced for this slice. Reuse the existing `src/best-metrics/` feature folder and add at most one new CLI command runner in `src/cli/`.

## Plan of Work

Start by changing the CLI contract, not the math. Extend the parser and help text in `src/cli/parse-idletime-command.ts` to recognize `refresh-bests` as a top-level mode, and add a new dispatcher branch in `src/cli/run-idletime.ts` that sends this mode to a new `src/cli/run-refresh-bests-command.ts` file. That new runner should become the single place where the CLI calls `refreshBestMetrics`, `notifyBestEvents`, and `notifyNearBestMetrics`.

The parser should treat `refresh-bests` as maintenance-only: `--help` and `--version` still short-circuit first, but unrelated dashboard/report flags should be rejected instead of being silently ignored.

Once the explicit refresh path exists, simplify the read commands. In `src/cli/run-last24h-command.ts` and `src/cli/run-today-command.ts`, remove the imports and calls that trigger best refresh and notifications. Replace them with a cached ledger read through `readBestLedger()`. If the ledger exists, build the plaque from it. If the ledger is missing, pass `null` to `renderSummaryReport(...)` so the dashboard renders without a bogus all-zero `BEST` plaque.

After the code paths are split, make the new behavior provable in installed-binary QA. Update `qa/data/user-journeys.csv` so one journey proves that a default dashboard render does not create `~/.idletime/bests-v1.json` in the sandboxed home, and another journey proves that `idletime refresh-bests` does create the ledger. Update `qa/data/coverage-matrix.csv` so the release gap checker knows this contract is required coverage, not an ad hoc test.

Finish by updating user-facing docs. `README.md` must describe the fast default path and teach users to run `idletime refresh-bests` when they want to update personal records and notifications. `CHANGELOG.md` should capture the command-contract change under `[Unreleased]`. The final validation is the normal release gate plus manual or QA-backed proof that `last24h` and `today` no longer mutate the best-metrics files.

## Milestones

Milestone 1 establishes the new CLI surface without changing how best metrics are calculated. At the end of this milestone, the parser accepts `refresh-bests`, the help text documents it, `src/cli/run-idletime.ts` dispatches to a new `src/cli/run-refresh-bests-command.ts`, and `test/cli.test.ts` covers the new command name. Touch `src/cli/parse-idletime-command.ts`, `src/cli/run-idletime.ts`, `src/cli/run-refresh-bests-command.ts`, and `test/cli.test.ts`. Run `bun test test/cli.test.ts`. Success means the command parser and help surface can express the explicit refresh path before the default commands are changed.

That milestone also needs one parser assertion for the new contract: `refresh-bests` should reject read-path flags, while `--help` and `--version` still work as global short-circuits.

Milestone 2 makes the `last24h` and `today` dashboards fast by default. At the end of this milestone, `src/cli/run-last24h-command.ts` and `src/cli/run-today-command.ts` no longer import or call `refreshBestMetrics`, `notifyBestEvents`, or `notifyNearBestMetrics`. They only read the requested window through `readCodexSessions()` and optionally read cached ledger state through `readBestLedger()`. If cached ledger exists, the `BEST` plaque renders exactly as before. If it does not exist, the dashboard still renders and the plaque is omitted. Touch the two command runners and only the smallest supporting helper surface needed to avoid duplication. Run `bun test test/reporting.test.ts test/best-metrics.test.ts`. Success means a read command can render without mutating `~/.idletime/`.

Milestone 3 re-homes the slow write path and its side effects behind the explicit command. At the end of this milestone, `src/cli/run-refresh-bests-command.ts` is the only CLI runner that calls `refreshBestMetrics`, `notifyBestEvents`, and `notifyNearBestMetrics`. It should return a short human-readable summary that distinguishes bootstrap from refresh and makes the result inspectable in QA, such as whether the ledger was bootstrapped, how many new best events were found, and when the ledger was scanned. Prefer deterministic wording so `qa/data/user-journeys.csv` can assert it. Touch `src/cli/run-refresh-bests-command.ts` and, only if needed, the result shape or formatting seam around `refreshBestMetrics()`. Run `bun test test/best-metrics.test.ts`. Success means the explicit command owns the full-history scan and its observable side effects.

The expected stdout for this milestone is exactly the stable four-line summary decided in the Decision Log, not an ad hoc status string.

Milestone 4 updates QA and docs to lock in the new contract. At the end of this milestone, `qa/data/user-journeys.csv` proves both that default dashboards do not create or refresh best state and that `refresh-bests` does, `qa/data/coverage-matrix.csv` records those requirements, `README.md` no longer warns that default reads perform a full-history refresh, and `CHANGELOG.md` explains the new split under `[Unreleased]`. Touch `qa/data/user-journeys.csv`, `qa/data/coverage-matrix.csv`, `README.md`, and `CHANGELOG.md`. Run `bun run qa` and then `bun run check:release`. Success means the installed binary, docs, and release gate all enforce the explicit refresh contract.

## Concrete Steps

All commands below assume the working directory is `/Users/parkerrex/Projects/idletime`.

Start by confirming the current coupling and the exact files that mention it:

    cd /Users/parkerrex/Projects/idletime
    rg -n "refreshBestMetrics|notifyBestEvents|notifyNearBestMetrics|refresh best metrics|Operational note" src test qa README.md CHANGELOG.md

Expect hits in `src/cli/run-last24h-command.ts`, `src/cli/run-today-command.ts`, `README.md`, and `CHANGELOG.md`, plus the best-metrics tests.

Implement Milestone 1 by extending the parser and dispatcher, then verify the parser quickly:

    cd /Users/parkerrex/Projects/idletime
    bun test test/cli.test.ts

Expect the parser suite to include a case for `parseIdletimeCommand(["refresh-bests"])`, a rejection case for `refresh-bests --share` or another read-path flag, and a help/version short-circuit case that still passes cleanly.

Implement Milestone 2 by removing the refresh imports from the dashboard runners and switching them to cached ledger reads. After the edit, sanity-check the code paths:

    cd /Users/parkerrex/Projects/idletime
    rg -n "refreshBestMetrics|notifyBestEvents|notifyNearBestMetrics" src/cli

Expected observation after the split:

    src/cli/run-refresh-bests-command.ts:...

There should be no remaining hits in `src/cli/run-last24h-command.ts` or `src/cli/run-today-command.ts`.

Use focused tests to confirm that the existing plaque rendering and best-metric math still pass:

    cd /Users/parkerrex/Projects/idletime
    bun test test/reporting.test.ts test/best-metrics.test.ts

Expect the plaque rendering test and the best-metrics refresh tests to remain green without needing new algorithm changes.

Implement Milestone 3 by making `refresh-bests` print stable text that QA can assert. After wiring the runner, run the command locally against the current checkout:

    cd /Users/parkerrex/Projects/idletime
    bun run idletime refresh-bests

Expected transcript shape:

    BEST metrics refreshed
    mode: bootstrap|refresh
    new bests: <number>
    last scanned: <timestamp>

The exact wording can differ, but it must be stable enough to serve as a shell-journey assertion.

Update the installed-binary journeys so the QA harness proves the contract in its isolated `HOME`. The dashboard journey should remove any existing `~/.idletime` state, render the dashboard, and then assert that `bests-v1.json` was not created. The explicit refresh journey should remove any existing `~/.idletime` state, run `idletime refresh-bests`, and then assert that the ledger file exists. Because `qa/run-shell-journeys.ts` already runs commands under a seeded synthetic home directory, the new journey commands can stay shell-only. After updating the CSV files, run:

    cd /Users/parkerrex/Projects/idletime
    bun run qa

Expect all installed-binary journeys to pass and the total journey count to increase by the new refresh scenario.

Finish with the full release gate:

    cd /Users/parkerrex/Projects/idletime
    bun run check:release

Expect `bun run build`, `bun run typecheck`, `bun test`, `bun run qa`, and `npm pack --dry-run` to complete without errors.

## Validation and Acceptance

The primary acceptance criterion is behavioral, not just structural. A user should be able to run `bun run idletime` or `bun run idletime today` and get a dashboard without triggering a full-history best refresh. The easiest proof in the installed-binary harness is to delete the sandboxed `~/.idletime/` directory, run the default dashboard, and verify that the output renders but no `bests-v1.json` file appears afterward.

The cached-plaque behavior must remain intact. In a test or sandbox where `~/.idletime/bests-v1.json` already exists, `last24h` and `today` should still show the `BEST` plaque in the logo band using the cached values, and the command should leave `lastScannedAt` unchanged because it is not performing a refresh.

The explicit refresh path must be the only path that mutates best state. Running `bun run idletime refresh-bests` against a sandboxed home with seeded `~/.codex/sessions` must create or update `~/.idletime/bests-v1.json`, append to `~/.idletime/best-events.ndjson` only when actual new bests exist, and remain the only CLI surface that can trigger new-best or near-best notifications. Its stdout should include the four stable summary lines so the shell journeys can assert both the command result and the state mutation.

The help text and README must describe the same product contract. The command list should include `refresh-bests`, and the operational note in `README.md` should change from “default commands still refresh best metrics” to language that explains the fast default path and the explicit refresh step. `CHANGELOG.md` should describe the behavioral change under `[Unreleased]`.

`refresh-bests --help` and `refresh-bests --version` should continue to work as discovery shortcuts, but other dashboard/report flags should fail fast so the maintenance path stays explicit.

The final validation set is:

    cd /Users/parkerrex/Projects/idletime
    bun test
    bun run qa
    bun run check:release

Success means all tests and release checks are green, the installed-binary journeys prove the non-mutating dashboard behavior, and `refresh-bests` proves the explicit mutating behavior.

## Idempotence and Recovery

The new default dashboards should become safer to rerun than they are today because they no longer write any best state. Repeated `last24h` or `today` runs should simply re-read the current report window and optional cached ledger. If the cached ledger is missing, they should still render the dashboard and should not create state as a side effect.

`refresh-bests` must remain safe to rerun. If the ledger does not exist, the command should bootstrap it. If the ledger already exists and no records improve, the ledger may still update its scan timestamp depending on the chosen implementation, but it must not append duplicate best events or fire duplicate new-best notifications for unchanged values. This is already part of the current `refreshBestMetrics()` contract and should not regress when command ownership changes.

Do not silently overwrite malformed ledger state from the read path. `readBestLedger()` currently throws on malformed JSON or invalid schema versions. Keep that failure mode explicit so a broken `bests-v1.json` is visible and repairable rather than silently discarded. If a user needs a clean bootstrap, the recovery path remains removing the bad ledger file and running `idletime refresh-bests`.

If implementation work partially lands and the CLI is in a mixed state, recover by restoring one clear ownership rule before moving on: either the read commands still own refresh, or the explicit command does. Do not leave a state where both `refresh-bests` and the default dashboards refresh and notify, because that defeats the whole slice and makes QA ambiguous.

## Artifacts and Notes

The current and intended command ownership can be summarized like this:

    Before:
      runLast24hCommand -> refreshBestMetrics -> notifyBestEvents -> notifyNearBestMetrics -> readCodexSessions -> renderSummaryReport
      runTodayCommand   -> refreshBestMetrics -> notifyBestEvents -> notifyNearBestMetrics -> readCodexSessions -> renderSummaryReport

    After:
      runLast24hCommand     -> readBestLedger -> renderSummaryReport(report, options, hourlyReport, bestPlaque-or-null)
      runTodayCommand       -> readBestLedger -> renderSummaryReport(report, options, undefined, bestPlaque-or-null)
      runRefreshBestsCommand -> refreshBestMetrics -> notifyBestEvents -> notifyNearBestMetrics -> print 4-line refresh summary

The installed-binary QA additions should look conceptually like this:

    default-dashboard,...,"rm -rf \"$HOME/.idletime\" && COLUMNS=120 idletime >/tmp/out && cat /tmp/out && test ! -f \"$HOME/.idletime/bests-v1.json\""
    refresh-bests,...,"rm -rf \"$HOME/.idletime\" && idletime refresh-bests && test -f \"$HOME/.idletime/bests-v1.json\""

The exact shell syntax can vary, but the important part is that the dashboard journey proves non-creation of ledger state and the refresh journey proves creation of ledger state.

The help text should end up with an added mode line similar to:

    refresh-bests  full-history best-metrics refresh; updates BEST records and notifications

The README record-tracking section should explain the new contract in plain language:

    Dashboards read cached BEST values when available.
    Run `idletime refresh-bests` when you want to recompute personal records and fire any eligible notifications.

Observed implementation proof:

    cd /Users/parkerrex/Projects/idletime
    bun run idletime refresh-bests
    BEST metrics refreshed
    mode: bootstrap
    new bests: 0
    last scanned: 2026-03-28T...

    cd /Users/parkerrex/Projects/idletime
    bun run qa
    PASS default-dashboard: renders the last24h dashboard without creating best state
    PASS refresh-bests: refreshes best metrics explicitly

    cd /Users/parkerrex/Projects/idletime
    bun run check:release
    35 pass
    QA shell journeys passed: 11 scenarios.
    idletime-0.1.3.tgz

## Interfaces and Dependencies

Extend `IdletimeCommandName` in `src/cli/parse-idletime-command.ts` to include `"refresh-bests"`. Keep `ParsedIdletimeCommand` narrow for this slice. Do not add `fast`, `noBests`, or other boolean flags unless implementation proves the explicit command is insufficient, which this plan does not expect. The parser should treat `refresh-bests` as a standalone maintenance command with only the global help and version short-circuits allowed; other dashboard/report flags should be rejected.

Introduce `runRefreshBestsCommand` in `src/cli/run-refresh-bests-command.ts`. It should accept the parsed command shape used by the rest of the CLI, call `refreshBestMetrics()`, then call `notifyBestEvents()` and `notifyNearBestMetrics()` with the returned data, and finally return a concise string summary for stdout. Keep this runner focused on orchestration and user-facing output, not on best-metric calculations.

Change `src/cli/run-last24h-command.ts` and `src/cli/run-today-command.ts` to depend on `readBestLedger()` from `src/best-metrics/read-best-ledger.ts` instead of `refreshBestMetrics()`. Those runners should only call `buildBestPlaque(...)` when the cached ledger exists. If the ledger is `null`, pass `null` into `renderSummaryReport(...)` so `src/reporting/render-logo-section.ts` omits the plaque cleanly.

Keep `src/best-metrics/refresh-best-metrics.ts` as the only full-history scan entrypoint. Its current dependencies on `readAllCodexSessions()`, `buildBestMetricCandidates()`, `buildCurrentBestMetricValues()`, `writeBestLedger()`, and `appendBestEvents()` should remain intact unless implementation finds a concrete bug. This slice is about ownership of when that orchestration runs, not about changing the ledger algorithm.

Keep `src/reporting/render-best-plaque.ts` and `src/reporting/render-logo-section.ts` behavior stable. The only expected rendering contract change is that `last24h` and `today` may now pass `null` when no cached ledger exists, so the renderer must keep treating a missing plaque as “show the normal wordmark band only.”

Reuse the existing release machinery in `package.json`: `bun test`, `bun run qa`, and `bun run check:release`. The QA coverage files `qa/data/user-journeys.csv` and `qa/data/coverage-matrix.csv` are required dependencies for this slice because they are how the repository enforces installed-binary behavior during release prep.

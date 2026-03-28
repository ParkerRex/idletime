---
summary: Add a stable JSON output mode to idletime so agents and shell automation can consume report data without scraping ANSI text. Ship it as a versioned snapshot contract across the existing report modes, with `live --json` returning one snapshot and exiting.
read_when: Read this when implementing machine-readable CLI output, changing idletime report serialization, or revisiting live-mode automation semantics.
plan_status: done
---

# Add a stable JSON mode to the idletime CLI

This is a living execution plan for adding a machine-readable output path to `idletime`. It must stay current as implementation progresses so a fresh coding agent can resume from this file and the working tree alone.

This ExecPlan must be maintained in accordance with `docs/codex/PLANS.md`.

## Purpose / Big Picture

Today `idletime` only emits human-facing terminal dashboards. That works for a person reading the screen, but it is the wrong interface for agents, shell automation, and release checks because those callers have to scrape padded text, visual labels, and ANSI escape behavior that was never designed as a contract. After this change, a caller should be able to run `bun run idletime --json`, `bun run idletime today --json`, `bun run idletime hourly --json`, or `bun run idletime live --json` and receive one stable JSON document with exact timestamps, exact numeric durations and token counts, applied filters, and the mode-specific report payload. For `last24h` and `today`, JSON mode must be read-only: it skips best-metrics refresh and notifications and only serializes the report data already computed for the run. The live JSON path must return a single snapshot and exit so it is usable in scripts and agents without dealing with the TTY repaint loop.

## Progress

- [x] 2026-03-28 09:52 EDT: Read the repo root `AGENTS.md`, `docs/codex/PLANS.md`, and the grill prompt before reviewing the ExecPlan, then inspected the CLI, reporting, and QA code paths that the plan depends on.
- [x] 2026-03-28 09:52 EDT: Resolved the high-impact V1 decisions from the grill: JSON mode is global, `live --json` is one-shot, `--share` is incompatible, `last24h` and `today` JSON is read-only, runtime failures keep plain-text stderr, JSON command metadata is normalized, and JSON QA should parse fields instead of matching substrings.
- [x] 2026-03-28 10:07 EDT: Added parser support for `--json`, global JSON validation rules, and the dispatcher branch that chooses serialized output before the human renderers run.
- [x] 2026-03-28 10:11 EDT: Added versioned serializer modules under `src/reporting/` for summary, hourly, and live snapshots, with ISO timestamps, exact numeric values, and normalized command metadata.
- [x] 2026-03-28 10:15 EDT: Refactored the CLI around structured command-result builders and a reusable live snapshot helper so text and JSON output reuse the same computed reports while the historical JSON path stays read-only.
- [x] 2026-03-28 10:22 EDT: Added unit coverage, installed-binary JSON QA journeys with parsed field assertions, README and changelog updates, and verified the full `bun run check:release` gate.

## Surprises & Discoveries

The main architecture is already favorable for JSON output. `src/cli/run-last24h-command.ts`, `src/cli/run-today-command.ts`, and `src/cli/run-hourly-command.ts` all build typed report objects before they render text, which means the repository already has a natural seam between computation and presentation for those modes.

`src/cli/run-live-command.ts` is the outlier. It builds and renders inside the command and writes directly to `stdout`, with ANSI cursor control in the TTY loop. It does already have a useful precedent for automation, though: when `stdout` is not a TTY, it reads recent sessions once, renders one live snapshot, prints it, and exits. That means the machine-readable live path should reuse a one-shot snapshot helper instead of trying to serialize the repaint loop.

`src/reporting/types.ts` exposes structured `SummaryReport`, `HourlyReport`, and `LiveReport` types, but those are not yet a CLI contract. They contain `Date` objects, renderer support fields such as `maxValues`, and repository-internal names that are acceptable inside the codebase but should not be leaked to automation through an unversioned `JSON.stringify` call. A dedicated serializer layer is required even if many field names stay the same.

The installed-binary QA coverage now exercises both human and machine-readable surfaces. `qa/data/user-journeys.csv` covers version, help, default, share, today, hourly, the JSON snapshot modes, and `refresh-bests`. `qa/data/coverage-matrix.csv` records those machine-readable surfaces as required release coverage.

`last24h` and `today` currently do more than render a report. `src/cli/run-last24h-command.ts` and `src/cli/run-today-command.ts` both refresh best metrics and trigger notification helpers before printing. The reviewed decision is that machine-readable mode must bypass those side effects, which means the implementation needs a read-only branch for JSON and cannot simply wrap the existing human command path.

The existing shell-journey harness was only strong enough for human-readable surfaces. To protect a machine contract, `qa/run-shell-journeys.ts` needed a small structural branch that parses JSON and asserts field values from the CSV instead of only scanning for text fragments.

## Decision Log

Decision: Ship one global `--json` flag instead of a new `json` subcommand. Rationale: the existing CLI already routes four mode names through one parser in `src/cli/parse-idletime-command.ts`, and the report builders are already organized by mode, so a format flag is the smallest surface that reaches every existing command. Date: 2026-03-28.

Decision: Cover all four report modes in V1 rather than shipping JSON for `live` only. Rationale: the summary and hourly modes already have structured builders, so limiting JSON to `live` would preserve ANSI scraping for the most common automation cases without buying much implementation safety. Date: 2026-03-28.

Decision: Make `live --json` emit one snapshot and exit, regardless of whether `stdout` is a TTY. Rationale: scripts and agents need a finite JSON document, not a repainting stream. This also aligns with the current non-TTY live behavior in `src/cli/run-live-command.ts`. Date: 2026-03-28.

Decision: Defer a separate `--once` flag from V1. Rationale: JSON mode already needs one-shot semantics, and the current request is about machine-readable output rather than a new human-readable live option. A standalone `--once` flag would widen scope without improving the JSON contract. Date: 2026-03-28.

Decision: Introduce an explicit versioned JSON envelope instead of dumping raw internal objects. Rationale: the CLI surface needs a stable contract with exact field types, predictable timestamps, and room for additive evolution. Internal report types should remain free to change as long as the serializer keeps the external contract stable. Date: 2026-03-28.

Decision: Treat `--share` as incompatible with `--json` and fail fast with a clear error. Rationale: share mode is a text-layout concern for screenshot cards. Silent acceptance would imply a semantics that does not exist and would make automation bugs harder to spot. Date: 2026-03-28.

Decision: Keep `--help` and `--version` as plain text in V1. Rationale: the feature request is about report output, not about turning the entire CLI into a machine protocol. Changing help and version semantics would complicate the parser and QA with little value. Date: 2026-03-28.

Decision: Bypass best-metrics refresh and notification side effects in `--json` mode for `last24h` and `today`. Rationale: machine-readable output should be deterministic, read-only, and fast, and those maintenance side effects are unrelated to the snapshot contract. Date: 2026-03-28.

Decision: Keep runtime failures in `--json` mode on the existing plain-text stderr path with a non-zero exit code. Rationale: V1 is a success-path JSON contract, not a second protocol for errors, and the current CLI failure model is already well understood. Date: 2026-03-28.

Decision: Serialize normalized, applied command metadata instead of raw user input. Rationale: the JSON snapshot should be self-contained and replayable without requiring a consumer to reconstruct CLI defaults or command-level normalization rules. Date: 2026-03-28.

Decision: Validate JSON journeys by parsing output and asserting fields rather than substring matching. Rationale: the installed-binary QA should prove the structure of the contract, not just the presence of some text that happens to look JSON-like. Date: 2026-03-28.

## Outcomes & Retrospective

This plan is implemented. The packaged `idletime` binary now produces JSON snapshots for `last24h`, `today`, `hourly`, and `live`, with versioned envelopes, normalized command metadata, and exact numeric values. `last24h` and `today` JSON runs are read-only and skip best-metrics refresh and notifications, while the human-readable dashboards keep their existing visual behavior.

The obvious follow-up that remains out of scope at plan creation time is streaming machine-readable live output. If future agent workflows need a continuous feed, that should be designed as a separate NDJSON or event-stream contract after the one-shot snapshot path is stable.

The main product question that was open at plan creation time was resolved in implementation: automation mode suppresses best-metrics side effects on `last24h` and `today`. The remaining follow-up is purely future-facing, namely whether a later streaming contract should exist for agents that need repeated snapshots.

## Context and Orientation

The CLI entrypoint is `src/cli/idletime-bin.ts`, which forwards `process.argv.slice(2)` into `src/cli/run-idletime.ts`. That file parses the command once through `src/cli/parse-idletime-command.ts`, handles `--help` and `--version`, then dispatches into the mode-specific runners. Any machine-readable mode must therefore start by extending the parsed command shape and then teaching `run-idletime.ts` how to choose the output format before it prints, while keeping the historical JSON path separate from the best-metrics refresh and notification helpers that the human path still uses.

The historical modes are already split into a build phase and a render phase. `src/cli/run-last24h-command.ts` reads sessions, builds a `SummaryReport` and `HourlyReport`, then hands those to `src/reporting/render-summary-report.ts`. `src/cli/run-today-command.ts` reads sessions, builds a `SummaryReport`, then renders. `src/cli/run-hourly-command.ts` reads sessions, builds an `HourlyReport`, then renders through `src/reporting/render-hourly-report.ts`. Those three command runners are the natural place to stop returning rendered strings and instead return a mode-specific result that the dispatcher can either render or serialize, but the JSON branch for `last24h` and `today` must not call the best-metrics refresh or notification helpers that the human path still uses.

Live mode works differently today. `src/cli/run-live-command.ts` creates render options and then either renders one snapshot for non-TTY output or enters a repaint loop that hides the cursor and redraws the screen every five seconds. The live board is global by default unless `--workspace-only` is set. The data behind that screen comes from `src/reporting/build-live-report.ts`, and the text output comes from `src/reporting/render-live-report.ts`. The JSON implementation extracted a reusable one-shot snapshot helper from this file so the machine-readable path can bypass all ANSI cursor control.

The report builders live in `src/reporting/`. `src/reporting/build-summary-report.ts` and `src/reporting/build-hourly-report.ts` consume parsed sessions plus a query object containing filters, idle cutoff, wake window, and report window metadata. `src/reporting/build-live-report.ts` consumes parsed sessions, applied filters, an observed timestamp, and a workspace prefix. `src/reporting/types.ts` defines the internal report objects, all of which contain `Date` values and exact numeric durations. Those exact values are the right source material for JSON mode, but the serializer must turn `Date` into ISO 8601 strings explicitly and must avoid leaking renderer-only assumptions.

The current tests map cleanly onto the new surface. `test/cli.test.ts` only exercises parsing. `test/reporting.test.ts` already creates synthetic `SummaryReport`, `HourlyReport`, and `LiveReport` fixtures and asserts on both builders and renderers. `qa/run-shell-journeys.ts` builds the package, installs the tarball into a temporary `BUN_INSTALL`, seeds synthetic Codex logs under a temporary `HOME`, then executes the journeys listed in `qa/data/user-journeys.csv`. That means machine-readable mode can and should be validated through the packaged binary, not just through internal unit tests.

This plan uses a few terms of art. A machine-readable mode is a CLI output format designed to be consumed by programs instead of humans. A snapshot means one complete report document printed once and then the process exits. A JSON envelope means the top-level object that includes the schema version, the selected mode, command metadata, and the mode-specific payload. A serializer is code that converts an internal report object into that stable external envelope.

## Plan of Work

Begin by extending the parser and dispatcher rather than writing serializers in isolation. The first step is to add one explicit output-format field to `ParsedIdletimeCommand` in `src/cli/parse-idletime-command.ts` and to teach the help text that `--json` is available on the four report modes. The parser should also resolve the few incompatible combinations now so the rest of the code does not have to guess. `--json --share` should fail early. `--help` and `--version` should remain outside the JSON feature.

Once the command model can express the new format, add a dedicated serializer layer next to the report builders. Do not serialize directly from the renderers, and do not scatter `JSON.stringify` calls through the command runners. Introduce a small set of versioned serializer types and functions that take the internal report objects and emit the external envelope with stable names, ISO timestamps, exact numeric values, and nullable fields where absence is a real state. The serializer should include the normalized command metadata that the dispatcher actually used, reuse the existing internal field names when they are already concrete and understandable, and stay separate from the internal type definitions so future refactors do not automatically become CLI breaking changes.

After the serializer layer exists, refactor the command runners so they produce structured mode results instead of pre-rendered strings. The non-live modes should build their reports once and let `run-idletime.ts` decide whether to call a text renderer or a JSON serializer. Live mode needs a small additional split: extract a snapshot helper that reads recent sessions and returns a `LiveReport`, then keep the repaint loop as a human-readable-only wrapper around that helper. JSON mode should always call the snapshot helper once and print one serialized envelope, and the historical JSON branch should skip best-metrics refresh and notifications entirely.

Finish by hardening the surface through tests, README updates, help-text updates, and packaged QA. The release gate already depends on `bun run qa`, so the feature is not complete until the installed binary demonstrates a real JSON path, not just internal function tests. The documentation should explain that JSON mode is exact-value automation output, that live JSON is one-shot, and that the traditional dashboards remain the default human experience.

## Milestones

### Milestone 1: Add the format flag and lock the CLI contract

At the end of this milestone, `src/cli/parse-idletime-command.ts` can parse `--json` for `last24h`, `today`, `hourly`, and `live`, and `ParsedIdletimeCommand` carries an explicit output-format field instead of leaving format as an implicit concern. The help text documents the new flag and its live one-shot behavior. The parser also rejects `--json --share` with a clear error so downstream code does not have to special-case an impossible state.

The touched files are expected to be `src/cli/parse-idletime-command.ts`, `test/cli.test.ts`, and the help examples that belong in the parser. This milestone is successful when parser tests prove the flag is accepted on report modes, incompatible combinations fail early, and `--help` and `--version` keep their existing plain-text behavior.

### Milestone 2: Introduce the versioned JSON serializers

At the end of this milestone, the repository has a dedicated serializer layer that can turn `SummaryReport`, `HourlyReport`, and `LiveReport` into one explicit V1 JSON contract with ISO timestamps and exact numeric values. The serializer layer should live in its own feature-local module set, likely under `src/reporting/` because it is a second output path for the existing report builders. It must not depend on the human renderers.

The touched files are expected to include `src/reporting/types.ts` for any new public serializer types, one or more new serializer modules such as `src/reporting/serialize-summary-report.ts`, `src/reporting/serialize-hourly-report.ts`, `src/reporting/serialize-live-report.ts`, and focused additions in `test/reporting.test.ts`. This milestone is successful when synthetic report fixtures can be serialized into the stable envelope and the resulting JSON contains no ANSI codes, no human-abbreviated quantities such as `1.8B`, and no raw `Date` objects.

### Milestone 3: Refactor the command runners around structured mode results

At the end of this milestone, the CLI computes each report once and then chooses either the text renderer or the JSON serializer at the top level. `src/cli/run-idletime.ts` becomes the central output-format switch. `src/cli/run-last24h-command.ts`, `src/cli/run-today-command.ts`, and `src/cli/run-hourly-command.ts` return structured mode results instead of ready-to-print strings. `src/cli/run-live-command.ts` exposes a reusable one-shot snapshot helper and keeps the repaint loop only for human-readable live mode. The historical JSON branch must remain read-only so it does not refresh best metrics or trigger notifications.

The touched files are expected to be `src/cli/run-idletime.ts`, the four mode runners under `src/cli/`, and any small CLI type module needed to define a mode-result union. This milestone is successful when `bun run idletime --json`, `bun run idletime today --json`, `bun run idletime hourly --json`, and `bun run idletime live --json` all print one JSON document and exit, while `bun run idletime live` still repaints in place on a TTY exactly as it does now.

### Milestone 4: Add release-grade validation and documentation

At the end of this milestone, the new JSON surface is documented and covered in both unit tests and packaged-binary QA. `README.md` explains when to use `--json`, `src/cli/parse-idletime-command.ts` help text shows examples, `qa/data/user-journeys.csv` includes installed-binary JSON journeys, and `qa/data/coverage-matrix.csv` records the new automation coverage rows. The release gate remains green.

The touched files are expected to be `README.md`, `qa/data/user-journeys.csv`, `qa/data/coverage-matrix.csv`, `qa/run-shell-journeys.ts` for JSON parsing assertions, and the relevant tests. This milestone is successful when the packaged binary can demonstrate both a historical JSON snapshot and a live JSON snapshot in the isolated QA sandbox, and when `bun run check:release` passes with the new journeys enabled.

## Concrete Steps

All commands in this plan assume the working directory is `/Users/parkerrex/Projects/idletime`.

Start by extending the parser and proving the flag semantics before touching the report builders. Read the parser and CLI tests together, then add the output-format field and the invalid-combination behavior. Run:

    cd /Users/parkerrex/Projects/idletime
    bun test test/cli.test.ts

Expect the parser suite to prove that `parseIdletimeCommand(["--json"])` selects `last24h`, that `parseIdletimeCommand(["live", "--json"])` selects live JSON snapshot mode, and that `--json --share` fails with a specific error message.

Once the parser contract is stable, add the serializer modules and keep them independent from the text renderers. Reuse the synthetic fixtures in `test/reporting.test.ts` so the serializer tests can assert on exact values without reading local session logs. Run:

    cd /Users/parkerrex/Projects/idletime
    bun test test/reporting.test.ts

Expect the new assertions to prove that serialized timestamps are ISO strings, durations and token counts remain numeric, `last24h` can include both `summaryReport` and `hourlyReport`, and `live` serialization contains one finite snapshot payload instead of repaint metadata.

After the serializer tests pass, refactor the command runners so the dispatcher chooses the output format. Keep the human renderers intact while moving the decision up into `src/cli/run-idletime.ts`. Then validate the actual CLI paths directly:

    cd /Users/parkerrex/Projects/idletime
    bun run idletime --json
    bun run idletime today --json
    bun run idletime hourly --json
    bun run idletime live --json

Expect each command to print one JSON object starting with `{` and to exit without ANSI cursor control. `bun run idletime live` without `--json` should still repaint in place. `bun run idletime --json --share` should exit non-zero with a clear error that share mode is human-only, and `last24h` plus `today` JSON runs should leave the best-metrics files untouched.

Finish by updating the docs and QA data, then run the release checks. At minimum, add one packaged historical JSON journey and one packaged live JSON journey so the tarball surface is proven. Run:

    cd /Users/parkerrex/Projects/idletime
    bun run qa
    bun run check:release

Expect the new journeys to pass inside the isolated temp `HOME`, to parse the JSON output and assert specific fields, and to leave the best-metrics state untouched on the JSON paths. Expect `bun run check:release` to remain green with the added coverage rows.

## Validation and Acceptance

The feature is accepted only when the packaged CLI can emit stable JSON for the existing report modes without breaking the default human dashboards. A human or agent must be able to run `bun run idletime --json` and receive one JSON document that contains a schema version, the selected mode, normalized command metadata, and the structured report payload. The same must be true for `today`, `hourly`, and `live`, with `live --json` returning one snapshot and exiting even on a TTY. For `last24h` and `today`, the JSON path must not refresh best metrics, append events, or trigger notifications.

Validation must prove behavior, not just implementation structure. The JSON output must contain exact numeric durations and token counts, explicit booleans, explicit nulls where data is absent, and ISO timestamp strings. It must not contain ANSI escape sequences, padded text tables, sparklines, big-digit art, or human-abbreviated quantities. The human-readable commands must continue to render their existing text surfaces unchanged when `--json` is absent. JSON runtime failures must still exit non-zero and print the existing plain-text stderr error.

The minimum validation suite for completion is:

    cd /Users/parkerrex/Projects/idletime
    bun run typecheck
    bun test
    bun run qa
    bun run check:release

Acceptance also requires manual smoke checks of the new surface:

    cd /Users/parkerrex/Projects/idletime
    bun run idletime --json
    bun run idletime hourly --json
    bun run idletime live --json

Success means the first two commands produce stable historical snapshots, the third produces one live snapshot and exits, `bun run idletime live` without `--json` still behaves like the current repainting scoreboard, and JSON commands leave the best-metrics state files untouched.

## Idempotence and Recovery

This feature should remain read-only with respect to Codex session logs and best-metrics state. Re-running any JSON command should simply print a fresh snapshot to `stdout`; it should not create cache files, temporary artifacts, best-metrics ledgers, notification records, or persistent automation state of its own.

The implementation should stay safe by keeping the current text paths working until the JSON paths are proven. Refactor toward a shared structured result union rather than building separate duplicate code paths. If a serializer bug appears mid-implementation, the human-readable renderers should still be available as the known-good behavior while the JSON path is fixed.

Live-mode recovery is especially important. The JSON live path must bypass the cursor-hide and screen-clear logic entirely so a failed or interrupted JSON run cannot leave the terminal in a broken state. The repaint loop should remain human-only. If the snapshot helper throws, the command should fail cleanly without partially writing terminal control codes.

Do not silently reintroduce best-metrics refresh or notification side effects into JSON mode. The read-only behavior is intentional and part of the V1 contract.

## Artifacts and Notes

The expected V1 help additions should look roughly like this:

    --json                  print a machine-readable JSON snapshot instead of the visual dashboard

And the examples section should show at least these two new invocations:

    idletime --json
    idletime live --json

The target envelope for a historical mode should look roughly like this. The exact property order can differ, but the stable fields should be present and human-formatting should be absent. The `command` object should show the normalized values that actually drove the snapshot, not the raw argv tokens the user typed.

    {
      "schemaVersion": 1,
      "mode": "last24h",
      "generatedAt": "2026-03-28T13:45:00.000Z",
      "command": {
        "idleCutoffMs": 900000,
        "filters": {
          "workspaceOnlyPrefix": null,
          "sessionKind": null,
          "model": null,
          "reasoningEffort": null
        },
        "groupBy": [],
        "wakeWindow": null
      },
      "summaryReport": {
        "window": {
          "label": "last24h",
          "start": "2026-03-27T13:45:00.000Z",
          "end": "2026-03-28T13:45:00.000Z",
          "timeZone": "America/New_York"
        },
        "metrics": {
          "strictEngagementMs": 1800000,
          "directActivityMs": 2100000,
          "agentCoverageMs": 900000,
          "agentOnlyMs": 600000,
          "cumulativeAgentMs": 1200000,
          "peakConcurrentAgents": 2
        }
      },
      "hourlyReport": {
        "buckets": []
      }
    }

The live JSON artifact should be one snapshot, not a stream:

    {
      "schemaVersion": 1,
      "mode": "live",
      "generatedAt": "2026-03-28T13:46:00.000Z",
      "command": {
        "filters": {
          "workspaceOnlyPrefix": "/tmp/idletime-qa-workspace",
          "sessionKind": null,
          "model": null,
          "reasoningEffort": null
        }
      },
      "liveReport": {
        "observedAt": "2026-03-28T13:46:00.000Z",
        "runningCount": 1,
        "doneRecentCount": 1,
        "doneThisTurnCount": 1,
        "peakTodayCount": 2,
        "recentConcurrencyValues": [0, 0, 1, 1]
      }
    }

The intended failure mode for an incompatible flag combination should be direct and explicit:

    $ bun run idletime --json --share
    Error: --share is only supported for human-readable output.

Runtime failures should still use the existing plain-text stderr path and a non-zero exit code instead of introducing a JSON error envelope.

Observed implementation proof:

    cd /Users/parkerrex/Projects/idletime
    bun run idletime --json
    {
      "schemaVersion": 1,
      "mode": "last24h",
      ...
    }

    cd /Users/parkerrex/Projects/idletime
    bun run idletime live --json
    {
      "schemaVersion": 1,
      "mode": "live",
      ...
    }

    cd /Users/parkerrex/Projects/idletime
    bun run check:release
    35 pass
    QA shell journeys passed: 11 scenarios.
    idletime-0.1.3.tgz

## Interfaces and Dependencies

`src/cli/parse-idletime-command.ts` must own the new format semantics. `ParsedIdletimeCommand` should gain one explicit field for the output format, and the parser should reject incompatible states instead of forcing downstream code to infer them. The help text in this file must remain the source of truth for usage examples.

`src/cli/run-idletime.ts` should become the single place that decides whether a structured mode result is rendered as text or serialized as JSON. That keeps `console.log` ownership centralized and avoids duplicating report-building logic across text and JSON code paths.

The mode runners under `src/cli/` should return a typed union of structured results instead of rendered strings. The likely shape is one result variant for `last24h`, one for `today`, one for `hourly`, and one for `live`, with `last24h` carrying both the summary and hourly reports because the human dashboard already combines them.

The serializer layer should live under `src/reporting/` because it is a second output path for the report builders. It should define the external envelope type and mode-specific serializer functions, and it should perform all `Date` to ISO conversion explicitly. Internal report types in `src/reporting/types.ts` should remain internal inputs to the serializer, not the CLI contract itself.

`src/cli/run-live-command.ts` must expose a pure one-shot snapshot helper that can be used by both the non-TTY human path and the JSON path. The repaint loop, cursor hiding, and screen clearing should remain a thin human-readable wrapper around that helper.

`test/cli.test.ts` and `test/reporting.test.ts` are required dependencies for this feature because they are the lowest-friction place to prove parser semantics and serializer exactness. `qa/data/user-journeys.csv`, `qa/data/coverage-matrix.csv`, and `qa/run-shell-journeys.ts` are also required dependencies because the JSON contract needs packaged-binary proof before the release gate can claim coverage.

`README.md` is a required dependency because the published package includes it, and the current README only describes the human-readable dashboards. The new contract is not complete until the README explains JSON mode in plain language and shows copy-paste commands for both a historical snapshot and a live snapshot.

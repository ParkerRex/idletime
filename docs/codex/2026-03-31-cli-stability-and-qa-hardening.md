---
summary: Strengthen idletime's runtime stability by targeting brittle CLI paths, expanding regression coverage, and codifying recovery guidance around log parsing, terminal handling, and packaged-binary behavior. Keep the work focused on the highest-signal additions to the existing Bun test and QA harnesses.
read_when: Read this when implementing runtime hardening, regression tests, live-mode terminal safety, or expanded installed-binary QA for idletime.
plan_status: done
---
# Harden CLI runtime behavior and regression coverage

This is a living execution plan for the reliability work around `idletime` itself rather than its product positioning or package distribution. Keep it updated as fragile paths are discovered and repaired so another coding agent can resume the hardening work from the plan alone.

Maintain this ExecPlan in accordance with `docs/codex/PLANS.md`.

## Purpose / Big Picture

A beautiful CLI still feels brittle if it crashes on malformed logs, leaves the terminal in a bad state, or silently regresses because only the happy paths are tested. `idletime` already has valuable reporting tests and installed-binary smoke checks, but its most failure-prone paths still sit at the edges: session loading, top-level command failures, and live-mode terminal control. After this work, the repo will have a clear, implementation-ready path for adding the smallest set of high-signal tests and runtime protections needed to make the CLI feel stable under real user conditions.

## Progress

- [x] 2026-03-31 15:21 UTC — Baseline plan authored for runtime hardening and regression coverage.
- [x] 2026-03-31 15:21 UTC — Converted malformed-session handling into an explicit read-only warning contract and carried that warning metadata through report builders, renderers, and JSON serialization.
- [x] 2026-03-31 15:21 UTC — Expanded deterministic coverage in `test/codex-session-log.test.ts` and `test/reporting.test.ts` for malformed session files and warning propagation.
- [x] 2026-03-31 15:21 UTC — Revalidated the release gate with `bun test`, `bun run qa:gaps`, and the full `bun run check:release` path.

## Surprises & Discoveries

None yet beyond the initial repo read.

The repo already has a better QA base than it first appears. `qa/run-shell-journeys.ts` installs the packed tarball into an isolated temporary global environment, and `qa/find-gaps.ts` enforces evidence-bearing coverage rows. The missing piece is not the existence of QA, but the depth of scenarios around failure modes and terminal lifecycle.

The current malformed-session behavior is harsher than the desired CLI stability target. `src/codex-session-log/read-codex-sessions.ts` uses `Promise.all` across candidate files, and `src/codex-session-log/parse-codex-session.ts` throws on invalid content, so one bad transcript can fail an otherwise read-only report command. This plan treats that as a contract decision that must be resolved before shell-level error messaging and doctor output are implemented.

## Decision Log

- Decision: Keep this plan focused on high-signal additions to the existing Bun test and QA harnesses rather than introducing a new test framework. Rationale: the repo already has a working release gate and package smoke path. The gap is scenario depth, not tooling diversity. Date: 2026-03-31.
- Decision: Treat live-mode terminal state as a first-class reliability concern. Rationale: `src/cli/run-live-command.ts` owns raw-mode input, alternate-screen entry and exit, and repeated redraw logic, which makes it one of the easiest places for regressions to leave users with broken terminals. Date: 2026-03-31.
- Decision: Keep shell-surface product work out of this plan except where reliability overlaps. Rationale: startup menus, richer help, and update UX are already tracked in separate plans. This plan covers robustness and regression prevention around whichever shell shape is current. Date: 2026-03-31.
- Decision: Avoid adding a full new PTY or terminal-test framework unless the current Bun and shell-journey harnesses prove insufficient. Rationale: the simplest path is to extend the existing tests first and reserve heavier terminal tooling only for the few cases that truly need it. Date: 2026-03-31.
- Decision: Read-only commands should skip malformed session files, count them, and surface a concise warning instead of failing the entire command, while state-mutating maintenance paths may remain fail-fast unless separately justified. Rationale: dashboard, hourly, today, live, doctor, and JSON snapshot commands should be resilient to a single broken local transcript, but maintenance flows that update local state should not silently normalize corrupted inputs. Date: 2026-03-31.

## Outcomes & Retrospective

This section should be updated during implementation and at completion. The intended result is now in place for the highest-risk read-only path: malformed session files no longer collapse dashboards, live snapshots, or JSON snapshots, and instead produce explicit warning metadata that the CLI can render consistently. The release gate remained green after the changes, which proves the new warning contract fits the existing QA and packaging path instead of creating a side-channel stability story.

## Context and Orientation

The core runtime surfaces are split across three areas. The command entry path lives in `src/cli/`, especially `src/cli/run-idletime.ts`, `src/cli/parse-idletime-command.ts`, and `src/cli/run-live-command.ts`. Session ingestion lives in `src/codex-session-log/`, where log files are discovered, parsed, and converted into reportable session structures. Rendering and serialization live in `src/reporting/`, which is already well covered by unit tests for the happy path. The current release safety path uses `bun test`, `bun run qa`, and `npm pack --dry-run`, with installed-binary smoke coverage defined in `qa/data/user-journeys.csv` and required evidence tracked by `qa/data/coverage-matrix.csv`.

`src/cli/run-live-command.ts` deserves special attention because it manages terminal escape sequences, raw-mode input, retry rendering when refresh fails, and cleanup in the `finally` path. Session loading also deserves direct hardening because `src/codex-session-log/read-codex-sessions.ts` treats missing directories as normal but still throws for unexpected read errors, while deeper parsing modules must cope with real-world transcript drift. A newcomer implementing this plan should keep a strict boundary: use tests to prove the expected behavior first, then add the smallest runtime guard or message necessary to make the failure mode understandable.

## Plan of Work

Start by turning vague reliability worries into named contracts. Re-read the CLI entry path, live-mode loop, session readers, and the current QA matrix, then list the high-risk cases that a user could trigger today: malformed flag values, unsupported flags, broken or missing session directories, malformed session files, live refresh exceptions, interrupted live sessions, and packaged-binary regressions. Lock the malformed-session policy first: read-only commands tolerate bad files by skipping them with warning, while state-mutating maintenance flows remain fail-fast unless a later explicit decision changes that contract. Map each case to the thinnest useful proof: a unit test, a packaged-binary shell journey, or a terminal-focused smoke check.

After the inventory is explicit, add coverage in two layers. Use Bun tests for deterministic parser, loader, and renderer failure cases. Use the existing QA harness for installed-binary behavior and any scenario that depends on the packed artifact. Only after coverage exists should runtime hardening be added where necessary, such as better error normalization, safer terminal cleanup, or clearer failure messages for missing or malformed data.

Finish by tightening recovery guidance. Update this plan with the exact commands and observations that distinguish a temporary environment issue from a real regression. Ensure `bun run check:release` still passes so the reliability work stays inside the normal release discipline instead of becoming a side process.

## Milestones

Milestone 1 produces a reliability inventory and test map. At the end of this milestone, the plan names the highest-risk code paths and ties each one to a validation surface. Success is proven by the updated plan content itself and by at least one new targeted test added for a clearly identified gap.

Milestone 2 expands deterministic test coverage. At the end of this milestone, Bun tests cover malformed arguments, expected parser failures, missing or malformed session inputs, and any report serialization edge that currently relies on incidental behavior. Success is proven by `bun test` passing with the new scenarios.

Milestone 3 expands packaged-binary and live-mode validation. At the end of this milestone, the QA journey set and coverage matrix include the most important installed-binary failure or support scenarios, and live-mode terminal behavior has at least one repeatable verification path. Success is proven by `bun run qa` and by explicit evidence that the live loop exits cleanly after interruption or failure.

Milestone 4 lands targeted runtime hardening for any still-failing cases. At the end of this milestone, the code has the smallest necessary guards or message improvements to make the tested failure cases safe and understandable. Success is proven by the full release gate remaining green and by new evidence snippets in this plan.

## Concrete Steps

From `/Users/parkerrex/Projects/idletime`, begin by reading `src/cli/run-idletime.ts`, `src/cli/parse-idletime-command.ts`, `src/cli/run-live-command.ts`, `src/codex-session-log/read-codex-sessions.ts`, the relevant parser modules in `src/codex-session-log/`, `test/cli.test.ts`, `test/codex-session-log.test.ts`, `test/reporting.test.ts`, `qa/run-shell-journeys.ts`, `qa/data/user-journeys.csv`, and `qa/data/coverage-matrix.csv`.

Write down the current uncovered behaviors before editing code. The most likely additions are parser failure assertions, command-level error-boundary tests once that boundary exists, malformed log fixtures under `test/fixtures/codex-session-log/`, and one or more installed-binary journeys that prove public-facing failure or recovery behavior.

Add the smallest deterministic tests first. For example, if a parser failure currently throws a raw error, capture the existing behavior in a test before refactoring it. If missing session directories are already treated as empty input, add a test that proves that contract rather than relying on a transitive helper behavior. For live mode, prefer testing the pure or semi-pure parts of the loop where possible, then add a targeted smoke path for terminal cleanup if direct unit coverage is awkward.

After tests expose the brittle points, add focused hardening. This may include a top-level error boundary, more descriptive error messages, stricter cleanup in `run-live-command.ts`, or tolerant read-path handling that records malformed session warnings without collapsing all read-only commands. Do not widen scope into unrelated product UX changes.

Use these commands from `/Users/parkerrex/Projects/idletime` during implementation:

    bun test test/cli.test.ts test/codex-session-log.test.ts test/reporting.test.ts
    bun test
    bun run qa:gaps
    bun run qa:journeys
    bun run qa
    bun run check:release

## Validation and Acceptance

The change is acceptable only if the repo can prove its failure-heavy paths are deliberate rather than accidental. A human should be able to verify that malformed arguments produce expected failures, missing or malformed input data no longer causes surprising breakage, live-mode interruption does not leave the terminal unusable, and the packaged binary still passes the installed-binary smoke suite. `bun run check:release` must remain green at the end.

Acceptance evidence should include short transcripts like these, adapted to the final behavior:

    /Users/parkerrex/Projects/idletime$ bun test
    ...all targeted CLI and session-log tests pass...

    /Users/parkerrex/Projects/idletime$ bun run qa
    QA shell journeys passed: ... scenarios.

    /Users/parkerrex/Projects/idletime$ idletime live
    ...Ctrl+C or q exits cleanly and the shell prompt returns without a broken terminal state...

## Idempotence and Recovery

This work should proceed test-first wherever practical. If a new hardening change breaks existing public behavior, prefer reverting the guard and keeping the new failing test skipped or documented temporarily rather than leaving the repo in a half-explained state. If a live-mode experiment leaves the terminal in a bad state during development, use `stty sane` before continuing and record the failure in this plan.

Keep packaged-binary QA additive. When a new journey represents a public contract, add the matching coverage-matrix row in the same slice so `bun run qa:gaps` stays meaningful. If a proposed hardening change cannot be validated through the current harnesses, do not merge it until the missing proof path is added or the plan explicitly narrows the goal.

## Artifacts and Notes

Record the final list of new regression tests, the most important packaged-binary QA additions, and any terminal-recovery notes discovered during implementation. At a minimum, capture one passing `bun run qa` summary and one transcript showing a previously brittle path now failing safely.

Useful baseline observations at plan creation time:

    `src/cli/run-live-command.ts` owns raw-mode setup, alternate-screen entry, redraw, and cleanup.
    `qa/run-shell-journeys.ts` already validates the packed tarball in an isolated temporary global environment.
    `test/cli.test.ts` currently focuses on parser behavior, not the full command runner or live terminal lifecycle.

## Interfaces and Dependencies

Any new reliability-oriented helper should stay close to the CLI or session-log modules it protects. Avoid creating broad utility buckets. Parser and command-runner hardening should remain in `src/cli/`. Log-ingestion hardening should remain in `src/codex-session-log/`. Any tolerant read-path helper should return explicit warning metadata rather than silently swallowing bad files so the shell and doctor surfaces can present one consistent warning story. Test additions should continue to use Bun test and the existing QA harness. If a PTY-style helper or terminal test shim becomes necessary, add the smallest repo-local helper that serves the exact scenarios in this plan and no more.

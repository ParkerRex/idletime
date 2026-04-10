# Changelog

All notable changes to `idletime` will be documented in this file.

The format is based on Keep a Changelog and this project currently tracks release-ready snapshots manually.

## [Unreleased]

### Added

- Added a dedicated `idletime week` mode that renders a 7-day token-burn view with a weekly line chart and daily burn rows.

### Changed

- The launcher now exposes `week` as an explicit mode and uses clearer selection copy instead of the old shorthand-heavy prompt.

## [0.3.0] - 2026-03-31

### Added

- Added a TTY-only `idletime` launcher plus a dedicated `doctor` command so the CLI is easier to discover and diagnose on first run.
- Added a guidance-first `idletime update` command with install-mode detection for Bun global, npm global, `npx`, `bunx`, source-tree, and unknown layouts.
- Added live Codex quota visibility to the dashboard and JSON snapshot surfaces, including `5h remaining`, `week remaining`, `5h used`, and `week used`.
- Added a dedicated `src/codex-limits/` feature folder, deterministic quota fixtures for QA, and spawned-binary regression coverage for the Codex app-server handshake.

### Changed

- The top-level CLI now runs through a shared command registry and a single error boundary instead of scattered hand-written help and dispatch copy.
- The publish workflow is now manual-only from `main`, verifies the requested version before release, and creates the GitHub release only after npm publish succeeds.
- The limits rows now follow OpenAI's active 5-hour and weekly windows as truth instead of showing local-midnight or last-hour pace estimates.

### Fixed

- Fixed the live Codex quota reader handshake so `account/rateLimits/read` resolves reliably against the real `codex app-server`.
- Fixed quota-reader environment overrides so `CODEX_BINARY` and fixture-driven probes merge with `process.env` instead of dropping `PATH`.
- Read-only report commands now skip malformed Codex session files with explicit warnings instead of failing the entire dashboard or JSON snapshot.
- The release docs now point one-off Bun users at `bunx idletime@latest`, which matched the live `0.2.0` publish in clean temp-directory verification on March 30, 2026.
- The README now documents the correct Bun global upgrade path: `bun add -g idletime@latest --force` instead of `bun update idletime`.

## [0.2.0] - 2026-03-28

### Added

- Added a new `live` CLI mode that renders a global task scoreboard with `waiting on you`, `running`, recent concurrency, `running at`, `waiting at`, `top waiting`, `done this turn`, and `today peak`.
- Added protocol-shaped transcript `taskWindows` so parser and reporting code can model Codex task lifecycle directly instead of only session activity.
- Added a dedicated historical `Agents` section to the daily and hourly views.
- Added a global `--json` snapshot mode for `last24h`, `today`, `hourly`, and `live`.
- Added an explicit `refresh-bests` command so personal-record refresh and best-related notifications have a dedicated maintenance path.

### Changed

- Switched the shared historical time axis from grouped 24-hour numbers to actual clock labels such as `8am`, `12pm`, and `4pm`.
- Historical agent concurrency now flows through the task-window adapter when transcript lifecycle records exist, with a legacy session-activity fallback for older subagent logs.
- Non-TTY `idletime live` runs now emit a single snapshot and exit so the command can be used in scripts and validation.
- `idletime live` now defaults to global scope and uses `--workspace-only` as the explicit repo filter.
- `last24h` and `today` now stay on the fast read path and render cached `BEST` values only when the ledger already exists.
- Installed-binary QA now covers JSON snapshots and the explicit `refresh-bests` flow.

## [0.1.3] - 2026-03-27

### Added

- Added a persistent `BEST` header plaque that shows top concurrent agents, top rolling 24-hour raw burn, and top rolling 24-hour agent sum.
- Added a durable best-metrics ledger under `~/.idletime/` plus an append-only `best-events.ndjson` history file.
- Added best-effort macOS notifications for genuine new bests and opt-in near-best nudges with a persisted cooldown state file.
- Added a bundled notification icon asset for the macOS notification path when `terminal-notifier` is available.

### Changed

- `today` and the default `last24h` flow now refresh best metrics before rendering the report.
- The macOS notification path now prefers `terminal-notifier` with a custom icon and falls back to AppleScript only when needed.

### Fixed

- The all-history record scan now skips malformed legacy Codex session files instead of breaking normal report runs.

## [0.1.2] - 2026-03-27

### Fixed

- Stopped the installed CLI from crashing on real Codex log streams where `total_token_usage` resets between tasks.
- Switched token delta reporting to prefer `last_token_usage` when present, while keeping a safe fallback for older logs.

### Added

- Added a `qa/` release safety layer with CSV-driven installed-binary journeys and a coverage-matrix gap checker.
- Added a CI workflow that runs the same release checks on pushes to `dev` and `main`, plus pull requests.

### Changed

- `check:release` now runs the packaged Bun smoke journeys before publish.

## [0.1.1] - 2026-03-27

### Changed

- Refreshed the CLI dashboard with a full-width `idletime` wordmark band and a warmer yellow/olive terminal palette.
- Moved the `idletime` top band above the summary metadata and stretched the block pattern to the terminal width.
- Simplified the `24h Rhythm` lanes into aligned 4-hour groups for faster scanning in both full and share mode.
- Updated the README screenshot asset to match the current terminal visual design.

## [0.1.0] - 2026-03-27

### Added

- Initial public CLI release for trailing-window Codex activity reporting.
- Default visual `last24h` dashboard with framed header, rhythm strip, spike callouts, and summary stats.
- `today` mode for local-midnight-to-now reporting.
- `hourly` mode for trailing-window hourly breakdowns.
- Wake-window idle reporting via `--wake HH:MM-HH:MM`.
- Screenshot-friendly `--share` mode.
- Model and reasoning-effort grouping via `--group-by`.
- Packaging and release scripts for npm and Bun distribution.
- GitHub Actions publish workflow for npm release.
- README screenshot asset for the package page and GitHub landing view.

### Changed

- Summary totals are computed from in-window token deltas instead of whole-session terminal totals.
- The default command now prioritizes visual story over plain summary output.

### Notes

- Release metadata is prepared for public npm publishing.
- `license` remains `UNLICENSED` as a deliberate placeholder until the final license choice is made.

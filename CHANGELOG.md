# Changelog

All notable changes to `idletime` will be documented in this file.

The format is based on Keep a Changelog and this project currently tracks release-ready snapshots manually.

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

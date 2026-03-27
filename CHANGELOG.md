# Changelog

All notable changes to `idletime` will be documented in this file.

The format is based on Keep a Changelog and this project currently tracks release-ready snapshots manually.

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

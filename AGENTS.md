# AGENTS.md

## Tools

- Use `bun` for JavaScript tasks.

## Release Safety

- Run `bun run check:release` before publishing or pushing release-critical changes.
- The release gate must stay green across:
  - `bun run typecheck`
  - `bun test`
  - `bun run qa`
  - `npm pack --dry-run`

## QA Folder

- CSV shell journeys live in `qa/data/user-journeys.csv`.
- The release coverage checklist lives in `qa/data/coverage-matrix.csv`.
- `bun run qa:gaps` fails when a required coverage row is missing evidence.
- `bun run qa:journeys` builds the package, installs the packed tarball into an isolated temp `BUN_INSTALL`, seeds synthetic Codex logs, and runs the shell journeys against the installed binary.
- `bun run qa` is the local QA shortcut and should remain safe to run without touching the developer's real global install.

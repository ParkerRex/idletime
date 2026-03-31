# idletime

Local Bun CLI for Codex activity, token burn, visual 24-hour rhythm charts, and wake-window idle time.

`idletime` reads local Codex session logs from `~/.codex/sessions` and turns them into a trailing-window dashboard that answers:

- When was I actually focused?
- When was the direct thread active?
- Where were the dead spots or awake idle gaps?
- Which hours spiked in token burn?
- How much of the day was direct work versus subagent runtime?
- How much OpenAI 5-hour and weekly quota is left right now?

![idletime dashboard screenshot](./assets/idle-time-readme.png)

## How It Works

The dashboard and snapshot commands are read-only. They scan your local Codex session logs under `~/.codex/sessions/YYYY/MM/DD/*.jsonl` and build reports from those raw events. The explicit `refresh-bests` command is the maintenance exception: it updates `~/.idletime/` and can fire best-related notifications.

At a high level:

- it classifies sessions as direct or subagent from `session_meta.payload.source`
- it treats real `user_message` arrivals as the strongest focus signal
- it builds activity blocks by extending events forward by the idle cutoff
- it computes hourly and summary burn from token-count deltas, not just final session totals
- it reads live Codex rate limits from `codex app-server` and ties quota usage rows to the active OpenAI windows
- it clips everything to the requested window so `last24h` means the actual last 24 hours

That is why the dashboard can show both a fast visual story and defensible totals.

## Install

Local development:

```bash
bun install
```

After publish, expected install paths are:

```bash
npm install -g idletime@latest
```

```bash
bun add -g idletime@latest
```

To update an existing Bun global install to the latest published version:

```bash
bun add -g idletime@latest --force
```

Use that instead of `bun update idletime`. In local verification on March 31, 2026, `bun update idletime` left the global `idletime` binary on `0.1.2`, while `bun add -g idletime@latest --force` updated the Bun global install to `0.2.0`.

Or run it without a global install:

```bash
npx idletime@latest --help
```

```bash
bunx idletime@latest --help
```

To see the exact supported next step for the current install mode, run:

```bash
idletime update
```

It prints the Bun or npm global update command when the binary was installed that way, and it explains when there is no persistent package to update.

## Start Here

The default command is the main product:

```bash
bun run idletime
```

That shows:

- A gold `BEST` plaque in the header for your top concurrent agents, top 24-hour raw burn, and top agent-sum record
- A framed trailing-24h dashboard
- A `Limits` section with live `5h remaining`, `week remaining`, `5h used`, and `week used` rows tied to OpenAI's current quota windows
- A dedicated `Agents` section that charts concurrent child-task windows over the day
- A `24h Rhythm` strip for `focus`, `active`, `quiet` or `idle`, and `burn`
- `Spike Callouts` for the biggest burn hours
- A lower detail section with activity, tokens, and wake-window stats

## Core Concepts

- `focus`: strict engagement inferred from real `user_message` arrivals
- `active`: broader direct-session movement in the main thread
- `idle`: awake idle time, only shown when you pass `--wake`
- `quiet`: non-active time when no wake window is provided
- `burn`: practical burn, calculated as `input - cached_input + output`
- `Agents`: concurrent child-task windows derived from transcript lifecycle records when they exist, with a compatibility fallback for older subagent logs

Additional behavior:

- `last24h`: the default trailing window, clipped to the actual last 24 hours
- `today`: local midnight to now
- `live`: global task scoreboard by default, with `waiting on you`, `running`, recent concurrency, and per-project live state
- `refresh-bests`: explicit full-history personal-record refresh for the `BEST` plaque and best-related notifications
- `direct`: user-started work in the main CLI or compatible direct session types
- `subagent`: spawned agent sessions
- `idle cutoff`: how long activity stays alive after the last event before it counts as quiet or idle

## Commands

Default trailing-24h dashboard:

```bash
bun run idletime
```

Turn quiet time into real awake idle:

```bash
bun run idletime --wake 07:45-23:30
```

Trim the output into a screenshot card:

```bash
bun run idletime --wake 07:45-23:30 --share
```

Show the current local day only:

```bash
bun run idletime today
```

Limit to one workspace:

```bash
bun run idletime today --workspace-only /path/to/demo-workspace
```

Open the full hourly table:

```bash
bun run idletime hourly --window 24h --workspace-only /path/to/demo-workspace
```

Open the live global scoreboard:

```bash
bun run idletime live
```

`live` defaults to all local sessions. Use `--workspace-only` when you want to pin the board to one repo or project path.
Use `--global` when you want to clear a previously added workspace scope explicitly.
When stdout is a TTY it repaints in place like a scoreboard. When stdout is not a TTY, it renders one snapshot and exits, which makes it usable in scripts and validation.

Pin the live board to one workspace:

```bash
bun run idletime live --workspace-only /path/to/demo-workspace
```

Refresh your `BEST` records explicitly:

```bash
bun run idletime refresh-bests
```

Group the summary by model and effort:

```bash
bun run idletime last24h --group-by model --group-by effort
```

Get machine-readable snapshots:

```bash
bun run idletime --json
```

```bash
bun run idletime today --json
```

```bash
bun run idletime hourly --json
```

```bash
bun run idletime live --json
```

`--json` is read-only. It emits one versioned JSON snapshot and exits. On `last24h` and `today`, it does not refresh best metrics or trigger best-related notifications. `--share` is human-only and cannot be combined with `--json`.

## Share Mode

`--share` keeps the visual story and trims the secondary detail:

- header
- 24-hour rhythm strip
- top-3 burn spike callouts
- compact snapshot block

That is the best mode for terminal screenshots.

## What The Visuals Mean

The top of the dashboard is intentionally visual-first.

- `Agents` plots concurrent child-task windows with real clock labels like `8am`, `12pm`, and `4pm`
- `24h Rhythm` gives one character per hour bucket across the trailing day
- `focus` makes it obvious where you were actually engaged
- `active` shows the broader direct-session footprint
- `idle` appears when you pass `--wake`, otherwise that lane becomes `quiet`
- `burn` highlights token spikes without making you read the table first
- `Spike Callouts` surfaces the top burn hours immediately

The live board is intentionally narrower:

- `waiting on you`: recent direct sessions whose latest task completed after your last `user_message`, so you likely owe the next reply
- `running`: active task windows across the selected scope after effort-aware staleness
- `running at`: per-project counts for currently running work
- `waiting at`: per-project counts for sessions currently waiting on you
- `top waiting`: the specific waiting threads, shown as `project • age • thread id`
- `recent`: short live concurrency strip across the last 15 minutes
- `this turn`: completed child tasks anchored to the latest still-warm direct `user_message`
- `today peak`: highest observed concurrent child-task count since local midnight

## Help

```bash
bun run idletime --help
```

The help screen explains the modes, the chart lanes, and includes copy-paste examples.

Version output:

```bash
bun run idletime --version
```

Once published, that also works as:

```bash
idletime --version
```

## Record Tracking

`idletime` now keeps a local personal-best ledger under `~/.idletime/`.

- `bests-v1.json`: durable best values for the header plaque
- `best-events.ndjson`: append-only new-best history
- `near-best-notifications-v1.json`: opt-in state for “close to best” nudges

By default:

- dashboards read cached `BEST` values when `bests-v1.json` already exists
- a cold cache renders without the `BEST` plaque instead of bootstrapping best state implicitly
- genuine new-best events can trigger a local macOS notification during the explicit refresh path
- near-best nudges are stored but disabled until you opt in by setting `nearBestEnabled` to `true`

When you want to recompute those records, update the ledger, and fire any eligible notifications, run:

```bash
bun run idletime refresh-bests
```

## Validation

```bash
bun run typecheck
bun test
```

Release QA:

```bash
bun run qa
```

That QA pass reads:

- `qa/data/user-journeys.csv` for installed-binary shell journeys
- `qa/data/coverage-matrix.csv` for required release coverage rows

It builds the package, packs the current checkout, installs the tarball into an isolated temp `BUN_INSTALL`, seeds synthetic Codex session logs, and runs the shell journeys against the installed `idletime` binary.

Operational note: the default `last24h` and `today` commands now stay on the fast read path. They render from the requested report window plus any cached `BEST` ledger state and do not refresh records implicitly. `refresh-bests` is the only CLI command that performs the full-history best-metrics scan.

## Release Prep

Build the publishable CLI bundle:

```bash
bun run build
```

Dry-run the release checks:

```bash
bun run check:release
```

`check:release` now runs:

- `bun run typecheck`
- `bun test`
- `bun run qa`
- `npm pack --dry-run`

Dry-run the Bun publish flow:

```bash
bun run publish:dry-run
```

Preview exactly what npm would ship:

```bash
bun run pack:dry-run
```

## GitHub Release Flow

This repo now includes:

- `.github/workflows/ci.yml` for push and pull-request release checks
- `.github/workflows/publish.yml` for the actual npm publish flow

What it does:

- `ci.yml` runs on pushes to `dev` and `main`, plus pull requests
- `publish.yml` runs only on manual dispatch from `main`
- requires the requested version to match `package.json`
- fails before publish when the npm version, Git tag, or GitHub release already exists
- installs Bun and Node on a GitHub-hosted runner
- runs `bun run check:release`
- publishes to npm with `npm publish --access public --provenance`
- creates the GitHub release only after npm publish succeeds

What you need in GitHub:

- the `NPM_TOKEN` secret already added to the repo
- the repo pushed to GitHub so Actions can run
- the repo URL in `package.json` now points at `https://github.com/ParkerRex/idletime`

## Release Notes

- The published binary is `idletime`.
- The package is prepared for public publish on npm and Bun.
- Use `bunx idletime@latest` for one-off runs. In a clean temp directory on March 30, 2026, `bunx idletime` resolved `0.1.2` while `bunx idletime@latest` resolved `0.2.0`.
- Use `idletime update` to print the supported update command for the current install mode.
- `package.json` currently uses `license: "UNLICENSED"` as a deliberate placeholder. Choose the real license you want before the first public release.

## npm Site Checklist

If you want the cleanest setup, use npm trusted publishing with GitHub Actions instead of a long-lived token.

Preferred path:

1. Publish the package from GitHub Actions, not manually from your laptop.
2. On npm, open the package settings and configure a `Trusted Publisher` for your GitHub Actions workflow.
3. Keep `id-token: write` in the publish workflow so npm can use OIDC.

Official docs:

- npm trusted publishers: https://docs.npmjs.com/trusted-publishers/
- GitHub npm publishing workflow: https://docs.github.com/en/actions/tutorials/publish-packages/publish-nodejs-packages

If you want to use a token instead:

1. On npm, go to `Access Tokens`.
2. Generate a new granular token on the website.
3. Give it `Read and write` package access.
4. Make sure it can publish when 2FA is enabled. npm rejected the first workflow run because the token did not satisfy that requirement.
4. Store it in GitHub as `NPM_TOKEN`.

Official token docs:

- https://docs.npmjs.com/creating-and-viewing-access-tokens/

Important:

- trusted publishing currently requires GitHub-hosted runners
- trusted publishing is preferred over long-lived tokens
- provenance is enabled in `package.json`, but for provenance to be fully useful you should also add the real public GitHub `repository` metadata before first publish
- since you already added `NPM_TOKEN`, the included GitHub Actions workflow can publish with the token path right now
- if the workflow fails with `403 Forbidden` and mentions two-factor authentication, replace `NPM_TOKEN` with an automation token or a granular token that can bypass 2FA for publish

## Before First Publish

- choose the real license and replace `UNLICENSED` in `package.json`
- add the actual GitHub repo metadata to `package.json`
- run `bun run check:release`
- recheck `npm view idletime version`
- run the `Publish idletime` workflow manually from `main` with the exact `package.json` version
- let the workflow create the GitHub release after npm publish succeeds

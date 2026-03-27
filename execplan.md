# Build a Local CLI for Codex Activity, Token Burn, and Idle Time

This is a living execution plan for the standalone `idletime` project in `/path/to/idletime`. It must stay current as the work progresses so that a fresh coding agent can resume from this file and the working tree alone.

This ExecPlan must be maintained in accordance with `/path/to/demo-workspace/docs/codex/PLANS.md`.

## Purpose / Big Picture

The first goal is a dumb local command-line tool that can answer the exact question that triggered this project: how many hours were spent coding in a given window, how many sessions ran, how much token volume was consumed, how much of that volume came from cached context, how much came from direct sessions versus subagents, and how much of the activity came from a specific working directory such as `/path/to/demo-workspace`. The second goal is to turn that into a richer and more shareable report: not just “hours active,” but human-engaged hours, direct-session active hours, agent coverage hours, cumulative agent-hours, peak concurrent agents, token totals, practical burn, and model or reasoning breakdowns. The third goal is to make that output more legible with hourly bar graphs so the user can see when the day was heavy, light, fragmented, or dominated by background agent runtime. The fourth goal is to add idle-time reporting during wake hours so the user can answer a more human question: “Where did my wake hours actually go, and how much of that time was truly dead?”

When this plan is complete, someone should be able to open a terminal, change into `/path/to/idletime`, and run a command such as `bun run idletime last24h` to get a compact summary table for the trailing twenty-four hours. They should also be able to run `bun run idletime today` for the local calendar day, `bun run idletime hourly --window 24h` to get per-hour bar output, and then run `bun run idletime last24h --wake 07:45-23:30` to see idle time inside a wake window. Summary mode should report both strict engagement and broader operational activity. Working behavior matters more than elegant architecture in the first slice, but the structure must support the later idle-time phase without being rewritten.

## Progress

- [x] 2026-03-26 23:40 EDT: Created the sibling project directory at `/path/to/idletime`.
- [x] 2026-03-26 23:40 EDT: Read `/path/to/demo-workspace/docs/codex/PLANS.md` and `/path/to/demo-workspace/docs/prompts/execplan-writer.md`.
- [x] 2026-03-26 23:40 EDT: Confirmed the primary data source exists at `~/.codex/sessions/YYYY/MM/DD/*.jsonl`.
- [x] 2026-03-26 23:40 EDT: Confirmed that direct sessions and subagents can be distinguished from `session_meta.payload.source` and that subagent sessions also expose `forked_from_id`.
- [x] 2026-03-26 23:40 EDT: Confirmed that summary totals can be computed from the last `event_msg.payload.info.total_token_usage` per session, but hourly token bars require delta calculation across all token-count events inside each session.
- [x] 2026-03-26 23:49 EDT: Resolved that the CLI should report both human-facing and agent-facing runtime metrics, not collapse them into one “active hours” number.
- [x] 2026-03-26 23:50 EDT: Resolved that the CLI should report both wall-clock agent coverage hours and cumulative agent-hours, plus peak concurrent agents.
- [x] 2026-03-26 23:52 EDT: Confirmed that model and reasoning-effort attribution is available strongly enough for v1 by reading `turn_context` records and `spawn_agent` arguments from the real logs.
- [x] 2026-03-26 23:53 EDT: Resolved that the product should treat rolling trailing windows as first-class, with a `last24h`-style default entrypoint alongside a calendar-day `today` view.
- [x] 2026-03-26 23:54 EDT: Resolved that the default idle cutoff policy should be `15m`, while summary mode should also show a comparison line for `30m`.
- [x] 2026-03-26 23:57 EDT: Resolved that the state model should distinguish strict engagement, broader direct-session activity, agent-only activity, awake idle, and away.
- [x] 2026-03-27 00:01 EDT: Confirmed that the real logs contain `event_msg.user_message` records, which makes a strict engagement metric feasible enough for v1.
- [x] 2026-03-27 00:05 EDT: Bootstrapped the Bun TypeScript CLI project in `/path/to/idletime`, replaced the `bun init -y` starter files, and created the feature-local source tree under `src/` plus sanitized fixtures under `test/fixtures/`.
- [x] 2026-03-27 00:14 EDT: Implemented the log reader and aggregation library for rolling windows, local-day windows, session kinds, working-directory filters, token deltas, and practical burn totals. Added fixture-backed parser and reporting tests.
- [x] 2026-03-27 00:20 EDT: Implemented the first summary command, the hourly bar-graph command, and idle-time v1 with a manual wake window. Wired the CLI surface for `last24h`, `today`, and `hourly`.
- [x] 2026-03-27 00:23 EDT: Validated the shipped commands against the real local logs with `bun run idletime last24h`, `bun run idletime today --workspace-only /path/to/demo-workspace`, `bun run idletime hourly --window 24h --workspace-only /path/to/demo-workspace`, and `bun run idletime last24h --wake 07:45-23:30`.
- [x] 2026-03-27 00:30 EDT: Polished the CLI renderers into framed, screenshot-friendly terminal views with denser bars, compact token formatting, clearer breakdown sections, and a more legible hourly legend.
- [x] 2026-03-27 00:37 EDT: Promoted the trailing-window view into a combined default dashboard. `bun run idletime` now shows the framed `last24h` summary plus a 24-hour rhythm strip for focus, activity, idle or quiet time, and burn spikes.
- [x] 2026-03-27 00:45 EDT: Added ANSI color lanes, top-3 spike callouts, and a `--share` mode that trims the dashboard into a screenshot-oriented card while preserving the same core metrics.
- [x] 2026-03-27 00:47 EDT: Expanded the CLI help text and README so the dashboard lanes, modes, flags, examples, and screenshot flow are self-explanatory without reading the source.
- [x] 2026-03-27 00:54 EDT: Prepared the project for npm and Bun release with a real `bin` entry, Node-compatible built output in `dist/idletime.js`, release-check scripts, install and publish docs, and a working `--version` flag.
- [x] 2026-03-27 00:23 EDT: Deferred idle-time v2. The manual wake-window path now answers the core question cleanly enough for v1, while machine sleep and lock telemetry remains intentionally out of scope for this pass.

## Surprises & Discoveries

None of the raw token totals are small. The logs for 2026-03-26 show that a single heavy direct session can exceed one hundred million total tokens because token counts are cumulative inside a session and cached context is included in the input count. This means raw totals are still useful for measuring “how hard did I hit Codex,” but they are not the best proxy for incremental burn.

The more useful burn metric is `input_tokens - cached_input_tokens + output_tokens`. This plan calls that value “practical burn.” It is not a billing guarantee, but it removes the biggest source of inflation and keeps reasoning output from being double-counted because `reasoning_output_tokens` is already part of `output_tokens`.

Hourly output cannot be derived from the final session totals alone. Every session writes multiple token-count events, each one containing a cumulative total for that session at that moment. The hourly view must compute per-event deltas inside each session and assign those deltas to the timestamp of the event that closed the delta window.

The subagent split is directly visible in the metadata. A representative session record includes an object like the following, which proves that spawned work can be separated from direct CLI work without guesswork:

    "source": {
      "subagent": {
        "thread_spawn": {
          "parent_thread_id": "...",
          "depth": 1,
          "agent_nickname": "Einstein",
          "agent_role": "default"
        }
      }
    }

The logs contain a stronger user-engagement signal than simple turn churn. Real files in `~/.codex/sessions/2026/03/26` include `event_msg.user_message` records, which means a strict engagement metric can be inferred from actual user-message arrivals instead of from any direct-thread noise. This is still an inference, not biometric truth, but it is materially better than treating every direct-session event as proof that the user was engaged.

The logs also expose richer attribution than the first `session_meta` line suggests. While `session_meta` does not reliably carry `model` or `reasoning_effort`, `turn_context` records do carry `model` and effort values, and `spawn_agent` function calls also include explicit `model` and `reasoning_effort` arguments. This makes model and reasoning breakdowns feasible enough for v1 summary and hourly reporting.

The real session history uses more direct-session source variants than the first survey suggested. Recent and legacy logs include `source` values such as `cli`, `vscode`, `exec`, `source.custom`, and in a few early files no `source` key at all. Treating those as direct entrypoints keeps the parser usable across the historical log tree while still reserving `source.subagent` for spawned-agent sessions.

Using whole-session first and last timestamps for overlapping sessions makes rolling windows look older than they really are. The first real `last24h` run reported an activity window that started before the requested window because one direct session began earlier and continued into the window. The shipped summary now clips its activity window and activity blocks to the requested report window instead of reporting raw session boundaries.

Using final per-session token totals for sessions that merely overlap the requested window also overcounts burn. The first real summary pass pulled in tokens from before the start of the rolling window. The shipped summary now computes token totals from in-window token-count deltas so the summary agrees with the hourly rollup and better matches the requested time slice.

Wake-window math must honor the report timezone, not the host process timezone. Bun tests exposed this by producing zero overlap for a synthetic `America/New_York` wake window when the host timezone differed. The fix was to expand wake windows from timezone-specific calendar dates rather than from the process-local day.

## Decision Log

Decision: Start as a standalone project in `/path/to/idletime` rather than adding a package to `demo-workspace`. Rationale: the user explicitly requested a new sibling directory and wants this to become its own small tool. Date: 2026-03-26.

Decision: Keep the first version local-only and CLI-only. Rationale: the fastest path to value is a command that answers the original question with credible numbers; a UI can come later once the metrics settle. Date: 2026-03-26.

Decision: Report both raw total tokens and practical burn. Rationale: raw totals explain why the day felt expensive, while practical burn is more useful for day-over-day comparisons and later product reporting. Date: 2026-03-26.

Decision: Treat direct sessions and subagents as first-class categories in every report. Rationale: spawned agents materially change the burn profile and should never be hidden inside a single rolled-up number. Date: 2026-03-26.

Decision: Report both strict engagement and broader direct-session activity. Rationale: the user wants both the ego metric of “how much was I really engaged” and the operational metric of “how long was the direct thread active.” Strict engagement will be inferred from `user_message` events, while broader direct-session activity will be inferred from any direct-session movement. Date: 2026-03-27.

Decision: Report both wall-clock agent coverage hours and cumulative agent-hours, and include peak concurrent agents. Rationale: “how long did I have agents running at all” and “how much total agent runtime did I consume” are both important and neither should replace the other. Date: 2026-03-27.

Decision: Make rolling trailing windows first-class and let the default no-argument command represent the trailing twenty-four hours. Rationale: the original motivating question was about the last `23.5h`, not just local midnight to now, and that framing is more shareable. Date: 2026-03-27.

Decision: Default the idle cutoff policy to fifteen minutes and always show a thirty-minute comparison line in summary mode. Rationale: fifteen minutes is a reasonable canonical default, but the comparison line makes the sensitivity of the metric visible instead of pretending there is one universal truth. Date: 2026-03-27.

Decision: Include model and reasoning-effort breakdowns in v1 summary and hourly views. Rationale: the logs support it strongly enough, and the shareability of “which agents, on which model, at what effort” is part of the product value rather than optional garnish. Date: 2026-03-27.

Decision: Implement idle-time v1 with a manual wake window before touching machine telemetry. Rationale: manual wake input is low-risk, cross-machine enough for a CLI, and keeps the first idle metric legible. Date: 2026-03-26.

Decision: Structure the parser around event streams, not only session totals. Rationale: summary mode can use final totals, but hourly charts and later idle overlays need event-level timestamps and token deltas. Date: 2026-03-26.

Decision: Treat `cli`, `vscode`, `exec`, `source.custom`, and missing legacy `source` values as direct-session entrypoints. Rationale: real historical logs use all of these variants for user-started work, and failing on them makes the CLI unusable against the full local session history. Date: 2026-03-27.

Decision: Clip summary activity to the requested report window and compute summary token totals from in-window token-count deltas instead of whole-session final totals. Rationale: overlapping sessions otherwise leak earlier activity and burn into `last24h`, which makes the summary disagree with the hourly rollup and overstates the requested slice. Date: 2026-03-27.

Decision: Build wake windows from the report timezone instead of the process timezone. Rationale: wake-window overlap must follow the report’s declared local day even when tests or later usage run under a different host timezone. Date: 2026-03-27.

## Outcomes & Retrospective

As of 2026-03-27 00:23 EDT, Milestones 1 through 4 are shipped. The project is now a standalone Bun CLI with a typed parser, real command surface, fixture-backed tests, and working summary, hourly, and manual wake-window idle reporting against the real `~/.codex/sessions` tree. The CLI stayed small: no third-party CLI parser was needed, and the final structure is still a handful of focused modules under `src/cli/`, `src/codex-session-log/`, `src/report-window/`, and `src/reporting/`.

The biggest implementation lesson was that overlapping sessions change the meaning of “today” and “last24h” if the CLI naively trusts whole-session boundaries or final cumulative totals. Window-scoped activity clipping and window-scoped token deltas materially improved the honesty of the summary and made the summary numbers reconcile with the hourly view.

The visual polish pass also mattered more than expected. The raw numbers were already correct, but the command only started to feel shareable once the output had a stronger hierarchy: a framed header, denser bars, compact burn figures, and breakdown sections that read cleanly in a terminal screenshot.

The final presentation decision was to make the default command visual-first rather than summary-first. The combined `last24h` dashboard now puts a trailing 24-hour rhythm strip above the numeric summary, which makes idle gaps and burn spikes legible before the user reads any totals.

The final screenshot pass added two important product behaviors. First, the top of the dashboard now explicitly calls out the top three burn spikes rather than leaving the user to infer them from the chart. Second, `--share` now produces a shorter card with the rhythm strip, spike callouts, and a compact snapshot block instead of the full diagnostic report.

The last usability pass was mostly explanatory rather than computational. Richer `--help` output, better error guidance, and a fuller README materially reduce onboarding friction because the product now explains its own lanes and flags at the command line.

The release-prep pass found one non-obvious Bun quirk: `bun publish --dry-run` still requires npm authentication even after a successful local pack and release check. That is now documented as an external precondition rather than a packaging bug inside this repo.

The remaining deliberate gap is Milestone 5. Idle-time v2 is deferred rather than half-shipped. Manual wake windows are now good enough to answer the human “where did my wake hours go?” question, and the correct next step for v2 is dedicated macOS telemetry research rather than speculative code.

## Context and Orientation

The implementation target is a brand-new directory, `/path/to/idletime`, which is currently empty except for this plan. There is no existing application code to extend, so the first milestone must create the Bun project, its package metadata, its scripts, its source layout, and its tests. This is a strength rather than a weakness because the tool is small and the domain is narrow.

The primary external data source is the Codex session log tree under `~/.codex/sessions/YYYY/MM/DD/*.jsonl`. Each file is one session. The first line is a `session_meta` record. That metadata includes the current working directory, the session identifier, the model provider, and whether the session is direct CLI work or a spawned subagent. Later lines contain timestamped events such as commentary, function calls, and `token_count` events.

The token-count events are stored as `event_msg` records whose payload type is `token_count`. The important fields live at `payload.info.total_token_usage`. The fields that matter for this project are `input_tokens`, `cached_input_tokens`, `output_tokens`, `reasoning_output_tokens`, and `total_tokens`. The summary view can use the last token-count event in each session. The hourly view must compare consecutive token-count events within the same session and compute the increase between them.

The engagement signals come from a different part of the stream. Real session logs contain `event_msg.user_message` records, which can be treated as evidence that the user actively initiated a new turn. That gives this project two human-facing activity concepts. The strict one, called “engaged,” is built from `user_message` arrivals in direct sessions and extended forward until the configured idle cutoff is exceeded. The broader one, called “direct-session active,” is built from any direct-session event flow, including tool calls and assistant activity in the direct thread.

The logs also expose a richer per-turn context. `turn_context` records contain the turn identifier, current working directory, timezone, model, and effort. That means the project can attribute both strict engagement and broader activity to specific models and reasoning levels when those fields are present in the log. Spawned-agent metadata strengthens that attribution further because `spawn_agent` calls carry explicit `agent_type`, `model`, and `reasoning_effort` arguments.

This plan uses a few precise terms. A “direct session” is a session whose `session_meta.payload.source` is the string `cli`. A “subagent session” is a session whose source payload contains a `subagent` object. A “practical burn” is `input_tokens - cached_input_tokens + output_tokens`. An “activity block” is a continuous stretch of events in which no gap exceeds a configurable idle cutoff such as fifteen minutes. A “wake window” is the period during which the user considers themselves awake, initially supplied manually on the command line.

This plan also uses a small state model. “Engaged” means the user has sent a real `user_message` recently enough that the direct thread remains inside the idle cutoff. “Direct-session active” means there is movement in a direct session whether or not a fresh user message is visible. “Agent-only” means one or more subagents are active while the user is not engaged and the direct thread is not active by the broader definition. “Awake idle” means the user is inside the wake window but neither direct work nor agent work is active. “Away” means time outside the wake window by manual definition in v1, later optionally refined by machine signals in v2.

The intended project layout is small. The project root should contain `package.json`, `tsconfig.json`, `README.md`, and a `src/` tree. The source tree should contain a CLI entrypoint, command modules, log-reading helpers, aggregation helpers, and renderers for tables and bar graphs. Tests should use sanitized fixtures built from small real log excerpts so they can prove the parsing logic without carrying giant personal logs into the repo.

The current repo that inspired this work, `/path/to/demo-workspace`, remains important only as a source of planning rules and the original data investigation. The implementation itself should not depend on runtime code from that repo. The sibling project must stand on its own.

## Plan of Work

Begin by creating a minimal Bun TypeScript project that can run from the terminal without any UI dependencies. Add scripts for development, tests, linting, and formatting only if they materially help the work stay readable; do not overbuild the tool. Create a small internal library layer first, because the project needs the same parsed session data for summary mode, hourly charts, model and reasoning breakdowns, and later idle-time logic.

The first library edit should create a reader that walks `~/.codex/sessions` for the requested window and returns strongly typed session records. The next edit should normalize each session into a stable shape that includes the session kind, working directory, first and last timestamps, all event timestamps, all token-count points, the final session totals, the user-message timestamps, and any model and effort values that can be resolved from `turn_context` or spawn metadata. After that, add summary aggregation that computes strict engagement windows, broader direct-session windows, agent-only windows, agent coverage hours, cumulative agent-hours, peak concurrent agents, direct versus subagent counts, workspace-only filtering, raw token totals, practical burn totals, model and reasoning breakdowns, and merged activity blocks.

Once the summary library works, add the first command modules for the primary time lenses: a trailing-window command named `last24h` and a local-day command named `today`. The no-argument default should behave like `last24h`, while `today` remains explicit and first-class. Only after those commands are correct should the work move to the hourly renderer. The hourly renderer should reuse the same parsed sessions and token deltas, then group them into local-time hour buckets and render fixed-width rows with unicode block bars. Hourly rows should expose the chosen state model, agent concurrency, token burn, and model or reasoning cuts when they fit legibly.

Idle-time work comes after the hourly command, not before it. The first idle implementation should accept a wake window from the user and compute awake-idle time as wake-window minutes minus strict engagement, broader direct activity, and agent-only coverage according to the declared state model. This keeps the concept honest and keeps machine-specific telemetry out of the first usable release. Only if that proves useful should the tool add a second source of truth from macOS sleep or lock logs.

## Milestones

### Milestone 1: Bootstrap the standalone CLI project and build the parser core

At the end of this milestone, `/path/to/idletime` contains a runnable Bun TypeScript project with a CLI entrypoint and a parser library that can scan a time window of Codex JSONL files and return typed session records. The files touched in this milestone should include the root package metadata, the TypeScript configuration, the source entrypoint, at least one library file for reading session files, one library file for parsing token-count events, one library file for extracting user-message and turn-context attribution, and at least one fixture-backed test.

Success for this milestone is proven when a developer can run the tests from the project root and observe that sanitized sample logs are parsed into the expected session shape, including direct-versus-subagent classification, token-point extraction, user-message extraction, and model or effort attribution when those fields exist. No user-facing summary output is required yet, but the parser must be strong enough that summary mode can be a thin layer over it.

### Milestone 2: Ship the summary commands that answer the original question and its richer runtime variants

At the end of this milestone, the CLI can answer the first question in a reproducible way and can also answer the richer runtime questions that emerged during the grill. The command surface should support both local-day and rolling-window usage, a configurable idle cutoff, a default trailing-window mode, and a working-directory filter. Summary output must include the activity window, strict engagement hours, broader direct-session active hours, agent coverage hours, cumulative agent-hours, peak concurrent agents, the direct and subagent session counts, raw total tokens, practical burn, direct-only totals, workspace-only totals, and model or reasoning breakdowns.

Success for this milestone is proven when a real run against the local logs for 2026-03-26 reproduces the known March 26 numbers closely enough that the earlier one-off analysis and the CLI agree on the core totals, and when the richer runtime counters are internally consistent with the declared state model. The summary output should show the canonical fifteen-minute cutoff and also show a thirty-minute comparison line so users can see how the interpretation changes. The project should also include a small fixture-based test for a fake day so that regressions can be caught without replaying giant personal logs in CI.

### Milestone 3: Ship the hourly bar-graph command

At the end of this milestone, the CLI can print one line per hour in a requested window with bars for strict engagement minutes, broader direct-session active minutes, agent-only coverage minutes, token burn, session counts, and peak concurrency. The hourly command must calculate token deltas from all token-count events, not from final session totals. The same command should support the same direct-versus-subagent, working-directory, model, and reasoning filters as the summary command so the numbers can be compared cleanly.

Success for this milestone is proven when the command produces stable output for a known day, the bucket logic is covered by tests, and the bars make visible differences between heavy and light hours, between engagement and background agent runtime, and between different model or reasoning mixes when those cuts are enabled. The command does not need ANSI color in its first version; correctness matters more than decoration.

### Milestone 4: Add idle-time v1 using a manual wake window

At the end of this milestone, the summary command accepts a wake window and prints wake duration, strict engagement duration inside the wake window, broader direct-session duration inside the wake window, agent-only duration inside the wake window, awake-idle duration inside the wake window, awake-idle percentage, and the longest idle gap above a minimum size such as thirty minutes. The implementation should continue to use activity blocks from the summary engine rather than inventing a second notion of activity.

Success for this milestone is proven when the CLI can answer the user’s second question with a real command, and when the reported idle numbers move in sensible ways if the wake window is widened or narrowed. Tests should cover at least one synthetic day where the wake window contains multiple separated activity blocks and multiple idle gaps, and the output should make it obvious when the day had little completely dead time because background agents kept running.

### Milestone 5: Investigate idle-time v2 with machine awake and lock signals

This milestone is exploratory on purpose. At the end of it, the project either has a stable optional integration that can refine wake and away estimates from macOS telemetry, or it has a documented decision to defer that work because the signal is noisy or brittle. This milestone touches only the idle-time portion of the project and must not destabilize summary mode or hourly graphs.

Success for this milestone is proven by either a working optional flag with tests and clear caveats or a deliberate, documented no-go decision in this plan’s Decision Log and Outcomes section.

## Concrete Steps

Work from `/path/to/idletime`.

Create the Bun project and its root files. The simplest safe starting point is:

    cd /path/to/idletime
    bun init -y

Observe that `package.json` and a Bun-friendly TypeScript scaffold appear in the directory. Replace any generic starter file with a CLI-oriented layout under `src/`.

Add the source structure. The initial files should include a CLI entrypoint, command modules for `last24h`, `today`, and `hourly`, a session reader, a token parser, a user-message extractor, an attribution resolver for model and effort, an activity-block builder, a summary aggregator, and renderers for table and bar output. Add a `test/fixtures/` directory with tiny sanitized JSONL samples and add tests that prove classification, user-message extraction, attribution, and token-delta logic.

Once the parser exists, prove it before building the user-facing output:

    cd /path/to/idletime
    bun test

Expect passing tests that show parsed direct sessions, parsed subagent sessions, correct practical-burn math, user-message extraction for strict engagement, and model or effort attribution when those fields are present. If tests are missing or weak at this point, stop and strengthen them before adding more commands.

Add the first real command and validate it against the local logs:

    cd /path/to/idletime
    bun run idletime last24h --idle-cutoff 15m

Expect a compact summary that includes the activity window, strict engagement hours, broader direct-session active hours, agent coverage hours, cumulative agent-hours, peak concurrent agents, raw total tokens, practical burn, and a comparison line for a thirty-minute cutoff. Then run:

    cd /path/to/idletime
    bun run idletime today --workspace-only /path/to/demo-workspace

Expect the totals to narrow to sessions whose `cwd` matches the requested working-directory prefix.

Validate the model and reasoning breakdown explicitly:

    cd /path/to/idletime
    bun run idletime last24h --group-by model --group-by effort

Expect grouped totals that reconcile with the top-line token and runtime numbers for the same window.

Add the hourly command and validate it:

    cd /path/to/idletime
    bun run idletime hourly --window 24h --workspace-only /path/to/demo-workspace

Expect one row per hour in local time with separate bars for strict engagement, broader direct-session activity, and agent-only activity, plus token bars and concurrency counts. If the hourly numbers exceed the summary numbers or fail to sum sensibly, inspect the token-delta logic before proceeding.

Add idle-time v1 and validate it:

    cd /path/to/idletime
    bun run idletime last24h --wake 07:45-23:30 --idle-cutoff 15m

Expect new output fields for wake duration, strict engagement duration, broader direct-session duration, agent-only duration, awake-idle duration, awake-idle percentage, and longest idle gap. Change the wake window and confirm that the idle numbers change in the expected direction.

If Milestone 5 is attempted, add one exploratory command or flag at a time and record what was observed. Do not quietly replace manual wake windows with automatic telemetry until both paths can be compared.

## Validation and Acceptance

The project is not complete until a human can run the CLI against real local logs and get stable answers to the original question and its richer runtime variants. At minimum, all parser and aggregation tests must pass from `/path/to/idletime` with `bun test`. If linting and formatting scripts are added, they must also pass before completion.

Milestone 2 is accepted when the CLI can reproduce the essence of the March 26 analysis: a local-day or rolling-window summary with activity window, strict engagement hours, broader direct-session active hours, agent coverage hours, cumulative agent-hours, peak concurrent agents, direct-versus-subagent split, raw total tokens, practical burn, and workspace-only totals. The summary must also show a fifteen-minute default cutoff and a thirty-minute comparison line. The March 26 result does not need to match down to the last second if the final command-line semantics differ slightly, but the totals and logic must be explainable and consistent.

Milestone 3 is accepted when the hourly command can show a believable per-hour breakdown of strict engagement, broader direct-session activity, agent-only activity, burn, model or reasoning attribution, and concurrency, and when the sum of hourly token deltas matches the same category totals shown by the summary mode for the same window and filters.

Milestone 4 is accepted when the summary mode can report idle time inside a user-supplied wake window and when at least one test fixture proves the idle calculations over multiple separated activity blocks. A human should be able to reason about the output and say, “Yes, this lines up with what my day felt like,” including the case where the user was not engaged but agents were still running.

Milestone 5 is accepted only if the macOS telemetry layer makes the CLI better without hiding caveats. If the machine telemetry is noisy, inconsistent, or too environment-specific, the correct outcome is a documented deferral, not a half-working feature.

## Idempotence and Recovery

The parser is read-only with respect to the Codex logs. Rerunning the commands should never mutate the log files or alter the source data. If a run produces surprising numbers, the correct recovery path is to dump the parsed sessions and token points for the requested window, inspect the deltas, and repair the aggregation logic before adding more features.

Project bootstrapping should remain additive. If `bun init -y` creates starter files that are later replaced, keep the replacements explicit and reviewable. Avoid generators that hide file creation. If the CLI wiring becomes messy, it is safe to delete only project-local generated artifacts such as `node_modules` or lockfiles and reinstall from the root of `/path/to/idletime`.

Idle-time v1 must always have a manual fallback. If wake-window parsing breaks or a user omits the wake window, the CLI should still function for summary and hourly views. If machine telemetry is added later and behaves inconsistently, the fallback is to disable that path behind a flag and keep the manual wake-window path as the stable default.

Attribution should also fail softly at the edges. If a log is missing model or effort context for a given turn, the CLI must not invent data. It should group that slice under an explicit `unknown` bucket and still preserve total hours and total tokens correctly.

## Artifacts and Notes

The one-off investigation that motivated this project produced the following March 26 figures from the local logs. These are not eternal truth, but they are strong acceptance targets for the first real summary command:

    Activity window: 2026-03-26 00:06 EDT to 2026-03-26 23:31 EDT
    Active coding estimate: about 12.6 hours at a 15-minute idle cutoff
    Active coding estimate: about 14.1 hours at a 30-minute idle cutoff
    Sessions: 93 total, 58 direct, 35 subagent
    All-session raw total: 1,171,570,923 total tokens
    All-session practical burn: 96,409,707
    Direct-session raw total: 810,670,907 total tokens
    Direct-session practical burn: 62,080,315
    Workspace-only raw total: 985,564,001 total tokens
    Workspace-only practical burn: 77,564,897

The first shareable version of the product should make the following distinctions visible in plain output, because they were all explicitly requested or implied during the grill:

    strict engagement hours
    broader direct-session active hours
    agent coverage hours
    cumulative agent-hours
    peak concurrent agents
    completely idle time inside the wake window
    model breakdown
    reasoning-effort breakdown
    direct versus subagent totals
    raw total tokens versus practical burn

The hourly view must never try to reconstruct these numbers from final session totals alone. It must use token-count event deltas. This note exists because that failure mode is easy to miss when the summary command is implemented first.

The initial default timezone should come from the machine’s local timezone, but the CLI should allow an override later if timezone-sensitive reporting becomes important. The command surface must define clearly that `last24h` is the default trailing-window lens and `today` is the explicit local-midnight-to-now lens.

Observed 2026-03-27 00:23 EDT:

    cd /path/to/idletime
    bun test
    4 pass
    0 fail

Observed 2026-03-27 00:23 EDT:

    cd /path/to/idletime
    bun run idletime last24h
    Window: last24h (03/26, 00:23 -> 03/27, 00:23)
    Sessions: 103 total | 61 direct | 42 subagent
    Direct-session active (15m): 15.4h
    All-session tokens: 1,246,208,994 raw | 98,451,682 practical burn

Observed 2026-03-27 00:23 EDT:

    cd /path/to/idletime
    bun run idletime today --workspace-only /path/to/demo-workspace
    Sessions: 3 total | 3 direct | 0 subagent
    All-session tokens: 46,879,614 raw | 404,862 practical burn

Observed 2026-03-27 00:23 EDT:

    cd /path/to/idletime
    bun run idletime last24h --wake 07:45-23:30
    Wake duration: 15h 45m
    Wake direct activity: 12h 41m
    Awake idle: 3h 04m (19.5%)
    Longest idle gap: 1h 45m

## Interfaces and Dependencies

The project should use Bun and TypeScript as the foundation. Keep dependencies light. The first version can rely on the Bun runtime, the Node-compatible standard library modules that Bun provides, and Bun’s built-in test runner. Add a third-party CLI argument parser only if handwritten parsing becomes noisy enough to distract from the core work.

The source should expose a small, explicit internal interface surface. There should be a session-reading module that returns parsed session records from JSONL files in a requested time window. There should be a token-point module that returns cumulative token samples per session and exposes helpers to compute deltas safely. There should be a user-message extractor that resolves strict engagement candidates. There should be a turn-attribution module that resolves model and effort from `turn_context` and spawn metadata. There should be an activity-block module that merges timestamps using a configurable idle cutoff. There should be a summary module that computes strict engagement, broader direct-session activity, agent-only coverage, raw totals, practical burn, session counts, concurrency, attribution breakdowns, and working-directory filters. There should be a wake-window module for manual idle-time calculations. There should be separate renderers for summary tables and hourly bars so the aggregation code stays testable.

The internal types should be explicit. Define a session-kind type with `direct` and `subagent`. Define a token-usage type with raw counts and practical burn. Define a parsed-session type that includes the session identifier, the working directory, the session kind, the first and last timestamps, the list of all event timestamps, the list of token-count points, any user-message timestamps, and any model or effort attribution known for each turn or session slice. Define a report-query type that includes the time window, the idle cutoff, the timezone, and any working-directory, session-kind, model, or effort filters. Define report-result types separately for summary mode and hourly mode so the renderers are thin and deterministic.

The CLI contract should stay small. It should eventually support a trailing-window summary command, a local-day summary command, an hourly command for bar graphs, and flags for working-directory filtering, direct-versus-subagent filtering, idle cutoff, wake window, and attribution grouping or filtering by model and reasoning effort. Do not add pricing, multi-tool ingestion, or a web dashboard until the core CLI answers are trusted.

The shipped implementation now lives at the following boundaries:

    src/cli/run-idletime.ts
    src/cli/parse-idletime-command.ts
    src/cli/run-last24h-command.ts
    src/cli/run-today-command.ts
    src/cli/run-hourly-command.ts
    src/codex-session-log/*.ts
    src/report-window/*.ts
    src/reporting/*.ts
    test/codex-session-log.test.ts
    test/reporting.test.ts

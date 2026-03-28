---
summary: Rework idletime's live and historical agent views around Codex app-server protocol states instead of made-up product labels. Ship a simple scoreboard with `running` and recent `done`, a dedicated historical agents graph, and a transcript adapter that mirrors app-server lifecycle concepts until a real event-stream integration exists.
read_when: Read this when implementing idletime live mode, the historical agents graph, or any parser work that models subagent lifecycle state.
plan_status: done
---

# Align the live scoreboard and agents graph to the Codex app-server protocol

This is a living execution plan for making `idletime` feel like a control room while staying as close as possible to Codex’s own protocol. It must stay current as implementation progresses so a fresh coding agent can resume from this file and the working tree alone.

This ExecPlan must be maintained in accordance with `docs/codex/PLANS.md`.

## Purpose / Big Picture

`idletime` already reports focus, direct activity, quiet or idle time, burn, and session mix, but the agent-system view is still fuzzy. After this change, a user should be able to run `bun run idletime` and see a dedicated historical agents section that explains concurrency over the day with a time axis that reads like actual time. The same user should also be able to run `bun run idletime live` and leave it on screen like a control-room board with a giant `waiting on you` count, a giant `running` count, per-project `running at` and `waiting at` lists, and a short `top waiting` thread list that answers whether they owe any replies. The product goal is not to invent clever labels. It is to mirror the Codex app-server lifecycle closely enough that the screen is trustworthy and useful.

## Progress

- [x] 2026-03-27 16:09 EDT: Read `../manmeetsai-workspace/docs/prompts/execplan-writer.md` and `docs/codex/PLANS.md` before planning.
- [x] 2026-03-27 16:11 EDT: Inspected the current summary and rhythm renderers in `src/reporting/render-summary-report.ts` and `src/reporting/render-rhythm-section.ts`.
- [x] 2026-03-27 16:12 EDT: Confirmed that `src/reporting/build-hourly-report.ts` already computes `peakConcurrentAgents` per hourly bucket, which makes a historical concurrency graph a low-risk addition.
- [x] 2026-03-27 16:14 EDT: Inspected real local Codex logs under `~/.codex/sessions/2026/03/27` and confirmed they contain more lifecycle signal than the current parser uses, including `task_started`, `task_complete`, `message`, and `agent_message`.
- [x] 2026-03-27 16:45 EDT: Inspected recent real subagent logs across March. The safe local states are `in_progress` and `completed`; there is no trustworthy structured `waiting on you` state in the logs.
- [x] 2026-03-27 16:49 EDT: Pulled the official Codex app-server event docs and item docs. The stable direction is protocol-first: `turn/started`, `turn/completed`, `item/started`, `item/completed`, and item types like `agentMessage`, `commandExecution`, `mcpToolCall`, and `collabToolCall`.
- [x] 2026-03-27 16:52 EDT: Reframed the live plan around protocol-aligned states instead of heuristic labels. The first scoreboard should be `running` and `done`, not `quiet` or `waiting`.
- [x] 2026-03-27 17:40 EDT: Grilled the plan and locked the remaining semantics: task windows are the counted unit, `done recent` uses a `15m` rolling window, `done this turn` is supporting context anchored to the most recent still-warm direct session and latest direct `user_message`, transcript staleness is effort-aware, failed and interrupted tasks are secondary, the historical graph is line-style, and `idletime live` defaults to the current workspace.
- [x] 2026-03-27 17:47 EDT: Locked the historical-graph rollout: ship the first `Agents` graph on the existing session-concurrency buckets, then migrate that graph to task-window concurrency after the transcript adapter lands so the historical and live units eventually match.
- [x] 2026-03-27 23:18 EDT: Extended the transcript parser with protocol-shaped `taskWindows`, effort-aware staleness, and a dedicated adapter module in `src/codex-session-log/task-windows.ts`.
- [x] 2026-03-27 23:27 EDT: Added a dedicated historical `Agents` section, switched the shared 24-hour axis to actual clock labels, and made the hourly report declare its concurrency source explicitly.
- [x] 2026-03-27 23:33 EDT: Added `idletime live` with a TTY repaint loop and a non-TTY one-shot snapshot mode. The board now shows `running`, `done 15m`, recent concurrency, `done this turn`, and `today peak`.
- [x] 2026-03-27 23:47 EDT: Validated the parser, reporting, build, and live snapshot paths with `bun run typecheck`, `bun test`, `bun run build`, and `bun run idletime live`. The default `bun run idletime` and `bun run idletime --share` commands still spend multiple minutes inside the existing global best-metrics refresh before rendering.
- [x] 2026-03-28 09:31 EDT: Re-ran focused validation with `bun run typecheck`, `bun test test/codex-session-log.test.ts test/reporting.test.ts test/cli.test.ts test/best-metrics.test.ts`, `bun run build`, and `bun run idletime live`. All focused checks passed against the current working tree.
- [x] 2026-03-28 09:32 EDT: Re-ran broader validation with `bun run check:release`, `bun run idletime`, and `bun run idletime --share`. The release gate passed, QA shell journeys passed, and both summary commands rendered successfully on the current local archive.
- [x] 2026-03-28 10:06 EDT: Switched `idletime live` to global scope by default, kept `--workspace-only` as the explicit repo filter, and made the header say `scope global` or `scope workspace`.
- [x] 2026-03-28 10:21 EDT: Replaced the live hero metrics with `waiting on you` and `running`, added `running at`, `waiting at`, and `top waiting`, and verified the TTY no longer prints literal escape-sequence junk when arrow-key input is sent during refresh.

## Surprises & Discoveries

The strongest local finding is that inactivity alone is not the right model. Across `259` subagent sessions in March, xhigh windows usually emitted events frequently, but there were giant silence outliers caused by separate task runs in one child session, not by one long healthy think step. One extreme case had a `110` minute gap that resolved to a completed task run followed by a later fresh `task_started`. That means session age is the wrong primitive; task lifecycle is the right primitive.

The transcript logs already contain explicit task lifecycle signals in most child sessions. In the local sample, `task_started` appeared in all inspected subagent sessions and `task_complete` appeared in the large majority. That is enough to build a real `in_progress` / `completed` adapter now.

The current parser is narrower than the real logs. The code in `src/codex-session-log/parse-codex-session.ts` only keeps token points, user-message timestamps, turn attribution, and spawn requests, but the logs also contain `task_started`, `task_complete`, `agent_message`, tool-call boundaries, and richer collaboration events that matter for a live scoreboard.

The official Codex app-server protocol is much cleaner than transcript guessing. The docs define turn lifecycle notifications, item lifecycle notifications, and typed items like `agentMessage`, `commandExecution`, `mcpToolCall`, and `collabToolCall`. That should become the internal model target, with transcript parsing treated as a compatibility adapter rather than the canonical semantics.

The task window, not the subagent session, is the right unit for the scoreboard. The local March data showed that one child session can contain more than one `task_started` / `task_complete` cycle, so counting sessions would drift away from the protocol concept of work in flight.

Older transcript fixtures and older real logs do not always include explicit `task_started` records for subagent work. The shipped implementation therefore keeps a narrow compatibility fallback in the reporting layer: when a subagent session has no explicit task windows, the historical metrics fall back to the legacy session-activity blocks instead of dropping agent coverage to zero.

The new live command is fast because it skips the best-metrics refresh and only reads a recent transcript window. The existing daily summary commands remain much slower on a large local archive because they still refresh best metrics across the full `~/.codex/sessions` history before they render the dashboard.

The earlier multi-minute summary lag was not reproducible during the final validation pass in this working tree. `bun run idletime` and `bun run idletime --share` both completed cleanly on the current archive, so the performance concern is now an archive-size caveat rather than a blocking validation failure.

The transcripts do not expose a clean structured `waiting on you` lifecycle state. They do expose enough direct-session turn boundaries to support a conservative reply-needed heuristic: if the latest direct task completed after the latest `user_message` in that session and no newer direct task started, the session can be treated as waiting on the user for the next turn.

## Decision Log

Decision: Make the Codex app-server protocol the source of truth for lifecycle names and types. Rationale: if `idletime` mirrors Codex’s own state model, it stays useful when the implementation later moves from transcript scraping to direct event streaming. Date: 2026-03-27.

Decision: Treat transcript parsing as an adapter layer, not the canonical model. Rationale: the repo currently reads `.jsonl` transcripts, but the long-term architecture should be able to swap in real app-server events without changing the renderers or state machine. Date: 2026-03-27.

Decision: Use task windows inside child sessions as the counted unit. Rationale: that is the closest match to the app-server lifecycle and to the real transcript behavior. One child session can contain multiple task windows over time, so session counts are too coarse. Date: 2026-03-27.

Decision: Remove `quiet` and `waiting on you` from the mainline scope. Rationale: the local logs do not carry a trustworthy structured state for user wait conditions, and inactivity alone is not good enough. Date: 2026-03-27.

Decision: Keep the human rhythm and the agent graph separate. Rationale: focus, active, quiet or idle, and burn are still useful, but the agent system needs its own graph and should not be buried in the rhythm lanes. Date: 2026-03-27.

Decision: Keep the initial live mode simple: one repaint loop, one scoreboard, one recent concurrency sparkline, and one small facts block. Rationale: the value here is immediacy, not a complex TUI. Date: 2026-03-27.

Decision: Use actual time labels in the daily views. Rationale: the current grouped marker line `14 18 22 02 06 10 14` is compact but confusing, and the control-room direction calls for immediate legibility. Date: 2026-03-27.

Decision: Delay direct app-server integration until the internal types and renderers are protocol-aligned. Rationale: getting the types right first lets the transcript-backed implementation work now without boxing in the future streaming client. Date: 2026-03-27.

Decision: Make `running` and `done recent` the hero scoreboard numbers. Rationale: `running` maps cleanly to task windows in progress, and `done recent` provides the live pulse the user wants. Date: 2026-03-27.

Decision: Keep `done this turn` as supporting context, not a hero metric. Rationale: it is valuable, but the board should stay simple and feel like a scoreboard rather than a diagnostics pane. Date: 2026-03-27.

Decision: Use a `15m` rolling window for `done recent`. Rationale: that is live enough to feel current but stable enough that completions do not vanish instantly. Date: 2026-03-27.

Decision: Anchor `done this turn` to the most recent still-warm direct session and the latest direct `user_message` inside it. Rationale: that is the strongest transcript-backed approximation of the active root turn without inventing global semantics across unrelated work. A direct session stays warm for `15m` after its last meaningful activity. Date: 2026-03-27.

Decision: Use effort-aware staleness thresholds in the transcript adapter. Rationale: the March data supports conservative windows without inventing arbitrary silence semantics. Use `120s` stale for `medium` and `high`, `300s` stale for `xhigh`, and `300s` as the fallback when effort is unknown. Date: 2026-03-27.

Decision: Treat `failed` and `interrupted` as secondary follow-up states, not hero metrics. Rationale: those protocol states should not disappear, but they should not crowd the main scoreboard, and they can wait until the transcript adapter can defend them explicitly. Date: 2026-03-27, updated 2026-03-28.

Decision: Make the historical `Agents` graph a distinct line-style chart rather than another rhythm lane. Rationale: the section needs a clear visual identity if it is supposed to read as the agent system view. Date: 2026-03-27.

Decision: Default `idletime live` to global scope and keep `--workspace-only` as the explicit repo filter. Rationale: the control-room use case is about all current Codex work, not just the current repository, and a scoped board should be an intentional operator choice. Date: 2026-03-28.

Decision: Promote `waiting on you` to the main live hero count and derive it conservatively from direct-session turns. Rationale: the operator’s second-monitor question is not only “what is running” but also “do I owe a reply right now.” The transcript does not expose a clean user-wait state, so the shipped rule is: latest direct task completed after the latest `user_message`, within a warm window, with no newer direct task started. Date: 2026-03-28.

Decision: Add per-project `running at` / `waiting at` lists and a `top waiting` thread block to the live board. Rationale: aggregate counts are not enough for a second-monitor control room. The operator needs both project-level distribution and a short exact list of reply-needed chats. Date: 2026-03-28.

Decision: Ship the first historical `Agents` graph on existing subagent-session concurrency, then migrate it to task-window concurrency in a follow-up once the adapter exists. Rationale: this keeps the daily graph low-risk and fast to ship while still making the eventual protocol-aligned unit explicit in the plan. Date: 2026-03-27.

Decision: Keep a compatibility fallback from explicit task windows to legacy session-activity blocks when a subagent transcript lacks lifecycle records. Rationale: this preserves historical agent coverage for older transcripts and existing fixtures without inventing live task states that the transcript cannot defend. Date: 2026-03-27.

Decision: Make `idletime live` render one snapshot and exit when stdout is not a TTY. Rationale: that keeps automated validation and redirected output usable while preserving the repaint loop for the normal interactive case. Date: 2026-03-27.

## Outcomes & Retrospective

The shipped result matches the original purpose. `idletime` now has an explicit transcript adapter that emits protocol-shaped task windows, the daily and hourly views render a dedicated `Agents` section with actual clock labels, and `idletime live` renders a global-by-default control-room scoreboard with `waiting on you`, `running`, recent concurrency, `running at`, `waiting at`, `top waiting`, `done this turn`, and `today peak`.

The final validation pass was fully green. `bun run check:release` passed, including the QA shell journeys and `npm pack --dry-run`, and the summary and live commands all rendered successfully on the current local archive.

The remaining follow-up is scale, not correctness. The default summary paths still refresh best metrics across the full local Codex archive before rendering, so larger histories may remain noticeably slower than `idletime live`, which intentionally skips that pass.

## Context and Orientation

The entrypoint remains `src/cli/idletime-bin.ts`, which forwards to `src/cli/run-idletime.ts`. The command parser in `src/cli/parse-idletime-command.ts` now supports `last24h`, `today`, `hourly`, and `live`, and the interactive live path lives in `src/cli/run-live-command.ts`.

The current data model is defined in `src/codex-session-log/types.ts`. `ParsedSession` now carries `taskWindows`, which are protocol-shaped spans keyed by `turnId`, `startedAt`, `completedAt`, `lastActivityAt`, and `staleAfterMs`. That task-window layer is the adapter boundary. Historical and live reporting should consume it instead of reading raw transcript records directly.

The parser in `src/codex-session-log/parse-codex-session.ts` still reads every JSONL line into `CodexLogLine` records first, but the lifecycle extraction now lives in `src/codex-session-log/task-windows.ts`. That module is responsible for mapping transcript records onto task windows, applying effort-aware staleness, and exposing helpers that reporting can reuse.

The historical aggregation now computes concurrency through the adapter. `src/reporting/build-hourly-report.ts` declares an `agentConcurrencySource` and uses task-window intervals when a transcript exposes them, with a legacy session-activity fallback for older subagent logs that do not have explicit lifecycle records.

The official Codex app-server protocol, restated in repository terms, provides these useful concepts. A thread has lifecycle notifications such as `thread/status/changed`. A turn has lifecycle notifications such as `turn/started` and `turn/completed`. Items within a turn have lifecycle notifications such as `item/started` and `item/completed`. Common item types include `agentMessage`, `commandExecution`, `mcpToolCall`, `collabToolCall`, and `fileChange`. `idletime` should define internal types that mirror those concepts even if the current implementation has to infer them from transcript files.

This plan uses a few plain-language terms. A `task window` is the span from a child task’s `task_started` signal to its terminal signal or inferred stale boundary. A `running task` is a task window whose latest lifecycle signal corresponds to in-progress work. A `done task` is a task window whose latest lifecycle signal corresponds to a completed task. `done recent` means completed inside the last `15m`. `done this turn` means completed inside the active rooted direct turn. `waiting on you` is the conservative live heuristic for a direct session whose latest task completed after the latest `user_message`, with no newer direct task started inside the warm window. An `agents graph` is a historical line-style chart of concurrent child tasks over time. A `transcript adapter` is code that reads local `.jsonl` logs and maps them onto protocol-shaped internal task types.

## Plan of Work

Start by defining protocol-shaped internal types and then widen the transcript adapter to populate them. The implementation should not begin from UI labels or widget ideas. It should begin from a typed task-lifecycle model that can express pending initialization, in-progress work, completion, interruption, and failure in protocol terms. The transcript adapter can initially populate only the states that the local logs support reliably, which are mainly in-progress and completed. It also needs to split child sessions into task windows instead of treating one child session as one live unit.

Once the internal task model exists, extend the historical path first. The daily summary already has a narrative header and a human rhythm. Add a dedicated `Agents` section between them that renders concurrency from the existing hourly buckets, and replace the grouped raw hour markers with real time labels and simple orientation markers so the axis makes sense immediately. The first shipped graph may use session-concurrency buckets, but the adapter milestone must leave a clear path to switch the graph to task-window concurrency once the new task model exists.

After the historical graph is in place, add `idletime live`. The first live mode should be intentionally small. It should poll recent transcripts, build the protocol-shaped task state from them, clear and redraw the screen, show the logo, show a large `waiting on you` count and a large `running` count, and then show one recent concurrency sparkline plus one small facts area such as `running at`, `waiting at`, `top waiting`, `done this turn`, and `today peak`. Default the board to global scope and keep workspace scoping explicit. Do not overbuild this into a generic TUI framework.

Finally, leave the system open for a future app-server integration. The renderers and command runners should consume the internal protocol-shaped task types rather than directly depending on transcript records. That is the locking move. It makes the current parser a temporary adapter instead of a long-term semantic trap.

## Milestones

### Milestone 1: Define protocol-shaped internal task types and widen the transcript adapter

At the end of this milestone, the repository has a typed internal task-lifecycle model that mirrors Codex app-server concepts, and the current transcript reader can populate that model well enough for `running`, `done recent`, and supporting terminal states. The likely files touched are `src/codex-session-log/types.ts`, `src/codex-session-log/parse-codex-session.ts`, and one or more new extraction helpers such as `src/codex-session-log/extract-task-lifecycle.ts`.

This milestone is successful when a developer can point to a narrow typed representation of task lifecycle and can run tests proving that recent local transcript fixtures map onto those states, including task-window splitting and effort-aware stale detection. Success here is not UI yet; it is a credible adapter.

### Milestone 2: Add a historical `Agents` section and replace the confusing time axis

At the end of this milestone, the normal `idletime` summary view shows a dedicated line-style `Agents` graph above the human rhythm, and the human rhythm’s axis reads like actual time. The first shipped graph can use the existing hourly `peakConcurrentAgents` metric, but the milestone must leave the renderer and report types ready to migrate to task-window concurrency once the adapter exists.

This milestone is successful when a user can run `bun run idletime` or `bun run idletime --share` and immediately see the day’s concurrency shape without mentally decoding the old grouped hour markers, and when the code makes it explicit whether the current graph is session-concurrency or task-window concurrency.

### Milestone 3: Add `idletime live` with a `waiting on you` / `running` scoreboard

At the end of this milestone, the CLI supports `bun run idletime live`. The live screen repaints cleanly in place, shows the logo, shows large `waiting on you` and `running` counts, and shows at least one recent concurrency sparkline plus per-project and per-thread waiting context. The implementation must exit cleanly on `Ctrl+C`.

This milestone is successful when a user can leave `idletime live` on screen and understand, at a glance, how much child work is currently in progress, how much has completed recently, and how much has completed inside the current rooted turn.

### Milestone 4: Harden the adapter boundary so a future app-server client can replace transcript polling

At the end of this milestone, the repo has a clear boundary between lifecycle semantics and transcript parsing. The live and historical renderers consume protocol-shaped task state, not raw transcript records. The transcript adapter remains the current implementation, but the codebase is ready for a future app-server event-stream adapter without rewriting the UI layer.

This milestone is successful when a newcomer to the repo can see where a future `app server` source would plug in and can confirm that the renderers do not depend on transcript-specific hacks.

## Concrete Steps

All commands in this plan assume the working directory is `/Users/parkerrex/Projects/idletime`.

Start by creating the internal lifecycle model and transcript adapter. Update `src/codex-session-log/types.ts` to add protocol-shaped task or item types, and add a focused extraction module that derives those types from the current JSONL records. Keep the mapping conservative: support task windows, `running`, and `done` first, and only add `interrupted` or `failed` if the transcript evidence is explicit. Run:

    bun test

Expect the existing tests to keep passing while new parser tests are added. Do not begin `idletime live` until the adapter has a typed output that can be explained without hand-waving.

Once the adapter exists, add the historical `Agents` graph. The likely edits are in `src/reporting/types.ts`, `src/reporting/build-hourly-report.ts`, `src/reporting/render-summary-report.ts`, and a new renderer such as `src/reporting/render-agent-section.ts`. Then run:

    bun run idletime
    bun run idletime --share

Expect the summary to show a dedicated `Agents` section and a clearer time axis for the human rhythm. The graph should visually show whether concurrency spikes and then levels off, or any other daily shape.

After the historical graph lands, add the live command path. Extend `src/cli/parse-idletime-command.ts` and `src/cli/run-idletime.ts`, then create `src/cli/run-live-command.ts` plus any small helper modules needed for polling, recent-history buffering, and protocol-shaped task-state derivation. Default the scope to global and keep workspace filtering explicit. Validate with:

    bun run idletime live

Expect the screen to redraw every few seconds, show the logo, show large `waiting on you` and `running` counts, and update when task lifecycle changes occur. Confirm that `Ctrl+C` exits cleanly and the terminal remains usable.

Finally, make the adapter boundary explicit and migrate the historical graph input if the adapter is ready. Add a small interface or module boundary that separates `transcript source` from `task-lifecycle consumer`, then run:

    bun test
    bun run idletime
    bun run idletime live

Expect either no user-visible change beyond cleaner internals and stable output, or a migration of the historical `Agents` graph from session-concurrency to task-window concurrency with the same visual shape and clearer semantic alignment.

## Validation and Acceptance

The feature is accepted only when `idletime` can show the agent system clearly in both historical and live modes without inventing semantic states it cannot defend. A user must be able to run the normal summary and immediately understand the day’s concurrency story, and must be able to run `idletime live` and see a large, trustworthy `waiting on you` / `running` scoreboard.

The minimum validation suite is:

    bun run typecheck
    bun test
    bun run build
    bun run idletime
    bun run idletime --share
    bun run idletime live

Acceptance requires observable behavior. The summary view must show a dedicated line-style `Agents` graph. The time axis must read like actual clock time. The live view must repaint in place on a TTY, show `waiting on you` and `running`, include `running at`, `waiting at`, `top waiting`, and a smaller supporting `done this turn` fact, and update when local task lifecycle changes occur. The code must make it clear that transcript parsing is an adapter to protocol-shaped lifecycle state, not the canonical semantics, and it must make it explicit which concurrency unit the historical graph is using at that implementation stage.

## Idempotence and Recovery

All parser work remains read-only against `~/.codex/sessions`. Neither the daily view nor the live view should mutate local Codex state or create hidden runtime caches.

The live repaint loop must be safe to interrupt. If the process exits or receives `Ctrl+C`, it must restore the terminal cleanly. If one poll or redraw fails, the next redraw should recover instead of leaving the session unusable.

The transcript adapter must remain conservative. If a local transcript does not provide enough evidence for a protocol-shaped state, the adapter should omit that stronger state rather than invent it. That keeps the future app-server integration path clean.

## Artifacts and Notes

The target daily summary shape is:

    idletime • last24h
    Mostly in the loop: 14.8h focused, 5.2h agent live
    Biggest story: agents spike in the morning, then hold steady
    77 direct / 85 subagent • 17 peak • 124.6M burn

    Agents
    sun 2pm    6pm    10pm   2am    6am    10am   2pm moon
    conc  ▁▃▅▇█▇▆▅▅▄▃▂

    24h Rhythm
    focus  ...
    active ...
    quiet  ...
    burn   ...

The target live shape is:

    idletime

      6 waiting on you
      9 running

    recent     ▁▂▃▅▇██▇▆▆▅
    running at 5 ~/.agents
               2 project-a
    waiting at 3 project-b
               1 ~/.agents
    top waiting project-b • 14m • 3f92ac
    this turn  8 done
    today peak 17 concurrent

These are target artifacts, not guaranteed strings. Replace them with real transcripts from this repo as milestones complete.

Observed validation artifacts after implementation:

    $ bun run idletime live
    ╭─ idletime live ─────────────────────────────────────────╮
    │ scope global                                           │
    │ observed 03/28, 10:22 • refresh 5s                     │
    │ all sessions                                           │
    ╰────────────────────────────────────────────────────────╯
      waiting on you    running
      recent     ▄▄▄▄▃▄▆▆▆▄▆▅▅▇█
      running at 14 ~/.agents
      waiting at 3 manmeetsai-workspace
      top waiting manmeetsai-workspace • 27m • e0cb12
      this turn  0 done
      today peak 18 concurrent

Focused verification passed:

    $ bun run typecheck
    $ bun test test/codex-session-log.test.ts test/reporting.test.ts test/cli.test.ts test/best-metrics.test.ts
    22 pass
    0 fail

Broader verification passed:

    $ bun run build
    Built dist/idletime.js

    $ bun run check:release
    QA shell journeys passed: 6 scenarios.
    idletime-0.1.3.tgz

    $ bun run idletime
    Agents
      time   9am │1pm │5pm │9pm │1am │5am │9am
      unit  task windows  24m   agent-only

    $ bun run idletime --share
    Snapshot
      agents     13 peak    14.9h cumulative

Archive-scale caveat:

The default summary commands still refresh best metrics across the full `~/.codex/sessions` history before rendering, so larger archives may remain slower than the live board even though the current validation archive completed promptly.

## Interfaces and Dependencies

Extend `src/codex-session-log/types.ts` with protocol-shaped lifecycle types rather than a bag of transcript-specific booleans. The core model should be able to represent task lifecycle in terms close to Codex’s own protocol, even if the transcript adapter only populates a subset of those states today.

Add a transcript adapter module such as `src/codex-session-log/extract-task-lifecycle.ts` or `src/codex-session-log/build-task-state.ts`. The rest of the app should consume its typed output instead of reading raw `CodexLogLine` records directly. The adapter should output task windows, not only sessions, and should carry enough information to compute `done recent`, `done this turn`, and effort-aware staleness.

Keep the historical renderer split cleanly. Add a new renderer such as `src/reporting/render-agent-section.ts` or `src/reporting/render-concurrency-section.ts` for the `Agents` graph instead of inflating `src/reporting/render-rhythm-section.ts` further. The renderer contract should be able to accept either session-concurrency buckets first or task-window-concurrency buckets later without changing the visual API.

Add a live command path with a dedicated module such as `src/cli/run-live-command.ts`. Avoid a third-party TUI dependency in the first pass. A small repaint abstraction and a simple recent-history buffer are enough. The command should default to global scope, with `--workspace-only` as the explicit repo filter.

The time-axis rewrite should be explicit and local to the reporting layer. Do not leave the old grouped `14 18 22 02 06 10 14` style in place once the new `Agents` graph lands.

Add focused tests rather than bloating the entire suite. The likely additions are parser tests for lifecycle extraction, reporting tests for the `Agents` section and time axis, and a live-mode test for redraw-safe scoreboard output.

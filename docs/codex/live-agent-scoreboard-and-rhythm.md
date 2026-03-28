---
summary: Rework idletime's live and historical agent views around Codex app-server protocol states instead of made-up product labels. Ship a simple scoreboard with `running` and recent `done`, a dedicated historical agents graph, and a transcript adapter that mirrors app-server lifecycle concepts until a real event-stream integration exists.
read_when: Read this when implementing idletime live mode, the historical agents graph, or any parser work that models subagent lifecycle state.
plan_status: not_done
---

# Align the live scoreboard and agents graph to the Codex app-server protocol

This is a living execution plan for making `idletime` feel like a control room while staying as close as possible to Codex’s own protocol. It must stay current as implementation progresses so a fresh coding agent can resume from this file and the working tree alone.

This ExecPlan must be maintained in accordance with `docs/codex/PLANS.md`.

## Purpose / Big Picture

`idletime` already reports focus, direct activity, quiet or idle time, burn, and session mix, but the agent-system view is still fuzzy. After this change, a user should be able to run `bun run idletime` and see a dedicated historical agents section that explains concurrency over the day with a time axis that reads like actual time. The same user should also be able to run `bun run idletime live` and leave it on screen like a scoreboard that says how many child task windows are `running` right now and how many have completed recently, with a smaller supporting line for completions inside the current rooted turn. The product goal is not to invent clever labels. It is to mirror the Codex app-server lifecycle closely enough that the screen is trustworthy and useful.

## Progress

- [x] 2026-03-27 16:09 EDT: Read `../manmeetsai-workspace/docs/prompts/execplan-writer.md` and `docs/codex/PLANS.md` before planning.
- [x] 2026-03-27 16:11 EDT: Inspected the current summary and rhythm renderers in `src/reporting/render-summary-report.ts` and `src/reporting/render-rhythm-section.ts`.
- [x] 2026-03-27 16:12 EDT: Confirmed that `src/reporting/build-hourly-report.ts` already computes `peakConcurrentAgents` per hourly bucket, which makes a historical concurrency graph a low-risk addition.
- [x] 2026-03-27 16:14 EDT: Inspected real local Codex logs under `~/.codex/sessions/2026/03/27` and confirmed they contain more lifecycle signal than the current parser uses, including `task_started`, `task_complete`, `message`, and `agent_message`.
- [x] 2026-03-27 16:45 EDT: Inspected recent real subagent logs across March. The safe local states are `in_progress` and `completed`; there is no trustworthy structured `waiting on you` state in the logs.
- [x] 2026-03-27 16:49 EDT: Pulled the official Codex app-server event docs and item docs. The stable direction is protocol-first: `turn/started`, `turn/completed`, `item/started`, `item/completed`, and item types like `agentMessage`, `commandExecution`, `mcpToolCall`, and `collabToolCall`.
- [x] 2026-03-27 16:52 EDT: Reframed the live plan around protocol-aligned states instead of heuristic labels. The first scoreboard should be `running` and `done`, not `quiet` or `waiting`.
- [x] 2026-03-27 17:40 EDT: Grilled the plan and locked the remaining semantics: task windows are the counted unit, `done recent` uses a `15m` rolling window, `done this turn` is supporting context anchored to the most recent still-warm direct session and latest direct `user_message`, transcript staleness is effort-aware, failed and interrupted tasks are secondary, the historical graph is line-style, and `idletime live` defaults to the current workspace.
- [ ] Extend the parser to extract protocol-like task lifecycle and live-state signals from transcript logs.
- [ ] Add a dedicated historical `Agents` section with a concurrency graph and an actual-time axis.
- [ ] Add `idletime live` with a simple repaint loop and a large `running` / `done recent` scoreboard.
- [ ] Design the code so the current transcript parser is only an adapter and a future app-server event-stream client can plug into the same internal types.

## Surprises & Discoveries

The strongest local finding is that inactivity alone is not the right model. Across `259` subagent sessions in March, xhigh windows usually emitted events frequently, but there were giant silence outliers caused by separate task runs in one child session, not by one long healthy think step. One extreme case had a `110` minute gap that resolved to a completed task run followed by a later fresh `task_started`. That means session age is the wrong primitive; task lifecycle is the right primitive.

The transcript logs already contain explicit task lifecycle signals in most child sessions. In the local sample, `task_started` appeared in all inspected subagent sessions and `task_complete` appeared in the large majority. That is enough to build a real `in_progress` / `completed` adapter now.

The current parser is narrower than the real logs. The code in `src/codex-session-log/parse-codex-session.ts` only keeps token points, user-message timestamps, turn attribution, and spawn requests, but the logs also contain `task_started`, `task_complete`, `agent_message`, tool-call boundaries, and richer collaboration events that matter for a live scoreboard.

The official Codex app-server protocol is much cleaner than transcript guessing. The docs define turn lifecycle notifications, item lifecycle notifications, and typed items like `agentMessage`, `commandExecution`, `mcpToolCall`, and `collabToolCall`. That should become the internal model target, with transcript parsing treated as a compatibility adapter rather than the canonical semantics.

The task window, not the subagent session, is the right unit for the scoreboard. The local March data showed that one child session can contain more than one `task_started` / `task_complete` cycle, so counting sessions would drift away from the protocol concept of work in flight.

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

Decision: Surface `failed` and `interrupted` as a small secondary line. Rationale: those protocol states should not disappear, but they should not crowd the main scoreboard either. Date: 2026-03-27.

Decision: Make the historical `Agents` graph a distinct line-style chart rather than another rhythm lane. Rationale: the section needs a clear visual identity if it is supposed to read as the agent system view. Date: 2026-03-27.

Decision: Default `idletime live` to the current workspace scope. Rationale: the board should track the work the user is actively looking at unless they explicitly ask for a global view later. Date: 2026-03-27.

## Outcomes & Retrospective

This section is intentionally future-facing at plan creation time. The target outcome is that `idletime` stops talking about vague agent moods and starts showing protocol-aligned task state. The daily view should show how much concurrent agent work the day had. The live view should act like a lightweight task board: what is running right now, what has finished recently, and how much work has landed inside the current rooted turn.

The main known risk is that the local transcripts are not a one-to-one mirror of the app-server protocol. They contain duplicates, older schema variants, and transcript-specific artifacts. That is acceptable as long as the adapter is explicitly scoped as an adapter and the internal state model remains protocol-first.

## Context and Orientation

The entrypoint remains `src/cli/idletime-bin.ts`, which forwards to `src/cli/run-idletime.ts`. Today the command parser in `src/cli/parse-idletime-command.ts` only knows `last24h`, `today`, and `hourly`. This plan will add a new `live` command and a new command runner such as `src/cli/run-live-command.ts`.

The current data model is defined in `src/codex-session-log/types.ts`. `ParsedSession` is useful but too coarse for live task state. It knows about `forkedFromSessionId`, `eventTimestamps`, token points, user-message timestamps, and spawn requests. It does not yet model task lifecycle, assistant or agent messages, or tool lifecycle events. Those need to be added, but in a way that mirrors the app-server concepts rather than inventing a local ad hoc model.

The current parser in `src/codex-session-log/parse-codex-session.ts` reads every JSONL line into `CodexLogLine` records and then extracts a few slices. The right design change is not to push more one-off arrays into `ParsedSession`. It is to define a narrow internal event or task-signal layer that can be built from transcript records today and from app-server items later.

The current historical aggregation already has the key concurrency metric. `src/reporting/build-hourly-report.ts` computes `peakConcurrentAgents` per hourly bucket. That should feed a new `Agents` section directly instead of remaining hidden inside the detailed hourly table.

The official Codex app-server protocol, restated in repository terms, provides these useful concepts. A thread has lifecycle notifications such as `thread/status/changed`. A turn has lifecycle notifications such as `turn/started` and `turn/completed`. Items within a turn have lifecycle notifications such as `item/started` and `item/completed`. Common item types include `agentMessage`, `commandExecution`, `mcpToolCall`, `collabToolCall`, and `fileChange`. `idletime` should define internal types that mirror those concepts even if the current implementation has to infer them from transcript files.

This plan uses a few plain-language terms. A `task window` is the span from a child task’s `task_started` signal to its terminal signal or inferred stale boundary. A `running task` is a task window whose latest lifecycle signal corresponds to in-progress work. A `done task` is a task window whose latest lifecycle signal corresponds to a completed task. `done recent` means completed inside the last `15m`. `done this turn` means completed inside the active rooted direct turn. An `agents graph` is a historical line-style chart of concurrent child tasks over time. A `transcript adapter` is code that reads local `.jsonl` logs and maps them onto protocol-shaped internal task types.

## Plan of Work

Start by defining protocol-shaped internal types and then widen the transcript adapter to populate them. The implementation should not begin from UI labels or widget ideas. It should begin from a typed task-lifecycle model that can express pending initialization, in-progress work, completion, interruption, and failure in protocol terms. The transcript adapter can initially populate only the states that the local logs support reliably, which are mainly in-progress and completed. It also needs to split child sessions into task windows instead of treating one child session as one live unit.

Once the internal task model exists, extend the historical path first. The daily summary already has a narrative header and a human rhythm. Add a dedicated `Agents` section between them that renders concurrency from the existing hourly buckets, and replace the grouped raw hour markers with real time labels and simple orientation markers so the axis makes sense immediately.

After the historical graph is in place, add `idletime live`. The first live mode should be intentionally small. It should poll recent transcripts, build the protocol-shaped task state from them, clear and redraw the screen, show the logo, show a large `running` count and a large `done recent` count, and then show one recent concurrency sparkline plus one small facts area such as `done this turn`, today peak, and recent `failed` or `interrupted` counts. Scope the default board to the current workspace. Do not overbuild this into a generic TUI framework.

Finally, leave the system open for a future app-server integration. The renderers and command runners should consume the internal protocol-shaped task types rather than directly depending on transcript records. That is the locking move. It makes the current parser a temporary adapter instead of a long-term semantic trap.

## Milestones

### Milestone 1: Define protocol-shaped internal task types and widen the transcript adapter

At the end of this milestone, the repository has a typed internal task-lifecycle model that mirrors Codex app-server concepts, and the current transcript reader can populate that model well enough for `running`, `done recent`, and supporting terminal states. The likely files touched are `src/codex-session-log/types.ts`, `src/codex-session-log/parse-codex-session.ts`, and one or more new extraction helpers such as `src/codex-session-log/extract-task-lifecycle.ts`.

This milestone is successful when a developer can point to a narrow typed representation of task lifecycle and can run tests proving that recent local transcript fixtures map onto those states, including task-window splitting and effort-aware stale detection. Success here is not UI yet; it is a credible adapter.

### Milestone 2: Add a historical `Agents` section and replace the confusing time axis

At the end of this milestone, the normal `idletime` summary view shows a dedicated line-style `Agents` graph above the human rhythm, and the human rhythm’s axis reads like actual time. The new graph should use the existing hourly `peakConcurrentAgents` metric, not invent new aggregation logic inside the renderer.

This milestone is successful when a user can run `bun run idletime` or `bun run idletime --share` and immediately see the day’s concurrency shape without mentally decoding the old grouped hour markers.

### Milestone 3: Add `idletime live` with a `running` / `done` scoreboard

At the end of this milestone, the CLI supports `bun run idletime live`. The live screen repaints cleanly in place, shows the logo, shows large `running` and `done recent` counts, and shows at least one recent concurrency sparkline or equivalent recent-history strip. The implementation must exit cleanly on `Ctrl+C`.

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

After the historical graph lands, add the live command path. Extend `src/cli/parse-idletime-command.ts` and `src/cli/run-idletime.ts`, then create `src/cli/run-live-command.ts` plus any small helper modules needed for polling, recent-history buffering, and protocol-shaped task-state derivation. Default the scope to the current workspace. Validate with:

    bun run idletime live

Expect the screen to redraw every few seconds, show the logo, show large `running` and `done recent` counts, and update when task lifecycle changes occur. Confirm that `Ctrl+C` exits cleanly and the terminal remains usable.

Finally, make the adapter boundary explicit. Add a small interface or module boundary that separates `transcript source` from `task-lifecycle consumer`, then run:

    bun test
    bun run idletime
    bun run idletime live

Expect no user-visible change from this last refactor beyond cleaner internals and stable output.

## Validation and Acceptance

The feature is accepted only when `idletime` can show the agent system clearly in both historical and live modes without inventing semantic states it cannot defend. A user must be able to run the normal summary and immediately understand the day’s concurrency story, and must be able to run `idletime live` and see a large, trustworthy `running` / `done recent` scoreboard.

The minimum validation suite is:

    bun test
    bun run idletime
    bun run idletime --share
    bun run idletime live

Acceptance requires observable behavior. The summary view must show a dedicated line-style `Agents` graph. The time axis must be more legible than the current grouped marker line. The live view must repaint in place, show `running` and `done recent`, include a smaller supporting `done this turn` fact, and update when local child-task lifecycle changes occur. The code must make it clear that transcript parsing is an adapter to protocol-shaped lifecycle state, not the canonical semantics.

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

     30 running
      5 done

    recent     ▁▂▃▅▇██▇▆▆▅
    this turn  8 done
    2 failed • 1 interrupted
    today peak 17 concurrent

These are target artifacts, not guaranteed strings. Replace them with real transcripts from this repo as milestones complete.

## Interfaces and Dependencies

Extend `src/codex-session-log/types.ts` with protocol-shaped lifecycle types rather than a bag of transcript-specific booleans. The core model should be able to represent task lifecycle in terms close to Codex’s own protocol, even if the transcript adapter only populates a subset of those states today.

Add a transcript adapter module such as `src/codex-session-log/extract-task-lifecycle.ts` or `src/codex-session-log/build-task-state.ts`. The rest of the app should consume its typed output instead of reading raw `CodexLogLine` records directly. The adapter should output task windows, not only sessions, and should carry enough information to compute `done recent`, `done this turn`, and effort-aware staleness.

Keep the historical renderer split cleanly. Add a new renderer such as `src/reporting/render-agent-section.ts` or `src/reporting/render-concurrency-section.ts` for the `Agents` graph instead of inflating `src/reporting/render-rhythm-section.ts` further.

Add a live command path with a dedicated module such as `src/cli/run-live-command.ts`. Avoid a third-party TUI dependency in the first pass. A small repaint abstraction and a simple recent-history buffer are enough. The command should default to the current workspace scope and only later grow an explicit global mode if needed.

The time-axis rewrite should be explicit and local to the reporting layer. Do not leave the old grouped `14 18 22 02 06 10 14` style in place once the new `Agents` graph lands.

Add focused tests rather than bloating the entire suite. The likely additions are parser tests for lifecycle extraction, reporting tests for the `Agents` section and time axis, and a live-mode test for redraw-safe scoreboard output.

---
summary: Add a persistent `BEST` plaque inside the idletime header banner that shows the user's top concurrent-agent count, top rolling 24-hour raw burn, and top rolling 24-hour agent-sum record. Back the plaque with a small local ledger so records survive log pruning and can later drive desktop notifications.
read_when: Read this when implementing the header `BEST` plaque, the persistent best-metrics ledger, or the staged record-notification rollout for idletime.
plan_status: done
---

# Add a persistent BEST header plaque and staged record notifications

This is a living execution plan for adding a permanent `BEST` plaque to the idletime header and the local persistence needed to turn those records into future notifications. It must stay current as implementation progresses so a fresh coding agent can resume from this file and the working tree alone.

This ExecPlan must be maintained in accordance with `docs/codex/PLANS.md`.

## Purpose / Big Picture

`idletime` already tells the story of the current window, but it does not yet give the user a permanent, ego-forward reminder of their biggest recorded numbers. After this change, a user should be able to run the normal CLI and immediately see a gold `BEST` plaque carved into the header banner that shows three records: the highest concurrent-agent count ever seen, the highest rolling 24-hour raw token burn ever seen, and the highest rolling 24-hour agent-sum total ever seen. Those records must persist locally even if older Codex logs disappear, and later milestones must let the same record changes trigger local notifications. The feature works when the header shows those values on both wide and narrow terminals, the numbers survive deletion or pruning of old log files, and a new record is captured automatically when the user exceeds a stored best.

## Progress

- [x] 2026-03-27 21:17 EDT: Read `docs/codex/PLANS.md` and the sibling template at `/Users/parkerrex/Projects/manmeetsai-workspace/docs/prompts/execplan-writer.md` before drafting this plan.
- [x] 2026-03-27 21:18 EDT: Inspected the current header renderer in `src/reporting/render-logo-section.ts` and confirmed the header is a fixed five-row wordmark plus a gradient tail, which is the correct home for the plaque.
- [x] 2026-03-27 21:19 EDT: Inspected `src/reporting/render-summary-report.ts`, `src/reporting/build-summary-report.ts`, `src/reporting/build-hourly-report.ts`, and the current reporting tests to locate the compute and render seams.
- [x] 2026-03-27 21:20 EDT: Inspected `src/codex-session-log/read-codex-sessions.ts` and confirmed that the current reader only scans a requested time window, which means all-time records need a bootstrap scan path or an incremental ledger, not just the existing windowed reader.
- [x] 2026-03-27 21:21 EDT: Chose the product shape: no `ATH` language anywhere, no separate records section, and no dates in the plaque itself. The plaque lives inside the header gradient, inset a few columns after the `idletime` wordmark so it still appears on skinny terminals.
- [x] 2026-03-27 21:32 EDT: Added the `src/best-metrics/` feature folder with typed ledger models, rolling 24-hour best calculators, and atomic ledger read and write helpers. Added `test/best-metrics.test.ts` and validated the new core with `bun test test/best-metrics.test.ts` and `bun run typecheck`.
- [x] 2026-03-27 21:36 EDT: Added the all-history scan and `refreshBestMetrics` orchestration for V1, then validated bootstrap and rerun behavior against a temporary synthetic session tree with `bun test test/best-metrics.test.ts` and `bun run typecheck`.
- [x] 2026-03-27 21:42 EDT: Wired the V1 ledger into `today` and `last24h`, added the banner plaque renderer, and proved the end-to-end surface with `bun test`, `bun run qa`, `bun run check:release`, and a real `bun run idletime today` smoke test that created `~/.idletime/bests-v1.json`.
- [x] 2026-03-27 21:47 EDT: Added V2 append-only best-event history, V3 best-effort macOS new-best notifications, and V4 opt-in near-best notifications with a persisted cooldown state file. Validated with focused best-metrics tests and `bun run typecheck`.
- [x] 2026-03-27 21:49 EDT: Re-ran the full release gate after the notification work, then smoke-tested `bun run idletime today` against real local logs and verified the three state files under `~/.idletime/`: `bests-v1.json`, `best-events.ndjson`, and `near-best-notifications-v1.json`.
- [x] 2026-03-27 22:00 EDT: Switched macOS notification delivery to prefer `terminal-notifier` with a bundled cube icon asset and re-ran `bun run check:release` to confirm the PNG ships in the package.
- [x] Add a dedicated `src/best-metrics/` feature folder with types, ledger read and write helpers, all-history scan logic, and rolling-window best calculators.
- [x] Extend the summary render path so normal runs load best metrics and pass a compact header plaque model into `src/reporting/render-logo-section.ts`.
- [x] Ship the persistent header plaque as V1 with responsive compression rules and tests that prove it renders on both wide and narrow widths.
- [x] Add append-only best-event history as V2 so later notification logic has a durable audit trail.
- [x] Add V3 desktop notifications for new best events, with graceful no-op behavior when local notification delivery is unavailable.
- [x] Add V4 “close to best” notifications with conservative thresholds and hard rate limits so the feature stays motivating instead of noisy.

## Surprises & Discoveries

The current logo band is narrower and more opinionated than a first glance suggests. `src/reporting/render-logo-section.ts` paints exactly five rows of a fixed wordmark and then fills the remaining row width with a color tail. That means the `BEST` plaque must fit inside those same five rows. It cannot rely on extra vertical space, a second band, or a right-aligned callout without becoming fragile on narrow terminals.

The current session reader is intentionally windowed. `src/codex-session-log/read-codex-sessions.ts` only lists candidate directories between a requested start and end, with a one-day lookback for overlap. That is perfect for current-window reports, but it does not provide an “all available history” API. A record system that claims to be all-time therefore needs its own recursive history scan instead of treating the current report window as the only source of truth.

The summary pipeline already exposes the three values this feature needs, but not at the same scope. `buildSummaryReport` can already compute raw totals and agent cumulative time for one window, and `buildHourlyReport` already computes peak concurrent agents per bucket. The missing piece is not raw math. The missing piece is a reusable feature that computes rolling 24-hour winners across historical logs and persists the current maxima.

The rolling 24-hour agent-sum metric can be computed exactly without coarse hourly buckets. A slope-change sweep over activity intervals produces the exact maximum cumulative subagent overlap for a fixed 24-hour window, which is both cheaper and more defensible than approximating the record from hourly aggregates.

Real local history contained malformed legacy `.jsonl` files outside the current reporting window. The first all-history smoke test failed when the new reader tried to parse one of those old files, which means V1 cannot assume every historical log is parseable forever. The full-history reader now skips unreadable files so the normal CLI keeps working even when ancient legacy logs have drifted.

Non-TTY runs often produce a narrower header than a real 80-column interactive terminal, even when the `COLUMNS` environment variable is set. The compact plaque variant therefore matters in real automation and QA flows, not just as a theoretical fallback.

The local machine already had `/opt/homebrew/bin/terminal-notifier` installed, and its built-in help confirmed support for `-appIcon URL`. That made custom notification art viable without introducing a new npm dependency or a custom macOS app bundle.

## Decision Log

Decision: Put the record surface inside the existing header banner instead of adding a new section below the panel header. Rationale: the user wants the record to feel like a permanent carved plaque, not a report subsection, and the current five-row header band already provides the right visual affordance. Date: 2026-03-27.

Decision: Use the label `BEST` and never use `ATH`. Rationale: the intended tone is blunt and ego-forward, and `ATH` reads like finance or leaderboard jargon rather than a product-native headline. Date: 2026-03-27.

Decision: Store durable record state under `~/.idletime/` in a small local ledger, while continuing to treat `~/.codex/sessions/` as the source material for computing new candidates. Rationale: old session logs may be pruned or deleted, but the user still expects “all-time” records not to regress. Date: 2026-03-27.

Decision: Use a full recursive history scan on each normal run for V1 instead of a partial incremental refresh. Rationale: the session files are organized by start-day directories, which means a correct incremental reader would need extra cached state to avoid missing long-lived sessions that began outside the overlap window. A full scan is simpler, safer, and acceptable until real performance data says otherwise. Date: 2026-03-27.

Decision: Treat `best 24hr raw burn` and `best agent sum` as rolling 24-hour records, not local-calendar-day records. Rationale: the desired plaque copy explicitly says `24hr raw burn`, and the same continuity is appropriate for cumulative subagent work in the same motivational surface. Date: 2026-03-27.

Decision: Persist the exact metric values in precise internal units and allow the renderer to compress them for the plaque. Rationale: the stored truth for token totals is an integer token count and the stored truth for agent sum is milliseconds, even if the plaque chooses a shorter string such as `17 agent sum`. Date: 2026-03-27.

Decision: Ship notifications only after the durable best-event log exists. Rationale: notification delivery without an append-only event record makes dedupe, troubleshooting, and future rate limiting brittle. Date: 2026-03-27.

Decision: Make V3 notification delivery macOS-first through local system scripting, with a graceful no-op elsewhere. Rationale: this repository is being operated on macOS today, the feature request came from that environment, and a best-effort local implementation is more pragmatic than introducing a cross-platform dependency before the value is proven. Date: 2026-03-27.

Decision: Keep V4 “close to best” notifications conservative and opt-in by state rather than on by default at the first implementation. Rationale: “new best” notifications are easy to justify, while proximity nudges can quickly become spam without thresholds and cooldowns. Date: 2026-03-27.

Decision: Anchor the best-metrics feature to the CLI's default 15-minute idle cutoff instead of the current command flags. Rationale: personal bests need a stable definition across runs, so the record ledger should not drift because a user happened to run one report with a custom cutoff or workspace filter. Date: 2026-03-27.

Decision: Skip unreadable historical session files during the V1 all-history scan instead of failing the whole CLI. Rationale: the real machine already contains malformed legacy Codex logs that are irrelevant to the current report but would otherwise break every normal run. V1 needs the report to stay usable while still consuming as much good history as possible. Date: 2026-03-27.

Decision: Do not backfill bootstrap records into `best-events.ndjson` and do not fire notifications on the initial ledger creation. Rationale: the first run should establish baseline state quietly; only later improvements should count as actual “new best” events. Date: 2026-03-27.

Decision: Make near-best nudges opt-in through a persisted local state file with `nearBestEnabled: false` by default, `thresholdRatio: 0.97`, and `cooldownMs: 86400000`. Rationale: proximity nudges are more likely to feel spammy than new-best notifications, so they should require explicit activation and a strong threshold. Date: 2026-03-27.

Decision: Prefer `terminal-notifier` over AppleScript for macOS notification delivery when the binary is available, and fall back to `osascript` otherwise. Rationale: AppleScript cannot attach a custom icon, while `terminal-notifier` can display a bundled app icon through `-appIcon`. Date: 2026-03-27.

## Outcomes & Retrospective

All four milestones are complete. `idletime today` and the default `last24h` report now refresh a durable best-metrics ledger, render the `BEST` plaque in the banner, append deduped best events, fire best-effort macOS notifications for genuine new records, and create an opt-in near-best notification state file. The implementation survived both the full release gate and a real local smoke test against the machine’s existing Codex logs.

The outcome matches the original purpose well. The first screen now carries emotional weight without adding a new panel, the durable ledger keeps records from regressing when old logs disappear, and the notification logic is explicit enough to be trusted. The main lesson is that correctness and resilience mattered more than clever incremental scanning. The all-history scan plus durable local state was the simpler and safer path for V1 through V4.

The main implementation risk at plan creation time is state correctness. The project currently has no durable app state, so this work introduces the first local ledger and the first background-ish refresh behavior. If the scan cursor or rolling-window overlap logic is wrong, the tool could miss a legitimate record or fail to preserve one. The plan therefore treats the ledger and event log as first-class implementation tasks with their own validation, rather than an incidental helper hidden inside the renderer.

The other risk is semantic ambiguity around `agent sum`. The user wants the short label, but the product still needs a precise meaning. This plan resolves that ambiguity by defining it as rolling 24-hour cumulative subagent time, stored in milliseconds and rendered compactly in the plaque.

## Context and Orientation

The current CLI entrypoints live under `src/cli/`. `src/cli/run-last24h-command.ts` and `src/cli/run-today-command.ts` read Codex sessions, build reports, and call `src/reporting/render-summary-report.ts`. That summary renderer builds the logo section through `src/reporting/render-logo-section.ts`, which paints the five-line `idletime` wordmark and the yellow-green gradient tail. The `BEST` plaque belongs in that renderer because it is the only place that knows both the wordmark width and the available tail width.

Session data currently comes from `src/codex-session-log/read-codex-sessions.ts`, which reads `.jsonl` files from `~/.codex/sessions/YYYY/MM/DD/`. The reader requires a start and end time and only scans candidate day directories inside that range. That is a good fit for normal `last24h` and `today` reporting, but it is not enough by itself for all-time records. This plan therefore introduces a new feature-local reader strategy for the best-metrics ledger. V1 should recursively traverse all session-day directories under `~/.codex/sessions/` on each normal run and compute bests from the resulting parsed sessions. If that ever becomes too slow on real history, the optimization follow-up can add a more complex incremental cache with real evidence.

The current report builders already compute the raw material needed for the plaque. `src/reporting/build-summary-report.ts` can compute raw token totals and cumulative agent time inside a given report window. `src/reporting/build-hourly-report.ts` can compute `peakConcurrentAgents` per bucket. The new best-metrics feature should reuse the same token-delta and activity logic wherever possible rather than inventing separate definitions. In plain language, a rolling 24-hour record means “take every possible 24-hour span covered by the available logs, compute the target metric for that span, and keep the largest result.”

This plan uses a few terms of art, so define them concretely here. A “ledger” is the local JSON state file stored under `~/.idletime/` that keeps the current best values and the last scan timestamp. An “event log” is an append-only NDJSON file under the same directory that records each time a best value is improved. An “all-history scan” is the recursive pass that walks the whole sessions tree to compute current bests. A “plaque model” is the small typed object passed into the logo renderer containing already-formatted best strings and enough metadata to decide whether the wide or narrow layout should be used.

## Plan of Work

Start by introducing a new `src/best-metrics/` feature folder so the record logic stays separate from the rendering code. The folder should contain types, the local ledger schema, a reader and writer for `~/.idletime/bests-v1.json`, and a calculator that can take parsed sessions and produce candidate bests for peak concurrent agents, rolling 24-hour raw burn, and rolling 24-hour cumulative agent time. The calculator should depend on the existing session parser and reporting helpers where possible, but it must not live inside `src/reporting/` because its responsibility is durable record management, not one-off report assembly.

Once the best-metrics feature exists, extend the CLI summary path so normal `last24h` and `today` runs refresh best state before rendering. The refresh flow should first attempt to load the ledger. If the ledger is missing, it should run the all-history scan, compute the initial bests, and persist them. If the ledger exists, it should run the same all-history scan again, compare the new candidates against the stored bests, and update the stored values only when a candidate exceeds the previous value. This work belongs close to `src/cli/run-last24h-command.ts` and `src/cli/run-today-command.ts`, but the scan and merge algorithm itself should stay in `src/best-metrics/`.

After the ledger can be read and refreshed, wire the plaque into the header. `src/reporting/render-summary-report.ts` should request a plaque model and pass it into `src/reporting/render-logo-section.ts`. The logo renderer should then place the plaque a few columns into the gradient tail after the wordmark. The left inset must be fixed enough to survive narrow terminals and must never rely on right alignment. The renderer needs at least two layouts: a normal four-line stack and a compressed narrow layout. The values should stay gold and visually carved into the existing palette, but they should be shorter than the rest of the report so the header does not dominate the panel.

After V1 is working, add V2 append-only event history. The writer should append a record only when a metric improves. The append log belongs in `~/.idletime/best-events.ndjson`, and each event should include the metric key, the new value, the previous value, the observation time, the rolling window bounds that produced the new value, and the ledger schema version. This step matters because V3 and V4 both need reliable dedupe and future debugging evidence.

Only after the ledger and event log are solid should the work add notifications. V3 should deliver a local notification when a new best event is appended. Keep the notifier best-effort and isolated behind a small adapter. On macOS, a minimal implementation can use `osascript` to call Notification Center. On other environments or when the system call fails, the CLI should continue normally and simply skip delivery. V4 should add proximity notifications such as “3% away from your best 24hr raw burn,” but only after the event log and state file can enforce thresholds, cooldowns, and one-notification-per-metric-per-window dedupe.

## Milestones

### Milestone 1: Ship V1 persistent best metrics and the header plaque

At the end of this milestone, normal `idletime` runs refresh a durable best-metrics ledger and render a gold `BEST` plaque inside the header banner. The user-visible effect is immediate: `bun run idletime` and `bun run idletime today` both show the plaque without any additional flag. The touched code should include the new `src/best-metrics/` feature folder, the summary command runners, `src/reporting/render-summary-report.ts`, `src/reporting/render-logo-section.ts`, and new tests that prove both ledger behavior and responsive header rendering.

This milestone is successful when a newcomer can delete `~/.idletime/bests-v1.json`, rerun the CLI, watch the ledger bootstrap from historical logs, and then see the plaque appear in the header with three stable values. It is also successful when later runs preserve the bests even if older Codex logs are no longer present.

### Milestone 2: Ship V2 append-only best-event history

At the end of this milestone, every new record improvement appends one line to `~/.idletime/best-events.ndjson`. The event file must be easy to inspect manually and must never rewrite older events. The user does not yet need a new CLI surface for this milestone; the visible proof can be the file contents plus tests and logs showing that one appended event corresponds to one genuine best improvement.

This milestone is successful when a newcomer can create a synthetic “new best” scenario in tests or fixtures, run the CLI twice, and observe exactly one appended event for the improvement and zero duplicate events on the second run.

### Milestone 3: Ship V3 new-best notifications

At the end of this milestone, idletime can deliver a local notification whenever a best-event append occurs. The first version should remain macOS-first and best-effort. The CLI must not crash if notification delivery is unavailable or denied by the operating system. The important behavior is that the user gets a celebratory nudge when they truly set a new record, without any extra configuration beyond the local machine’s existing notification permissions.

This milestone is successful when a newcomer can trigger a synthetic new-best event, run the CLI on macOS, and observe a local notification such as “New best 24hr raw burn” while the terminal output still renders normally. It is also successful when the same command on a non-macOS or restricted environment skips the notification without failing.

### Milestone 4: Ship V4 close-to-best nudges with strict dedupe

At the end of this milestone, idletime can optionally deliver a “close to best” notification when the user is within a chosen threshold of one of the three best metrics. The threshold should be conservative enough to feel rare, such as within 3% to 5% of the stored best, and the rate limiting should ensure that the user is not pinged repeatedly for the same metric during the same pursuit window.

This milestone is successful when a newcomer can configure or seed state so that the current rolling 24-hour totals sit just below a stored best, run the CLI, and observe at most one nudge notification for that metric within the configured cooldown. It is not successful if repeated runs spam the same message or if the nudge fires when the user is not genuinely close.

## Concrete Steps

All commands in this plan assume the working directory is `/Users/parkerrex/Projects/idletime`.

Start by creating the new feature folder and the ledger types before touching the renderer. The implementer should inspect the current session reader and report builders again, then add the best-metrics modules:

    cd /Users/parkerrex/Projects/idletime
    rg -n "buildSummaryReport|buildHourlyReport|buildLogoSection|readCodexSessions" src test

Expect to confirm that `buildSummaryReport` and `buildHourlyReport` are the existing compute seams and that `buildLogoSection` is the only header renderer.

Then add the ledger and best-calculation modules, plus a bootstrap scan path. During implementation, the working folder should become something like:

    src/best-metrics/
      build-best-metrics.ts
      build-rolling-24h-windows.ts
      read-best-ledger.ts
      write-best-ledger.ts
      append-best-event.ts
      types.ts

After the modules exist, wire the refresh into the normal CLI runs and render the plaque:

    cd /Users/parkerrex/Projects/idletime
    bun run idletime
    bun run idletime today

Expect the header to show something close to this shape in the gradient tail:

    BEST
    98 concurrent agents
    1.8B 24hr raw burn
    17 agent sum

The exact numbers will differ, but the placement must be a few columns after the wordmark, not right-aligned against the edge.

When V2 lands, verify the append-only event log behavior directly:

    cd /Users/parkerrex/Projects/idletime
    tail -n 5 ~/.idletime/best-events.ndjson

Expect each line to be one compact JSON object and expect a new line only when one of the stored bests truly increased.

When V3 lands, validate notification delivery on macOS and graceful fallback elsewhere:

    cd /Users/parkerrex/Projects/idletime
    bun run idletime

Expect the normal report to render. On a macOS machine with notifications available, expect one local notification only if a new best was recorded during that run. If the machine cannot deliver notifications, expect no crash and no broken output.

Before considering any milestone complete, run the project’s release gate:

    cd /Users/parkerrex/Projects/idletime
    bun run typecheck
    bun test
    bun run qa
    bun run check:release

Expect `bun run check:release` to finish without errors. If `bun run qa` or the release gate fails, stop and fix the issue before moving on.

## Validation and Acceptance

Validation is complete only when the feature is proven both behaviorally and mechanically. For V1, the user must be able to run the normal CLI and see the `BEST` plaque in the header on a real terminal. The plaque must survive narrow widths through compression rather than disappearing immediately, and it must still be readable in share mode and monochrome mode. Tests must prove that the ledger bootstraps, persists bests, and updates only when a candidate metric exceeds the stored one.

For the record logic itself, acceptance requires a reproducible scenario in tests. A synthetic history should prove that the system picks the highest peak concurrent-agent value, the highest rolling 24-hour raw total, and the highest rolling 24-hour cumulative subagent total. A second synthetic run that does not beat those values must leave the ledger unchanged and must not append a new event.

For V2, acceptance requires an append-only history file with no duplicate entries for the same unchanged state. For V3, acceptance requires that a new best causes one notification attempt and that missing notification support does not break the CLI. For V4, acceptance requires that “close to best” nudges respect thresholds and cooldowns. The final end-to-end proof remains:

    cd /Users/parkerrex/Projects/idletime
    bun run check:release
    bun run idletime
    bun run idletime today

Success means the release gate is green, the normal report renders with the plaque, and any newly created bests are persisted locally with deduped history.

## Idempotence and Recovery

The ledger writes must be safe to rerun. If `~/.idletime/bests-v1.json` does not exist, the CLI should create it. If it exists and is valid, rerunning the CLI should refresh it only when new bests are found. If the file exists but is corrupted, the CLI should fail with a clear error message that points to the bad file and explains that the user can remove it to trigger a clean bootstrap. The implementation must not silently overwrite malformed state without warning because that would destroy the only durable record history.

The append-only event log must tolerate repeated runs. If no metric improved, the writer must do nothing. If a metric improved, the writer should append exactly one line. If a run crashes after the ledger update but before the notification fires, rerunning should not append a duplicate event. This is why V2 and later must derive notification delivery from the event append result or a dedupe marker rather than “current value is greater than some threshold” alone.

The bootstrap scan must also be safe to retry. If a first run is interrupted halfway through bootstrap, the next run can either restart the bootstrap cleanly or resume from a recorded scan cursor, but the resulting ledger must still converge to the same best values. The implementation should keep the ledger write atomic by writing to a temporary file and renaming it into place, so a partial write does not leave a truncated JSON file behind.

Notification delivery must be optional and non-blocking. If the operating system rejects the notification call or the user’s machine lacks the necessary capability, the CLI should finish the normal report and log or swallow the notification failure according to the repository’s existing style. Recovery in that case is simply “run again after fixing local notification permissions,” not “repair product data.”

## Artifacts and Notes

The initial ledger file should look roughly like this. The exact property order can differ, but the meaning must stay the same:

    {
      "version": 1,
      "initializedAt": "2026-03-27T21:30:00.000Z",
      "lastScannedAt": "2026-03-27T21:30:00.000Z",
      "bestConcurrentAgents": {
        "value": 98,
        "observedAt": "2026-03-26T18:42:00.000Z",
        "windowStart": "2026-03-26T18:00:00.000Z",
        "windowEnd": "2026-03-26T19:00:00.000Z"
      },
      "best24hRawBurn": {
        "value": 1800000000,
        "observedAt": "2026-03-27T17:00:00.000Z",
        "windowStart": "2026-03-26T17:00:00.000Z",
        "windowEnd": "2026-03-27T17:00:00.000Z"
      },
      "best24hAgentSumMs": {
        "value": 61200000,
        "observedAt": "2026-03-27T17:00:00.000Z",
        "windowStart": "2026-03-26T17:00:00.000Z",
        "windowEnd": "2026-03-27T17:00:00.000Z"
      }
    }

The event log is NDJSON so it stays append-friendly and easy to inspect:

    {"metric":"best24hRawBurn","previousValue":1765000000,"value":1800000000,"observedAt":"2026-03-27T17:00:00.000Z","windowStart":"2026-03-26T17:00:00.000Z","windowEnd":"2026-03-27T17:00:00.000Z","version":1}

The intended wide plaque shape is:

    BEST
    98 concurrent agents
    1.8B 24hr raw burn
    17 agent sum

The intended narrow fallback shape is:

    BEST 98 concurrent
    1.8B raw burn • 17 sum

Those snippets are examples only, but they establish the required tone and placement. The plaque is short, gold, and left-inset inside the banner tail.

The real local smoke test produced a compact narrow variant because the non-TTY panel width was tighter than an 80-column interactive terminal. A representative excerpt was:

    ░▒▒BEST███▓▓▓▓▓▓
    ▒▓█17 concurrent
    ▓▓▓2.3B raw burn
    ▒▒▓35 agent sum█

That is acceptable for V1 because the plaque still appears in the banner, uses the correct hierarchy, and compresses instead of disappearing on tighter widths.

The near-best opt-in state created by the real smoke test looked like this:

    {
      "version": 1,
      "nearBestEnabled": false,
      "thresholdRatio": 0.97,
      "cooldownMs": 86400000,
      "lastNotifiedAt": {
        "bestConcurrentAgents": null,
        "best24hRawBurn": null,
        "best24hAgentSumMs": null
      }
    }

## Interfaces and Dependencies

The implementation must introduce a dedicated feature folder at `src/best-metrics/` rather than spreading the new state logic across generic helpers. At minimum, that folder needs a typed ledger model, a typed event model, a reader for `~/.idletime/bests-v1.json`, a writer that performs atomic updates, a recursive history reader, and a calculator that can produce candidate best metrics from parsed session history. The folder should expose one orchestration function such as `refreshBestMetrics` that the CLI runners can call without needing to know the scan and dedupe details.

The renderer should not compute bests itself. `src/reporting/render-logo-section.ts` should only receive a small `BestPlaque` model or `null`. That model should already contain display strings for the chosen layout or enough raw fields to derive them locally without reading disk. The important boundary is that storage and history logic live in `src/best-metrics/`, while presentation logic stays in `src/reporting/`.

The ledger schema must be versioned from day one. Use an explicit `version: 1` field in the JSON file and the event log entries. The metric records should carry the exact stored units and provenance bounds. The recommended type shape is one record per metric with `value`, `observedAt`, `windowStart`, and `windowEnd`. If a future milestone needs more provenance, add fields in a backward-compatible way instead of replacing the structure ad hoc.

The refresh API now supports both first-run bootstrap and normal reruns through `refreshBestMetrics` in `src/best-metrics/refresh-best-metrics.ts`. That function loads existing state, runs the all-history scan, computes candidate bests, computes the current “right now” pursuit metrics, updates the ledger, appends any new best events, and returns the current ledger plus `newBestEvents` and `currentMetrics`. That single function is the dependency used by `src/cli/run-last24h-command.ts` and `src/cli/run-today-command.ts`.

Notification delivery now lives behind `src/best-metrics/notification-delivery.ts`, which exposes a generic local notification adapter. `src/best-metrics/notify-best-events.ts` formats and delivers new-best notifications, while `src/best-metrics/near-best-notifications.ts` manages the opt-in state file, cooldowns, threshold checks, and formatted near-best nudges. The CLI runners do not embed platform scripting directly.

The bundled icon assets now live at `assets/idle-time-notification-icon.svg` and `assets/idle-time-notification-icon.png`. The notification adapter resolves the PNG at runtime and passes it to `terminal-notifier` through `-appIcon` when possible, then falls back to AppleScript if `terminal-notifier` is unavailable.

# Add Codex Limit Visibility To The Summary Dashboard

This document is a living execution plan for adding Codex quota visibility to `idletime`, and it must stay current as implementation progresses, discoveries appear, and decisions change.

This ExecPlan must be maintained in accordance with [docs/codex/PLANS.md](/Users/parkerrex/Projects/idletime/docs/codex/PLANS.md).

## Purpose / Big Picture

`idletime` already tells the user how many tokens they burned, when they were focused, and when agents were running. It still cannot answer the more urgent operational question: "How close am I to running out of Codex, and how fast am I chewing through it?" After this change, `idletime today` and the default trailing dashboard should show the current remaining 5-hour and weekly Codex quota, plus short-horizon pace signals that explain depletion speed. A successful implementation makes the dashboard answer six things in one glance: 5-hour remaining, weekly remaining, today burn tokens, last-hour burn tokens, estimated weekly quota burned today in percentage points, and estimated 5-hour quota burned in the last hour in percentage points.

The user-visible outcome is not just "more numbers in the UI." The point is to make `idletime` actionable for pacing. A user should be able to run `bun run idletime` and decide whether they can keep pushing on GPT-5.4 work or whether they need to slow down before the 5-hour or weekly quota runs out.

## Progress

- [x] 2026-03-31 11:00 EDT: inspected the local `idletime` reporting pipeline, read `docs/codex/PLANS.md`, reviewed `steipete/CodexBar` provider docs, and verified that the local `codex app-server` protocol exposes `account/rateLimits/read` with real 300-minute and 10080-minute windows.
- [x] 2026-03-31 11:01 EDT: wrote this ExecPlan and fixed the V1 scope on exact remaining quota plus explicitly labeled burn estimates.
- [x] 2026-03-31 11:05 EDT: extended the V1 scope so the dashboard shows exact local burn numbers for today and the last hour alongside the quota-relative estimates.
- [x] 2026-03-31 11:42 EDT: grilled the plan against the repo’s JSON contract, share-mode surface, QA harness, and read-only dashboard rules; resolved the must-have plan gaps in place.
- [x] 2026-03-31 11:45 EDT: completed a final architecture pass and resolved the last high-risk ambiguity: quota remaining is account-global, while pace is local-log-derived and must be labeled accordingly when filters are active.
- [x] 2026-03-31 14:17 EDT: reproduced the broken `Limits` section in `bun run idletime today`, confirmed that the live quota reader returned no rate-limit windows, and narrowed the failure to the `src/codex-limits/read-codex-rate-limits.ts` transport boundary rather than the renderer.
- [x] 2026-03-31 14:21 EDT: completed the `src/codex-limits/` feature folder, threaded `CodexLimitReport` through `today`/`last24h`, share mode, and JSON, and verified that `bun run idletime today` now renders live 5-hour and weekly quota rows from the real Codex account.
- [x] 2026-03-31 14:22 EDT: finished the targeted quota tests, including the spawned-binary handshake coverage and the environment-override fix that keeps `CODEX_BINARY` and fixture-driven probes working without dropping `PATH`.
- [x] 2026-03-31 14:23 EDT: ran `bun test`, `bun run typecheck`, `bun run qa`, and `bun run check:release`; all commands exited zero.

## Surprises & Discoveries

The most important discovery is that a supported Codex source already exists locally. On March 31, 2026, the command below returned a live response from the installed `codex` CLI app-server:

    {"id":2,"result":{"rateLimits":{"limitId":"codex","primary":{"usedPercent":63,"windowDurationMins":300,"resetsAt":1774978303},"secondary":{"usedPercent":26,"windowDurationMins":10080,"resetsAt":1775503599},"credits":{"hasCredits":false,"unlimited":false,"balance":"0"},"planType":"pro"},"rateLimitsByLimitId":{"codex":{...}}}}

This matters because the feature does not need to scrape arbitrary terminal text first. The local app-server already exposes the exact data shape needed for "remaining quota now."

The second discovery is that `idletime` cannot compute quota burn percentages from token logs alone in an exact way. The session logs tell us token deltas, not "quota percent points." To compute same-run burn without a historical quota snapshot ledger, the implementation must calibrate local token burn against the current quota window percent. That makes the burn metrics estimates, not exact audited percentages.

The complementary discovery is that absolute burn numbers are already exact. The repo already computes practical burn from per-event token deltas, so "today burn" and "last-hour burn" should be shown as concrete token totals, while only the quota-relative percentage-point values should carry the `est.` label.

The third discovery is a product constraint in this repository: the README explicitly says the dashboard and snapshot commands are read-only, with `refresh-bests` as the maintenance exception. This plan keeps that contract for V1 and avoids writing a quota history ledger during normal dashboard runs.

The fourth discovery is a testability constraint. The packaged-binary QA harness in `qa/run-shell-journeys.ts` installs the tarball into an isolated temp `HOME` and should not depend on a real logged-in Codex account. That means the feature needs a deterministic test-only injection seam for quota snapshots, most likely an environment-variable override or fixture path that bypasses the live `codex` probe in QA and unit tests.

The fifth discovery is a scope constraint. The Codex rate-limit snapshot is account-wide, but the local session-log burn data only reflects the machine and session files that `idletime` can read. If the same Codex account is also burning quota on another machine or through another surface, the remaining percentage is still correct but the local pace estimate can understate the real account-wide depletion speed. The UI and plan must call the pace values estimates and treat them as local-log-derived context, not authoritative account telemetry.

The sixth discovery is a filtering constraint. Existing `idletime` commands support filters such as `--workspace-only`, `--model`, and `--effort`, but Codex quota itself is global to the signed-in account. The plan therefore needs one explicit rule about whether the new limits section respects filters or intentionally ignores them.

The seventh discovery is a performance constraint. Tying the supporting burn totals to the active OpenAI quota windows requires reading as far back as the current weekly window start. The plan therefore needs an explicit rule to perform one widened session read only when quota data is available and then reuse that widened session set for the normal summary and hourly builders instead of scanning twice.

The eighth discovery comes from the CodexBar reference. CodexBar uses multiple sources for Codex usage and treats `/status` parsing as a fallback path, not the primary source. Relevant upstream documentation:

- https://github.com/steipete/CodexBar/blob/main/README.md
- https://github.com/steipete/CodexBar/blob/main/docs/codex.md

Those docs restate the repository-specific lesson we should carry over here: use structured Codex rate-limit data first, and reserve text scraping for recovery paths.

The ninth discovery came from the live reproduction of the bug on March 31, 2026. The real `codex app-server` handshake proved to be sequential rather than "write the whole batch and immediately close stdin." The broken implementation rendered `unavailable missing quota data` because the quota reader never received the `id:2` `account/rateLimits/read` response before the subprocess path failed, and the `/status` fallback also failed in a non-TTY subprocess with `stdin is not a terminal`.

The tenth discovery came from the spawned-binary regression test. Treating the optional `env` input as a full replacement for `process.env` dropped `PATH`, which caused override binaries using `#!/usr/bin/env bun` to exit with code `127`. The quota reader needs additive environment overrides, not replacement semantics.

## Decision Log

Decision: use `codex app-server` `account/rateLimits/read` as the primary source for current quota state. Rationale: the protocol is locally available, structurally typed, and already returns the exact 5-hour and weekly windows. Date: 2026-03-31.

Decision: support a `/status` parser only as fallback, not as the default code path. Rationale: CodexBar uses CLI text parsing as a recovery path because it is inherently more brittle than structured app-server data. Date: 2026-03-31.

Decision: keep the new feature in a dedicated `src/codex-limits/` feature folder instead of scattering logic across `src/cli/` and `src/reporting/`. Rationale: the repo instructions require feature-based structure and UI/logic separation, and the quota logic is a distinct domain boundary. Date: 2026-03-31.

Decision: label the burn metrics as estimates in V1 and compute them from local token burn calibrated against the active Codex quota windows. Rationale: the CLI exposes current percent used now, but the repo does not maintain historical quota snapshots, and normal dashboard runs are supposed to stay read-only. Date: 2026-03-31.

Decision: show exact local burn totals for `today` and `last hour` alongside the estimated quota percentage-point burn. Rationale: the local session log pipeline already computes token burn exactly for arbitrary intervals, and showing the raw token totals makes the estimate easier to trust and debug. Date: 2026-03-31.

Decision: show exact `5h used` and `week used` rows tied to the active OpenAI quota windows instead of estimated `today pace` and `1h pace` rows. Rationale: the user-facing metric must follow OpenAI’s reset timing as truth; local-midnight and last-hour estimates were too easy to misread as exact server usage. Date: 2026-03-31.

Decision: present pace-of-depletion as the primary explanatory signal and raw token burn as supporting detail. Rationale: the user question is "how fast am I burning through the 5-hour and weekly limit," so the quota percentage-point delta should be the headline, while token totals explain the underlying magnitude. Date: 2026-03-31.

Decision: prefer explicit labels like `5h remaining`, `week remaining`, `5h used`, and `week used`, and render the used rows as percentages tied to the active OpenAI windows. Rationale: this keeps the displayed percentage anchored to the server-reported quota state while local token totals remain supporting context. Date: 2026-03-31.

Decision: when `rateLimitsByLimitId.codex` exists, use it; otherwise fall back to the legacy top-level `rateLimits` field. Rationale: the current app-server response is multi-bucket capable and already emits a keyed `codex` entry. Date: 2026-03-31.

Decision: do not add new CLI flags or a new top-level command in V1. Rationale: the user asked for a core dashboard capability, and the existing product value already flows through `today`, `last24h`, and `--json`; adding more command surface before proving the metrics would widen scope without improving the first release. Date: 2026-03-31.

Decision: keep the JSON schema version at `1` in V1 and add the new fields additively under `summaryReport`. Rationale: the existing machine-readable contract and packaged QA explicitly assert `schemaVersion=1`, and the planned change is additive rather than breaking; the plan must therefore update docs and tests to describe additive evolution instead of silently bumping the version. Date: 2026-03-31.

Decision: add a test-only quota-source override for unit tests and packaged-binary QA, but do not add a user-facing CLI flag for it. Use an environment variable such as `IDLETIME_CODEX_RATE_LIMIT_FIXTURE` that points to a sanitized JSON fixture. Rationale: the new default dashboard surface must be provable in isolated QA without depending on the operator’s real Codex account, yet the production command surface should stay minimal. Date: 2026-03-31.

Decision: treat the pace values as local estimates and say so explicitly in both text and JSON semantics. Rationale: current remaining quota comes from the live account-wide Codex snapshot, but the burn denominators come from local session logs and can miss activity from other machines or other Codex surfaces on the same account. Date: 2026-03-31.

Decision: make the limits section global to the active Codex account and ignore session-report filters for V1, while labeling it as global when any narrowing filter is active. Rationale: mixing account-wide remaining quota with a workspace-filtered or model-filtered burn denominator would be more misleading than a clearly labeled global section. Date: 2026-03-31.

Decision: widen the session read only once, only when quota-derived pace metrics are available, and reuse that widened session set for both the limit builder and the normal summary/hourly builders. Rationale: estimating weekly pace requires a denominator from the active weekly window, which can span seven days; doing two scans would turn a useful feature into avoidable I/O churn. Date: 2026-03-31.

Decision: include a compact limits readout in share mode instead of omitting the feature entirely from screenshot output. Rationale: the share card is one of the most visible user-facing surfaces, and hiding the new pace signal there would create an inconsistent product story. Date: 2026-03-31.

Decision: treat the live `codex app-server` conversation as a sequential handshake and keep stdin open until the `account/rateLimits/read` response arrives. Rationale: the March 31 reproduction showed that the broken transport path never received `id:2`, which left the dashboard with null quota windows even though the installed Codex CLI supported the method. Date: 2026-03-31.

Decision: merge caller-provided environment overrides into `process.env` instead of replacing the entire environment. Rationale: the spawned-binary handshake test proved that replacing the environment drops `PATH` and makes `CODEX_BINARY` overrides unreliable, even when the quota reader logic is otherwise correct. Date: 2026-03-31.

## Outcomes & Retrospective

The feature shipped as planned. `idletime` now renders live 5-hour and weekly Codex quota data in the default dashboard, `today`, share mode, and JSON snapshots, while keeping the existing read-only contract intact. The packaged QA harness also renders the same surface from a deterministic quota fixture, so the feature is covered both against the real local Codex account and in isolated release validation.

The most important implementation lesson is that the missing-quota bug was not a renderer issue. The renderer only surfaced a truthful downstream state. The real failure was in the quota reader boundary: the live app-server request path did not reliably complete the transport sequence, and the non-TTY `/status` fallback could not rescue the read. A smaller but real follow-on bug was the environment replacement behavior, which broke `CODEX_BINARY` overrides by stripping `PATH`. Both issues are now covered by tests, and the release gate is green.

The main remaining limitation is still conceptual rather than broken behavior. The pace rows are local-log-derived estimates calibrated against the current account-wide quota windows, so they can understate total account burn if the same Codex account is active on another machine or surface. That tradeoff remains explicit in the UI and JSON semantics and is acceptable for V1.

## Context and Orientation

The current dashboard pipeline starts in [src/cli/run-idletime.ts](/Users/parkerrex/Projects/idletime/src/cli/run-idletime.ts). The `today` and `last24h` flows load sessions with [src/codex-session-log/read-codex-sessions.ts](/Users/parkerrex/Projects/idletime/src/codex-session-log/read-codex-sessions.ts), build aggregate metrics in [src/reporting/build-summary-report.ts](/Users/parkerrex/Projects/idletime/src/reporting/build-summary-report.ts) and [src/reporting/build-hourly-report.ts](/Users/parkerrex/Projects/idletime/src/reporting/build-hourly-report.ts), and render the dashboard in [src/reporting/render-summary-report.ts](/Users/parkerrex/Projects/idletime/src/reporting/render-summary-report.ts). JSON output flows through [src/reporting/serialize-summary-report.ts](/Users/parkerrex/Projects/idletime/src/reporting/serialize-summary-report.ts). Share mode is not a separate command; it is the compact branch inside `render-summary-report.ts`, so the plan must specify how the new limit signal appears there too.

The repo’s filter model also matters. Summary and hourly reports can be narrowed by workspace, session kind, model, or reasoning effort, but the new quota snapshot is tied to the active Codex account rather than any filtered subset of sessions. The plan therefore treats quota as a global overlay, not as another filtered report dimension.

Token burn is already computed from `event_msg` `token_count` entries. The key pieces are [src/codex-session-log/extract-token-points.ts](/Users/parkerrex/Projects/idletime/src/codex-session-log/extract-token-points.ts), which normalizes token usage deltas, and [src/codex-session-log/token-usage.ts](/Users/parkerrex/Projects/idletime/src/codex-session-log/token-usage.ts), which defines "practical burn" as `input - cached_input + output`.

The summary and hourly reports already work in terms of time windows. [src/report-window/resolve-report-window.ts](/Users/parkerrex/Projects/idletime/src/report-window/resolve-report-window.ts) resolves `today` and arbitrary trailing windows. The best-metrics subsystem in [src/best-metrics/build-rolling-24h-windows.ts](/Users/parkerrex/Projects/idletime/src/best-metrics/build-rolling-24h-windows.ts) is also relevant because it shows how this repo records exact `windowStart` and `windowEnd` provenance for rolling metrics.

The new feature should not live inside the renderer. The renderer should only receive a fully prepared "Codex limit report" object. All subprocess work, time-window math, calibration, and fallback decisions belong in a new feature folder.

Relevant external findings, restated for this repo:

- CodexBar documents Codex usage as structured app-server or RPC first, with `/status` PTY parsing as fallback.
- The local `codex app-server` schema generator exposes `RateLimitWindow = { usedPercent, windowDurationMins, resetsAt }`.
- A live local probe on March 31, 2026 returned `primary.windowDurationMins = 300` and `secondary.windowDurationMins = 10080`, which map cleanly to the user-requested 5-hour and weekly windows.

The feature-based folder change should look like this:

Before:

    src/
      cli/
      codex-session-log/
      reporting/

After:

    src/
      cli/
      codex-limits/
        build-codex-limit-report.ts
        parse-codex-status-rate-limits.ts
        read-codex-rate-limits.ts
        sum-window-burn.ts
        types.ts
      codex-session-log/
      reporting/

## Plan of Work

The implementation should begin by introducing a narrow `src/codex-limits/` domain that knows how to fetch Codex rate limits and translate them into dashboard metrics. That folder must produce one typed value, tentatively named `CodexLimitReport`, which the rest of the app can treat as read-only input. It should also expose a test-only dependency seam so unit tests and packaged QA can provide deterministic quota fixtures without launching the real `codex` binary.

Start with source acquisition. Add `read-codex-rate-limits.ts` to spawn `codex app-server`, send `initialize`, then request `account/rateLimits/read`. Keep the protocol logic small and bounded by timeouts. The file should normalize the app-server response into explicit `fiveHourWindow` and `weeklyWindow` fields rather than leaking the upstream `primary` and `secondary` naming into the rest of the codebase. Add `parse-codex-status-rate-limits.ts` as a fallback parser for `/status` output, but do not let that fallback spread into reporting code.

Then add the burn-estimation layer. `sum-window-burn.ts` should accept parsed sessions and an arbitrary time interval and return practical burn totals using the same token-delta rules the rest of the repo already uses. `build-codex-limit-report.ts` should combine the current rate-limit snapshot with local session totals over the active 5-hour and weekly windows, then derive both exact token totals for "today" and "last hour" and estimated percentage-point burn for those same periods. The implementation should compute the percentage estimates only when the denominator is meaningful. If the current weekly window has `usedPercent = 0`, the "today burn" estimate should be unavailable instead of dividing by zero or fabricating a number, but the exact `todayBurnTokens` field should still render.

After the domain logic exists, thread it into the summary command builders. [src/cli/run-last24h-command.ts](/Users/parkerrex/Projects/idletime/src/cli/run-last24h-command.ts) and [src/cli/run-today-command.ts](/Users/parkerrex/Projects/idletime/src/cli/run-today-command.ts) should fetch the Codex limit report alongside the existing session and best-ledger work. When the pace estimates are available, they should widen the session read once to the earliest required quota window boundary and then reuse that widened session set for the normal report builders instead of reading twice. The new report should become a nullable field on `SummaryReport` in [src/reporting/types.ts](/Users/parkerrex/Projects/idletime/src/reporting/types.ts).

Once the data is available on `SummaryReport`, add a dedicated `Limits` section in [src/reporting/render-summary-report.ts](/Users/parkerrex/Projects/idletime/src/reporting/render-summary-report.ts). Keep it textual and compact. Do not overload the existing header plaque. The likely order is `5h remaining`, `week remaining`, `5h used`, and `week used`, with the used rows showing exact server percentages for the active OpenAI windows and local token totals in the detail text. The renderer should show "unavailable" rather than blank space when the user is not logged into Codex or when the estimate cannot be derived safely. When any narrowing report filter is active, label the section as global so the user can see that the quota view is account-wide rather than filter-scoped.

Finally, extend [src/reporting/serialize-summary-report.ts](/Users/parkerrex/Projects/idletime/src/reporting/serialize-summary-report.ts) so `--json` clients can consume the same limit data. The JSON shape should preserve both source provenance and estimate status so downstream tooling can distinguish "exact remaining now" from "estimated burn." Keep the snapshot schema version at `1` and add the new fields additively; update the JSON docs and tests so that additive evolution is explicit instead of implicit.

## Milestones

Milestone 1 establishes a trustworthy Codex rate-limit adapter. At the end of this milestone, a local function can return the current 5-hour and weekly Codex limits, remaining percentages, and reset timestamps without touching the renderer. Run the adapter against a logged-in machine and verify that it maps a real 300-minute primary window and 10080-minute secondary window into explicit five-hour and weekly fields.

Milestone 2 adds burn totals and burn estimation without changing the repository's read-only dashboard contract. At the end of this milestone, the new feature can report exact practical burn since local midnight and over the last hour, plus estimate weekly burn since local midnight and 5-hour burn over the last hour using only current rate-limit state plus local session logs. Run the domain tests with synthetic sessions and verify that zero or missing denominator cases produce "unavailable" for the estimates instead of incorrect percentages while keeping the exact burn totals intact.

Milestone 3 surfaces the metrics in the user-facing dashboard, share card, and JSON snapshot. At the end of this milestone, `bun run idletime`, `bun run idletime --share`, and `bun run idletime today --json` all expose the new limit report in forms appropriate to their surface. Success means a human can see the new pace signal in both the full and compact text outputs, and an automated consumer can find the same values in JSON.

Milestone 4 hardens the feature. At the end of this milestone, the new code passes unit tests, CLI snapshot tests, shell-journey QA, and the release gate. Success means the feature is additive and does not destabilize the existing reporting flows.

## Concrete Steps

Work from `/Users/parkerrex/Projects/idletime`.

1. Create `src/codex-limits/types.ts` with narrow, domain-specific types. Avoid vague names like `window` or `stats` when the meaning is actually "five-hour quota snapshot" or "estimated weekly burn."

   The core shapes should separate exact quota state from estimated pace. A reasonable starting point is:

       type LimitMetric =
         | { kind: "available"; usedPercent: number; remainingPercent: number; resetsAt: Date; windowDurationMins: number }
         | { kind: "unavailable"; reason: "codex-missing" | "not-logged-in" | "probe-failed" };

       type BurnEstimate =
         | { kind: "estimated"; percentPoints: number; sourceBurnTokens: number; calibrationWindowBurnTokens: number }
         | { kind: "unavailable"; reason: "missing-rate-limit" | "zero-used-percent" | "zero-window-burn" };

       type CodexLimitReport = {
         fetchedAt: Date;
         source: "app-server" | "status-fallback";
         fiveHourRemaining: LimitMetric;
         weeklyRemaining: LimitMetric;
         todayBurnTokens: number;
         lastHourBurnTokens: number;
         todayWeeklyBurn: BurnEstimate;
         lastHourFiveHourBurn: BurnEstimate;
       };

2. Implement `src/codex-limits/read-codex-rate-limits.ts`.

   Launch `codex app-server` in stdio mode, send:

       {"id":1,"method":"initialize","params":{"clientInfo":{"name":"idletime","title":"idletime","version":"0.2.0"},"capabilities":null}}
       {"id":2,"method":"account/rateLimits/read"}

   Parse the `id:2` response. If `rateLimitsByLimitId.codex` exists, use it. Otherwise use `rateLimits`. Map `primary.windowDurationMins === 300` to the five-hour metric and `secondary.windowDurationMins === 10080` to the weekly metric. Convert Unix timestamps like `resetsAt: 1774978303` to `Date` immediately at the boundary. Also support an injected or environment-driven test override so packaged QA can bypass the live subprocess deterministically, using `IDLETIME_CODEX_RATE_LIMIT_FIXTURE` as the concrete environment variable name.

3. Implement `src/codex-limits/parse-codex-status-rate-limits.ts`.

   This file only activates when the app-server reader fails. It should accept raw `/status` output text and extract `Credits`, `5h limit`, and `Weekly limit` lines conservatively. Keep the parser isolated so renderer code never needs to know whether the data came from JSON-RPC or terminal text.

4. Implement `src/codex-limits/sum-window-burn.ts`.

   This helper should accept `ParsedSession[]` and a `{ start, end }` interval and return a practical-burn total by iterating `buildTokenDeltaPoints(session.tokenPoints)`. Keep it feature-local for V1 so the change does not force a wider refactor of existing reporting code.

5. Implement `src/codex-limits/build-codex-limit-report.ts`.

   This file should:

   - fetch the current Codex rate-limit snapshot
   - derive the current five-hour window start from `resetsAt - 300m`
   - derive the current weekly window start from `resetsAt - 10080m`
   - compute local practical burn for:
     - the active five-hour window
     - the active weekly window
     - `today`
     - `last hour`
   - calibrate percentage points only when both current used percent and local window burn are positive
   - compute:
     - `todayBurnTokens`
     - `lastHourBurnTokens`
     - `todayWeeklyBurn = weeklyUsedPercent * todayBurn / weeklyWindowBurn`
     - `lastHourFiveHourBurn = fiveHourUsedPercent * lastHourBurn / fiveHourWindowBurn`

   If any denominator is zero or unavailable, emit an `unavailable` union branch instead of a fake zero.

6. Thread the new report into [src/cli/run-last24h-command.ts](/Users/parkerrex/Projects/idletime/src/cli/run-last24h-command.ts) and [src/cli/run-today-command.ts](/Users/parkerrex/Projects/idletime/src/cli/run-today-command.ts).

   Fetch the Codex limit report in parallel with existing I/O. Only widen the session read when the quota probe succeeded and at least one pace estimate can be computed. The earliest session window for the quota estimator should be the minimum of:

   - local midnight
   - `now - 1 hour`
   - active five-hour window start
   - active weekly window start

   Reuse one session read for the summary report and limit report whenever possible so the feature does not double the scan cost unnecessarily.

7. Extend [src/reporting/types.ts](/Users/parkerrex/Projects/idletime/src/reporting/types.ts) and [src/reporting/serialize-summary-report.ts](/Users/parkerrex/Projects/idletime/src/reporting/serialize-summary-report.ts).

   Add a nullable `codexLimitReport` field to `SummaryReport`. Serialize both the metric values and the union state so JSON clients can distinguish available data from unavailable data and exact remaining from estimated burn. Keep `jsonReportSchemaVersion` at `1`, update the serializer tests to assert the new fields additively, and update packaged QA expectations so they keep asserting `schemaVersion=1`.

8. Add a new `Limits` section to [src/reporting/render-summary-report.ts](/Users/parkerrex/Projects/idletime/src/reporting/render-summary-report.ts).

   The output should be compact and explicit. A concrete full-report target is:

       Limits (global)
         5h remaining    ████████········  41.0%  resets 13:31
         week remaining  ████████████····  76.0%  resets 04/06 15:26
         5h used         █················  5.0%   OpenAI 5h window • 4.1k local tokens
         week used       ██████············ 34.0%  OpenAI weekly window • 18.4k local tokens

   The exact bar widths and colors can follow the existing summary conventions, but the labels should stay explicit. In share mode, add a compact two-line variant that preserves the primary pace signal rather than dropping the feature entirely, for example a `5h` line and a `week` line that each show remaining plus the relevant pace estimate.

9. Add tests.

   At minimum:

   - unit tests for app-server response normalization, including `rateLimitsByLimitId.codex`
   - unit tests for unavailable cases such as zero percent used or zero local burn
   - synthetic-report tests that verify the `Limits` section text
   - JSON snapshot tests for `today` and `last24h`
   - share-mode render tests for the compact limits readout
   - packaged-binary QA coverage that drives the feature through a deterministic quota fixture instead of a real account

   Store sanitized app-server responses in a new fixture folder such as `test/fixtures/codex-limits/`.

10. Run the full validation suite and capture the key evidence in this plan.

## Validation and Acceptance

The feature is complete when a logged-in Codex user can run:

    bun run idletime

and see a dedicated `Limits` section with current five-hour remaining, current weekly remaining, exact practical burn since local midnight, exact practical burn over the last hour, estimated weekly burn since local midnight, and estimated five-hour burn over the last hour.

The JSON path is complete when:

    bun run idletime today --json

returns a snapshot whose summary payload contains a structured `codexLimitReport` field with explicit availability state for each metric while keeping `schemaVersion` equal to `1`.

The fallback path is complete when the app-server reader can be forced to fail in a test and the `/status` parser still produces the current remaining five-hour and weekly metrics from fixture text.

The packaged QA path is complete when the installed-binary harness can render the new default dashboard surface from a deterministic quota fixture, assert the limits rows in text output, and still prove that `--json` remains read-only and additive.

The implementation must pass:

    bun test
    bun run typecheck
    bun run qa
    bun run check:release

Success means all commands exit zero and no existing summary, hourly, or live behavior regresses.

## Idempotence and Recovery

All dashboard and JSON commands must remain safe to rerun. V1 of this feature must not write durable quota history during normal reads. If the app-server subprocess times out or the user is not logged in, the code should return an unavailable limit report and continue rendering the rest of the dashboard normally. If the quota probe is unavailable, do not widen the session read just to chase an estimate that cannot be shown.

If the app-server probe proves unreliable during implementation, finish the structured boundary first and keep the fallback parser isolated. Do not spread retry logic into renderer code. If needed, temporarily stub the source reader in tests and continue with rendering and serialization work while the subprocess probe is repaired.

If the estimate math produces unstable results during testing, prefer returning `unavailable` over widening the feature into a background sampler. A later milestone can add exact historical quota deltas if the estimate is insufficient.

## Artifacts and Notes

Local verification commands run during planning:

    which codex
    codex --version

Observed local CLI version during planning:

    /Users/parkerrex/.bun/bin/codex
    codex-cli 0.117.0

Live app-server probe run on 2026-03-31:

    {"id":1,"method":"initialize","params":{"clientInfo":{"name":"idletime-research","title":"idletime research","version":"0.0.0"},"capabilities":null}}
    {"id":2,"method":"account/rateLimits/read"}

Observed current reset timestamps on the planning machine:

    5h reset:   2026-03-31 13:31:43 EDT
    week reset: 2026-04-06 15:26:39 EDT

Bug reproduction from the March 31 implementation pass:

    bun run idletime today
    ...
    5h remaining    ... unavailable missing quota data
    week remaining  ... unavailable missing quota data

Live verification after the reader fixes:

    bun run idletime today
    ...
    5h remaining    ██████████████████  98.0%   resets 18:32
    week remaining  ████████████······  66.0%   resets 04/06, 15:26
    5h used         █·················  5.0%    OpenAI 5h window • 1.6M tokens
    week used       ██████████████████  34.0%   OpenAI weekly window • 226M tokens

Final release-gate verification on 2026-03-31:

    bun test
    bun run typecheck
    bun run qa
    bun run check:release

Observed result:

    57 pass
    0 fail
    QA shell journeys passed: 13 scenarios.
    npm pack --dry-run completed successfully.

CodexBar upstream references used in this planning pass:

- https://github.com/steipete/CodexBar/blob/main/README.md
- https://github.com/steipete/CodexBar/blob/main/docs/codex.md

## Interfaces and Dependencies

This feature should not add new npm dependencies. It depends on the locally installed `codex` CLI being available when quota data is requested. The feature boundary must make that dependency explicit and nullable.

The new code should expose a small interface from `src/codex-limits/` that command builders can call without knowing transport details. A reasonable top-level function is:

    buildCodexLimitReport(options: {
      now: Date;
      sessions: ParsedSession[];
      readRateLimits?: () => Promise<NormalizedCodexRateLimits>;
    }): Promise<CodexLimitReport | null>

The optional injected `readRateLimits` dependency is important because tests should not launch the real `codex` binary.

The implementation also needs one deterministic QA seam for the packaged shell-journey harness. Use `IDLETIME_CODEX_RATE_LIMIT_FIXTURE` as the concrete environment variable name. It should point at a sanitized JSON fixture and should only affect the quota reader, not the normal session-log pipeline. This keeps the public CLI surface small while the release gate can still prove the new feature end to end.

The renderer and JSON serializer must consume only the normalized domain types, never raw app-server payloads. The subprocess transport and `/status` parser should stay confined to the `src/codex-limits/` folder.

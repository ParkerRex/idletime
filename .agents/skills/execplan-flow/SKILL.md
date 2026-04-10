---
name: execplan-flow
description: Orchestrate the ExecPlan workflow with the `execplanner`, `execgriller`, and `executor` subagents. Use when the user wants to write and harden an ExecPlan, or run the full write-grill-execute flow end to end. Trigger on phrases like `planflow`, `execflow`, `write a plan`, `grill this plan`, `execute this plan`, or `run the full execplan flow`. Do not use for generic coding requests that do not need an ExecPlan workflow.
---

# ExecPlan Flow

## Overview

Use this skill to turn a user request into a structured ExecPlan workflow. The root thread is the orchestrator. It resolves the plan path, normalizes the task, spawns the specialist subagents in order, waits for each one, and stops on real blockers instead of guessing.

This skill has two modes:

- `planflow`: write and harden an ExecPlan, then stop
- `execflow`: write and harden an ExecPlan, then execute it through the executor loop

## Mode selection

Choose `planflow` when the user clearly wants planning only, for example:

- `planflow`
- `write a plan`
- `grill this plan`
- `make the plan implementation-ready`

Choose `execflow` when the user clearly wants the full workflow, for example:

- `execflow`
- `run the full execplan flow`
- `write the plan and carry it out`
- `plan this and implement it`

If the intent is ambiguous, default to `planflow`.

## Shared handoff contract

Before spawning any subagent, normalize the request into this compact structure:

- `Goal`: what should change
- `Context`: relevant files, folders, docs, errors, examples, or existing plan paths
- `Constraints`: architecture, safety, rollout, style, or compatibility requirements
- `Done when`: observable acceptance criteria
- `Target plan path`: a repository-relative path under `docs/codex/`

Fill gaps from the repository when possible. If the user gives only a terse request, do not force a rigid format; derive the missing structure from the repo and the request.

Resolve the target plan path like this:

- If the user explicitly names a repository-relative ExecPlan path under `docs/codex/`, use it.
- Otherwise choose a concise kebab-case path under `docs/codex/` based on the task scope.
- Prefer reusing an obvious existing plan file when the request clearly targets that same initiative. Otherwise create a new one.

## Planner and griller workflow

For both modes, run these steps first:

1. Spawn `execplanner`.
2. Pass a payload that matches the planner contract:
   - `<target_execplan_path>` with the chosen file
   - `<feature_outline>` with the normalized `Goal`, `Context`, and `Done when`
   - `<extra_constraints>` with the normalized `Constraints`
3. Wait for completion.
4. If `execplanner` returns must-have clarification questions or a hard blocker, stop and surface them to the user.
5. Spawn `execgriller`.
6. Give it the same target plan path and the same normalized task summary.
7. Instruct it to inspect the real repo first, ask only repo-unresolvable must-have questions, and patch the target ExecPlan after the open questions are resolved.
8. Wait for completion.
9. If `execgriller` returns must-have questions or blockers, stop and surface them to the user.

When running `planflow`, stop here and return:

- final ExecPlan path
- whether the plan is implementation-ready
- any remaining blockers or explicit assumptions
- a short suggestion to use `execflow` when the user wants execution

## Full execution workflow

When running `execflow`, continue after the grill-and-patch pass:

1. Spawn `executor`.
2. Give it the exact same target plan path.
3. Instruct it to use the grilled ExecPlan as the source of truth for sequencing and scope, not the original brief.
4. Wait for completion.

If `executor` reports a blocker that cannot be resolved from the repo or the plan, surface:

- current milestone
- slice attempted
- validations run and results
- the smallest unblock needed

If `executor` completes a meaningful slice or the full task, return:

- final ExecPlan path
- current milestone or completion state
- validations run and results
- blockers, risks, or follow-ups that still matter

## Guardrails

- Keep the root thread as the orchestrator. Do not ask child agents to spawn one another.
- Use the custom agent roles exactly as named: `execplanner`, `execgriller`, and `executor`.
- Do not skip the grill pass.
- Do not implement product code in `planflow`.
- Do not dump the full ExecPlan into chat unless the user explicitly asks for it.
- Keep final responses concise and high signal.

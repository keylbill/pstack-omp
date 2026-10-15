---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: true
---

# Swarm

Fan out N parallel isolated workers. They may cover separate slices, race the same brief, or mix both. The parent waits, aggregates, and returns one report.

Runtime: native OMP task dispatch, model roles, and history per `skill://poteto-mode/references/omp-runtime.md`. Skill-specific values: the `swarm workers` role in the file at the effective `configurationPath` reported by `/pstack status`; workers that write dispatch as `poteto-agent` with `isolated: true`, and their reports are read via `agent://<name>`.

Choose each helper's reasoning through its configured pstack role and supported effort, per the Subagents section of `skill://poteto-mode`. Preserve user-owned model families and panels. Native service tier comes only from `task.agentServiceTierOverrides[agentName]` over `tier.subagent`; inheritance snapshots the live parent `/fast` state. Do not mutate shared configuration or invent per-job speed fields.

## Start

Open a native todo list with one entry per phase (verbatim text) before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Set N from the user or derive it from the shape. N is total workers, not a concurrency limit.
4. Use the `swarm workers` role for each worker by default. Assign each worker a session-unique CamelCase `name` and scalar `role: "swarm workers"` for registration in Phase B. The planner reads the latest `models.json` and validates selectors through the native resolver. Report a missing role or credential and stop that seat rather than substituting. If the user explicitly names models for comparison arms, register each named arm with `{"name":"UniqueArmName","selector":"<user-requested native selector>"}` instead. Use this selector branch only for explicitly user-named comparison arms, not for automatic model or effort selection. A helper uses either `selector` or `role` with optional zero-based `panelIndex`, never both. Preserve configured roles and panels without rewriting them to conduct the comparison. Report an unavailable requested selector without fallback.
5. Give each worker its own writable output when it writes. When workers verify or measure commits, each brief names the exact SHAs. A measurement brief also names the method (sample count, what one sample is, order). The worker records both in its result.

## Phase B: Fan out

Before the batch, call `pstack_plan` with `action: "register"` and `helpers` containing every worker's name and role, plus `panelIndex` for panel seats. For an explicitly user-named comparison arm, supply `name` and `selector` instead of `role` and `panelIndex`. The planner validates the entire batch through the native resolver before dispatch. Dispatch all N workers in one OMP `task` batch with shared `context` plus per-item `task`, `solutionSpace`, the exact registered `name`, and `agent`. Never reuse a helper name in the session. Omit `model`, effort, and speed fields from every task item. Set `isolated: true` for every worker that writes, so each gets an exclusive workspace; automatic application stays off and the parent integrates returned artifacts deliberately, never resetting a shared or dirty user branch. A worker that needs something only on the user's computer gets that local scope named in its brief. When a worker must start from a non-default pushed branch, the brief names the exact branch. Never have parallel workers drive one shared browser, window, runtime, database, or provider account.

On strict provider wires that require every schema key, send unused helper fields as `null`. The planner treats `null` as absent before enforcing the exclusive branches. An explicit arm may use `{"name":"NamedComparisonArm","role":null,"panelIndex":null,"selector":"@review_alt"}` when the user explicitly requested that configured selector. An ordinary worker may use `{"name":"ConfiguredWorker","role":"swarm workers","panelIndex":null,"selector":null}`. Real non-null `role` or `panelIndex` values cannot accompany a non-null `selector`.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence. A worker that can prove a defect reports `ISSUES` and lists every issue it can prove, not only the first.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. Drop a result that does not record the SHAs and method its brief names, and respawn that worker once. After a second miss, record a gap. A gap does not count as a pass. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

Keep a compact result table, one-line evidenced issues, and explicit gaps or dropouts.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.

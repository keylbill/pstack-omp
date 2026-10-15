---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /arena, 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
disable-model-invocation: true
---

# Arena

Fan out N parallel attempts at the same task. Read every candidate end to end. Pick the strongest as the base. Graft the best ideas from the others into it. Verify the synthesized result.

Runtime: native OMP task dispatch, model roles, and history per `skill://poteto-mode/references/omp-runtime.md`. Skill-specific values are the `arena runners` and `arena cross-judge pool` panels. Register their named seats through `pstack_plan` before dispatch. Candidates dispatch as `poteto-agent` with `isolated: true`, the judge as `reviewer` with a no-mutations scope written into its brief.

Native effort comes from the configured role selector. Service tier comes only from `task.agentServiceTierOverrides[name]` over `tier.subagent`, with inheritance taking the live parent `/fast` state. Do not add model, effort, or speed fields to task items or mutate shared configuration. Include repository privacy and domain constraints in every child brief. Host safety and permissions remain authoritative.

## Start

Open a native todo list with one entry per phase (verbatim text) before launching anything.

1. Frame
2. Fan out
3. Cross-judge
4. Pick
5. Graft
6. Verify

## Phase A: Frame

Every candidate gets the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric. State what success looks like for *this* task, then turn it into 3-6 concrete gradeable criteria. The rubric is the picker's tool in Phase D. Candidates only see the task.
3. Pick the runners. Use one candidate per configured `arena runners` panel entry. Assign each candidate scalar `role: "arena runners"` and its zero-based `panelIndex` for registration in Phase B. The planner reads the latest `models.json` and validates selectors through the native resolver. Report a missing role or credential and stop that seat rather than substituting. Spawn more seats when the arena covers multiple design directions. Run the same configured seat N times with distinct helper names when the work is generation-bound rather than judgment-sensitive.
4. Assign output paths. Each candidate gets an exclusive workspace (`isolated: true`) and its own output path, per the **separate-before-serializing-shared-state** principle skill. Automatic application stays off: inspect each returned patch or branch artifact and integrate the selected result deliberately. Never reset a shared or dirty user branch. Never have parallel candidates drive one shared browser, window, runtime, database, or provider account.

## Phase B: Fan out

Before the batch, call `pstack_plan` with `action: "register"` and `helpers` containing every candidate's session-unique CamelCase `name`, scalar panel `role`, and zero-based `panelIndex`. Dispatch all N candidates in one OMP `task` batch with shared `context` plus per-item `task`, `solutionSpace`, the exact registered `name`, `agent: "poteto-agent"`, and `isolated: true`. Never reuse a helper name in the session. Omit `model` from every task item. Each brief carries the task, the path to the shared grounding, its own output path, and instructions to produce the artifact and a short rationale naming the alternatives it considered and what it rejected. The host runs the batch in the background and auto-delivers results; use `wait` only when there is no actionable work. Read reports via `agent://<name>` and live transcripts via `history://<name>`.

If a candidate produces no output, proceed with N-1 and note the dropout.

## Phase C: Cross-judge

After all Phase B candidates complete, select a configured `arena cross-judge pool` seat, preferring a native-resolved family that differs from the parent's and from the candidates when resolution metadata is available. Register the judge through `pstack_plan` with `action: "register"` and one helper containing a session-unique CamelCase `name`, scalar `role: "arena cross-judge pool"`, and the selected zero-based `panelIndex`. The planner reads the latest `models.json` and validates the selector through the native resolver. Dispatch one task with that exact name, `agent: "reviewer"`, no `model` field, and an explicit no-mutations scope written into its brief. It sees the rubric and the candidates by path label, scores each criterion, and recommends a base with rationale. It runs in parallel with the parent's reading in Phase D, not with the candidates themselves. Don't dispatch the judge while candidates are still writing. If the pool is missing or no entry is available, report the missing choice and stop the judge seat; never pin a provider or model or silently fall back.

## Phase D: Pick a base

Read every candidate end to end before picking. Score each against the rubric criterion by criterion, not on holistic feel, and compare with the cross-judge. Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base a future maintainer can extend most easily without breaking invariants. When two feel tied, prefer the cleaner boundary or smaller API, per the Laziness Protocol.

## Phase E: Graft

Walk each losing candidate once more for what is worth porting into the base, usually one or two things per candidate, not most of it. Fold each graft in by hand, per the **redesign-from-first-principles** principle skill, so the result stays coherent under one mental model. Don't paste mechanically.

If the candidates converge on one shape, that is strong agreement. Note it and ship the consensus shape. No graft is needed. If they wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

Verify the synthesized artifact like any other output, per the **prove-it-works** principle skill. If verification finds a problem the arena missed, either Phase A was wrong (re-frame and re-run) or a candidate caught it and you missed the graft (go back to Phase E). Don't paper over it.

## Outputs

One synthesized artifact, with a short synthesis note alongside naming the base and why, the cross-judge's verdict, each graft with its source candidate, what was rejected and why, any convergence or dropouts, and the verification result.

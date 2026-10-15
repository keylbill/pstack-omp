---
name: figure-it-out
description: "Design an auditable playbook when no narrower one fits: a large migration, an ambitious multi-part change, or work a human reviews after stepping away. Scales rigor to the task, runs a hypothesis loop, and logs decisions. Use for /figure-it-out or 'figure it out'."
disable-model-invocation: true
---

# Figure it out

When the task matches no playbook, design one. The deliverable before any code is the workflow itself: a sequence of phases that scales rigor to the task, runs the scientific method, and leaves a decision trail a human can audit after stepping away.

Host, task-dispatch, model, and history contracts live in `skill://poteto-mode/references/omp-runtime.md`. Skill-specific values for this flow: todos via native `todo` with verbatim text; engineering owners `agent: "poteto-agent"`; read-only exploration `agent: "scout"`; review `agent: "reviewer"` / `"security-reviewer"`; role selectors in the file at the effective `configurationPath` reported by `/pstack status` (never silently substitute a missing role); decision trail via `skill://show-me-your-work`.

Choose each helper's reasoning through its configured pstack role and supported effort, per the Subagents section of `skill://poteto-mode`. Preserve user-owned model families and panels. Native service tier comes only from `task.agentServiceTierOverrides[agentName]` over `tier.subagent`; inheritance snapshots the live parent `/fast` state. Do not mutate shared configuration or invent per-job speed fields.

## Start

Open a native `todo` list whose first item is to read the Principles section of the **poteto-mode** skill (`skill://poteto-mode`). Then add the phases below as todos, copying their text verbatim.

## Phase A: Frame

Ground first, then commit. Don't start the run until you can state:

- The definition of done as a falsifiable predicate (the **prove-it-works** principle skill, `skill://principle-prove-it-works`).
- Scope, quantified: rough units and effort, plus the blockers grounding surfaced.
- The rigor level, biased high. One-way doors and high blast radius get more. Reversible low-stakes steps get less. Rigor is gates and artifacts, not "try harder".

Present the framing and tradeoffs before committing to a long run. Reversible work proceeds (the **never-block-on-the-human** principle skill, `skill://principle-never-block-on-the-human`), but a multi-hour run earns one checkpoint.

## Phase B: Design the workflow

Decompose into atomic, independently-landable units. Sequence riskiest-unknown-first. Scaffold and verification come before features (the **foundational-thinking** principle skill, `skill://principle-foundational-thinking`).

- Build the verification harness before the work, with the baseline captured from the pre-change state, so the check reads as "old value vs new value".
- For one-way-door design decisions, run the **architect** skill (`skill://architect`, it runs **arena**, `skill://arena`). Skip it for mechanical work whose shape is already concrete. A second arena over a settled design is over-engineering (the **laziness-protocol** principle skill, `skill://principle-laziness-protocol`).
- Decide what fans out. Dispatch via native `task` with shared `context` plus per-item `task` and `solutionSpace`. Parallelize only across seams, and give each worker its own worktree or branch (the **separate-before-serializing-shared-state** principle skill, `skill://principle-separate-before-serializing-shared-state`). Don't over-fan.
- Write the designed phase list down. That list is what the human reviews.

Then execute the design. Add its steps to the `todo` list as concrete items between the Phase C and Phase D entries. Run each under the Phase C loop discipline, and weave the Phase D log through them, a row as each step lands, rather than saving the whole trail for the end.

## Phase C: Run the loop

Each unit is an experiment. State the hypothesis, make the smallest change, measure against the predicate on the real artifact, keep it if it advanced, revert it if it didn't. Apply the **sequence-verifiable-units** principle skill (`skill://principle-sequence-verifiable-units`), verifying each unit before starting the next instead of batching checks at the end.

- Verify by inspecting the artifact, never a self-report. When something passes too easily, suspect the observation method before the system.
- Pair delegated work with a judge. If a worker games the gate, reset and harden the contract. If the gate itself is wrong, fix the gate in its own change rather than routing around it.
- A verdict is VERIFIED, NOT VERIFIED, or INCONCLUSIVE. Inconclusive is not a pass. Don't hide a negative.

## Phase D: Keep the audit trail

Log the run via the **show-me-your-work** skill (`skill://show-me-your-work`). figure-it-out's work is usually ambitious enough to commit the trail so the reviewer can read it in the PR. The trail plus the diff is what lets the human come back and trust the work.

## Phase E: Verify and hand back

Check the whole against the Phase A predicate on the real product, not just the harness. Encode any recurring correction as a gate, a lint rule, a check, or a script (the **encode-lessons-in-structure** principle skill, `skill://principle-encode-lessons-in-structure`).

**Reply:** the playbook you designed, the rigor level and why, the decision-trail path, what's verified against the predicate, and what's still open.

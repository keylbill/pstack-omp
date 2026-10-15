---
name: how
description: "Use for \"how does X work\", code walkthroughs before changing something, and placement / ownership / layering questions (\"where should this live\", \"which package owns this\", \"is this the right layer\"). Explains subsystem architecture, runtime flow, onboarding mental models. Use why for motivation."
disable-model-invocation: true
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

Before each native `task` batch, call `pstack_plan` with `action: "register"` and a `helpers` entry per task item, each with a session-unique CamelCase `name` and the scalar role named below. Match every task item's `name` exactly and never reuse it in the session. The tool reads the latest user-owned file at the effective `configurationPath` reported by `/pstack status` and validates selectors through the native resolver. Report missing roles, models, or credentials without fallback. Do not set a native task `model` field. Task dispatch, agent kinds, and history follow `skill://poteto-mode/references/omp-runtime.md`. Use shared `context` plus per-item `task`, `solutionSpace`, `name`, and `agent`; read reports via `agent://<name>` and live transcripts via `history://<name>`.

Use `agent: "scout"` for every read-only explorer and explainer. Register explorers with scalar `role: "how explorer"` and explainers with scalar `role: "how explainer"`. Carry repository privacy and domain constraints into each brief. Do not write files, commit, or change external state.

Native effort comes from the configured role selector. Service tier comes only from `task.agentServiceTierOverrides[name]` over `tier.subagent`, with inheritance taking the live parent `/fast` state. Do not add model, effort, or speed fields to task items or mutate shared configuration. Include repository privacy and domain constraints in every child brief. Host safety and permissions remain authoritative.

## 1. Assess complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): no explorers. Spawn one explainer that explores and explains in one pass, built from `references/explainer-prompt.md` without the explorer-findings section. Go to step 4.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): go to step 2.

When in doubt, take the simple path.

## 2. Explore (complex only)

Decompose the question into 2 to 4 angles, each a distinct slice of the subsystem. Spawn all explorers in one native `task` batch with shared `context` containing the question, scope, and output contract. Give each explorer `references/explorer-prompt.md` and its angle filled in.

## 3. Synthesize (complex only)

Once all explorers have returned, spawn one fresh explainer through native `task` with `references/explainer-prompt.md` and every explorer's findings filled in.

## 4. Present

Present the explainer's output. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.

## Output format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.

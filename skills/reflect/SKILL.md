---
name: reflect
description: Spawn three parallel review subagents over the active transcript, surface learnings, and route each to a concrete edit on an existing skill. Use when the user says reflect.
disable-model-invocation: true
---

# Reflect

Mine the current conversation for durable learnings, then route them into skill edits.
Host, task-dispatch, model, and history contracts: `skill://poteto-mode/references/omp-runtime.md`. This skill adds only the reviewer lenses, the synthesizer gate, and the routing table below.

Invoke when the user says "reflect" or "/reflect". Skip when the conversation is trivial, off-topic, or already covered by an existing skill the parent followed correctly. One-offs are not learnings.

## 1. Locate the active transcript

Use an actual current-session transcript handle when the host supplies one. `history://<agent-id>` reads a registered agent's transcript, while bare `history://` lists registered agents. Do not claim the listing is the parent's transcript. Read past sessions through the project-scoped archive prelude at `xd://eval/archive`, with `archive` scoped to the current project. Never read other projects' material. If no parent transcript resolves, write a tight digest of the visible session and pass that instead.

Choose each helper's reasoning through its configured pstack role and supported effort, per the Subagents section of `skill://poteto-mode`. Preserve user-owned model families and panels. Native service tier comes only from `task.agentServiceTierOverrides[agentName]` over `tier.subagent`; inheritance snapshots the live parent `/fast` state. Do not mutate shared configuration or invent per-job speed fields.

## 2. Spawn three reviewers in parallel

One native `task` call with shared `context` and three items in one `tasks` batch, each `agent: "poteto-agent"` with an explicit no-mutations scope written into the brief (read code, fetch tickets, query traces; do not write code, edit skills, or commit). Reviewers keep mounted `xd://` / MCP access per their live contracts for context lookups (tickets, chat threads, observability traces referenced in the transcript).

Before each reviewer or synthesizer batch, call `pstack_plan` with `action: "register"` and one helper per task item, each with a session-unique CamelCase `name` and the scalar role below. Match the native task names exactly and never reuse a name in the session. The tool reads the latest user-owned file at the effective `configurationPath` reported by `/pstack status` and validates selectors through the native resolver. Report missing roles, models, or credentials without fallback. Do not set a native task `model` field.

| Lens | Role | Prompt template |
|---|---|---|
| Judgment | `reflect judgment, divergent, synthesizer` | `references/judgment-reviewer.md` |
| Tooling | `reflect tooling` | `references/tooling-reviewer.md` |
| Divergent | `reflect judgment, divergent, synthesizer` | `references/divergent-reviewer.md` |

Pass each template verbatim, substituting the transcript handle or digest where marked. Reviewers return findings in the task report body (read via `agent://<name>`).

## 3. Synthesize

Register one helper with scalar `role: "reflect judgment, divergent, synthesizer"` before launching the synthesizer. Use its exact session-unique name on one `task` item with `agent: "poteto-agent"`, an explicit no-mutations scope written into the brief, and no `model` field. The synthesizer's quality check includes spot-verifying citations, which can require mounted `xd://` / MCP access. Use `references/synthesizer.md` verbatim, with each reviewer's full output inlined where marked. The synthesizer returns a structured Accepted / Rejected / Backlog list.

## 4. Structural enforcement check

Move any Accepted item that a lint rule, script, metadata flag, or runtime check would enforce more reliably to Backlog. See the **encode-lessons-in-structure** principle skill.

## 5. Apply

Present the synthesizer's full Accepted / Rejected / Backlog output and wait for explicit approval before applying any Accepted edit. The user picks the subset and may redirect routings. Skill changes affect every future agent in the org. Do not auto-apply.

File each Backlog item to your team's devex or backlog tracker when the user's authorization and host permission contract allow it. Otherwise report the required permission. Only the Accepted skill edits wait for the approval gate above.

Follow each approved row's Routing exactly:

- Trivial existing-skill edit (a one-line bullet, a tightened sentence, a stale fact corrected): the parent does it directly.
- Substantive existing-skill edit (a new section, a new pattern table, more than ~10 lines): hand to the real installed `create-skill` capability and run its draft / test / iterate loop.
- `tune description: <skill path>` (the skill exists but didn't trigger when it should have): hand to the installed `create-skill` and run its description-optimization loop.
- `new skill via create-skill: <kebab-name>`: hand creation to the installed `create-skill`. Do not invent the shape ad hoc.

If your environment ships a SKILL.md validator, run it on every touched skill before declaring done. Skip this step if it doesn't.

## 6. Summarize for the user

Short list, no preamble:

- Edits applied: `<skill path>`. What changed, one line each.
- New skills created: `<skill path>`. One line each (rare).
- Backlog filed to the devex tracker: `<issue title>` (`<tags>`). One line each.
- Dropped: one line per rejected finding + reason from the synthesizer.

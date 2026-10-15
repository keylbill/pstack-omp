---
name: create-skill
description: Author or revise a complete OMP skill with a precise trigger, source-backed procedure, runnable helpers, and progressive references. Use when writing agent-facing SKILL.md files or porting a skill to OMP.
---

# Create an OMP skill

This replaces the host-specific built-in authoring dependency used by upstream pstack. It authors real file-backed OMP capabilities, not placeholders or a second engineering workflow. Read `omp://skills.md` when the native discovery/frontmatter contract is missing or stale in context. Follow `skill://poteto-mode/playbooks/authoring-a-skill.md` for the surrounding pstack workflow and `skill://poteto-mode/references/omp-runtime.md` for native execution.

## Define the capability

Name the concrete problem, intended reader, observed trigger, prerequisites, owning scope, and outcome. Derive them from the current source, tool contract, or a proven run. A useful skill contains non-obvious reusable technical knowledge; do not turn a single task log, generic itinerary, or repeated instruction into another authority. Prefer extending the existing owner when the capability already exists.

Ask only for a material preference that tools and repository context cannot settle. A request to author a skill authorizes that scoped change, not publishing it, installing accounts, changing security, or creating unrelated policy.

## Choose its home

- Project capability: `.omp/skills/<name>/SKILL.md`, or the repository's established discovered skill root. Use one owner, not duplicate copies in several providers.
- Authored user capability: `~/.omp/agent/skills/<name>/SKILL.md`, with the user's authority.
- Reusable auto-learned procedure: native `manage_skill` (or `learn` with its managed-skill option). Never edit user-authored skills through managed-skill tooling.
- Existing pstack component: edit its owning file in a separate source checkout, not the managed installed package. Keep the pinned upstream checkout immutable and update public provenance for reviewed upstream changes.

Native discovery scans one directory level below a skills root. Use a lowercase kebab-case name equal to the directory. Do not put a slash in frontmatter names. Project/user precedence and namespaced collision handling come from the current OMP docs; do not silently shadow an unrelated skill.

## Write for a cold agent

Keep the entrypoint short enough to route correctly and complete enough to execute. Start with valid YAML frontmatter containing `name` and `description`. The description names what the capability does and when to read it. Use `disable-model-invocation: true` only for explicitly invoked capabilities; hiding is not disabling, and `alwaysApply`/`globs` are not native automatic invocation controls.

The body states prerequisites, exact owner paths or native URIs, ordered actions, decision criteria, genuine failure behavior, observable acceptance evidence, and teardown where needed. Write imperatives with concrete APIs and schemas. Separate requirements from examples; label external integration requirements rather than invent host tools. Never include credentials, production transcripts, protected numbers, raw provider payloads, or private screenshots.

Move detailed reference material to `references/` and executable helpers to `scripts/` only when they materially reduce entrypoint load. Link each needed asset from the body and show each helper's invocation, inputs, outputs, working directory, and exit/error semantics. Resolve relative paths against the skill directory. Do not leave placeholders, unsupported fields, fake fallbacks, dead links, or a helper whose caller must reverse-engineer it.

Use the installed `unslop` and `technical-writing` capabilities for prose. Encode stable invariants in structure or the real owning runtime when that is more reliable than another paragraph. Keep specialist knowledge separate from workflow, authorization, and repository domain policy.

## Prove discovery and behavior

At a meaningful editing boundary, start a fresh OMP session and verify the effective catalog includes the exact name and source. Registry-oriented `omp skill list` alone does not prove local discovery. Native `/skill:<name>` and `skill://<name>` must resolve the same installed capability; if the entrypoint is hidden, direct invocation still works.

Exercise the capability's real workflow or helper, not just its presence. A verification skill runs launch, doctor, one mapped user path, evidence capture, and teardown. A procedure skill performs its actual bounded procedure on disposable, authorized inputs. Check failure boundaries that are uncertain; do not add permanent wording, copy, or wiring tests. Use native tools and retain the concrete evidence.

Apply the authoring playbook's evaluation requirements before promoting a behavioral change. Report installed scope, observed behavior, and real missing prerequisites. Do not claim integrations were provisioned merely because their instructions were written.

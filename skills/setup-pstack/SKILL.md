---
name: setup-pstack
description: Configure pstack's native OMP model roles, reasoning budget, and panel sizes from authenticated available models. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Run `/pstack status` first and use its reported `configurationPath` as the sole file for pstack's role and panel choices. Do not derive it from the skill or package directory. Native `modelRoles` in the effective OMP config owns concrete selectors. Read `skill://poteto-mode/references/omp-runtime.md` first. Do not write a Cursor rule or duplicate an always-applied workflow.

The native `pstack` package must be registered and enabled (`omp plugin list --json`). Install from `github:keylbill/pstack-omp#main` and upgrade with `omp plugin upgrade pstack`. The manifest loads `extensions/pstack.js` and conventional package skills and agents without standalone discovery links. Updating OMP itself is independent of model setup.

## Steps

### 1. Detect available models

Enumerate authenticated models through `/pstack models`, OMP's RPC `get_available_models`, or an authorized extension's read-only `ctx.models.list()`. RPC clients negotiate protocol v2 before a large catalog response. Use each model's `thinking.efforts` or live `get_available_thinking_levels` for supported reasoning levels. Resolve native aliases through the effective OMP settings or `ctx.models.resolve()`. Resolution identifies the model, not the effort selected by a child. Missing authentication, roles, or models are named prerequisites. Report every unavailable choice and never substitute another model.

`/pstack models` reports the authenticated native catalog and supported efforts even when role configuration is missing, invalid, or unreadable. An empty catalog is a missing authentication or model prerequisite, not permission to invent choices. No temporary role configuration is needed to inspect the catalog.

### 2. Load current state

Read the complete latest file at the reported `configurationPath` before planning a change. Its `budget` and `roles` are the current choices. Only a confirmed missing file permits the new-file shape in step 5. An unreadable file needs access restored. Invalid content needs inspection and explicit repair confirmation, not replacement with defaults. Resolve aliases through OMP's user-owned settings. Preserve unrelated pstack choices and native `modelRoles`. Do not rewrite native model assignments.

### 3. Budget, map, and confirm

**(a) Ask for a budget.** Prefer native `ask` over free text. Name the current budget and role assignments. With no existing file, explain that the author's default budget is `large`, while native role aliases keep user-owned model assignments until a budget is explicitly selected. Offer these budget labels.

- `unlimited` targets `max` reasoning.
- `large` targets `xhigh` reasoning.
- `medium` targets `high` reasoning.
- `small` targets `medium` reasoning.

An explicitly selected budget alone applies its prescription across pstack-owned role selections. Do not ask separately which roles it covers or which effort level is wanted. A stored budget alone, without an explicit selection in this run, applies nothing. Keep only this budget question plus the role-mapping confirmation in (c), and a conflict question when a genuinely changed choice collides.

**(b) Apply it.** Start from the current table and retain deliberate alias, family, panel, and parent choices. An explicitly selected `unlimited`, `large`, `medium`, or `small` targets every native role alias, panel entries included, at `max`, `xhigh`, `high`, or `medium`. A stored budget alone applies nothing. An upgrade or re-run without an explicit new budget preserves existing effort overrides.

OMP effort is a `:level` suffix on the alias, not part of the model family name. Resolve each selected alias through the effective OMP settings or `ctx.models.resolve()`. Read its advertised `thinking.efforts` or live `get_available_thinking_levels`. Select the highest supported effort at or below the target on `max > xhigh > high > medium > low > minimal`. Use those public native sources rather than a duplicate resolver or hardcoded model capability table. For example, an explicit `unlimited` selection raises a supported `xhigh` override to `max`. A model advertising only up to `xhigh` stays at `xhigh`. Treat `off`, `auto`, and `inherit` as native selector controls, not budget ladder entries.

Keep the override only in `models.json`. Never mutate shared native `modelRoles`. Do not change the model family or provider or introduce budget-specific native aliases. Do not force an effort when no explicit budget was chosen. Do not prescribe a provider or concrete model. Leave `inherit-parent` and `auto` unchanged with no suffix. A bare explicit `@default` without a suffix carries the live parent effort, while `@default:<level>` overrides it for that role. Model-kind roles do not use chat thinking suffixes. A model with no supported effort at or below the target needs a choice in the role-mapping confirmation. Report that role and stop that change until resolved. Never substitute another model or family and never add retry fallback. Do not downgrade unrelated native roles that share a model.

Upstream `fast` slug guidance does not create an OMP selector suffix or per-task speed field. Preserve configured service tiers. OMP uses `task.agentServiceTierOverrides[agentName]` before `tier.subagent`, and `/fast` changes the live parent tier. Never change these shared settings to implement a pstack budget or one helper's speed request. A requested speed that the current native interface cannot express is a named prerequisite, not a fabricated task field.

**(c) Show the roles and confirm.** Show every role's alias, resolved model, configured effort, and any unavailable choice. Ask whether to accept or change specific pstack roles. Accept any valid configured native alias accepted by the OMP resolver, with no built-in-name allowlist. The defaults remain `@task`, `@slow`, and `@smol`. Other valid examples include `@plan`, `@tiny`, `@review_alt`, `@default`, and custom configured names, plus `inherit-parent` and `auto`. Add a `:effort` suffix only where the resolved model advertises support. Model-kind roles do not use chat thinking suffixes. Concrete model assignments remain user-owned native settings. Panel roles `arena runners`, `arena cross-judge pool`, `architect runners`, and `interrogate reviewers` hold arrays. One native task item runs per panel entry. Arena chooses one configured cross-judge pool entry, preferring a family different from the parent's when available. `swarm workers` supplies each worker's selector unless a comparison explicitly names its arms. Before dispatch, register each helper with `pstack_plan` using its scalar role name and, for panel roles, its zero-based `panelIndex`. Match each session-unique helper name exactly to the native task item name. Never send a `model` field in `task`. Preserve distinct-family panel choices where native resolution confirms them. Report missing choices rather than inventing access to another family.

### 4. Validate

Keep `schemaVersion` at `1`. Each role holds one resolver-valid native alias or a panel array of aliases, with a supported `:effort` suffix only where the resolved model advertises it. There is no built-in-name allowlist. Stored `inherit-parent` and `auto` carry no suffix. The routing hook normalizes them to explicit `@default` internally. Register named helpers through `pstack_plan` before the native task batch, without a `model` field in task items. Resolve and validate every selected alias and panel entry through OMP. If a role, alias, model, or requested effort is missing, unresolvable, or unavailable, report the unresolved choice and stop that change. Never substitute a model or add retry fallback.

### 5. Write the native configuration

Immediately before writing, run `/pstack status` again and read the latest file at its effective `configurationPath`. If that path changed, stop and confirm the intended native profile. Apply only the confirmed budget and role changes to the current object. For a missing file, recheck that it is still missing and create only its parent directory and the confirmed configuration. Write alias `:effort` overrides only in this pstack file. Never write into the managed package tree or mutate shared native `modelRoles`. Preserve later independent changes and unrelated fields. If the same choice changed meanwhile, show the conflict and confirm that choice again. Write with native file tools. Preserve the global and project configuration and no-fallback policy. Re-runs with the same approved changes are idempotent. New-file shape:

```json
{
  "schemaVersion": 1,
  "budget": "large",
  "roles": {
    "feature, refactoring": "@task",
    "bug-fix": "@task",
    "perf-issue": "@task",
    "hillclimb": "@task",
    "judgment and prose": "@slow",
    "hardest tasks": "@slow",
    "how explorer": "@smol",
    "how explainer": "@slow",
    "why investigators": "@smol",
    "why synthesizer": "@slow",
    "reflect tooling": "@task",
    "reflect judgment, divergent, synthesizer": "@slow",
    "arena runners": ["@slow", "@task"],
    "arena cross-judge pool": ["@slow", "@task"],
    "swarm workers": "@task",
    "architect runners": ["@slow", "@task"],
    "interrogate reviewers": ["@slow", "@task"]
  }
}
```

Native OMP settings own model families and default effort. The default table prescribes no provider, concrete model, or effort override. Only an explicitly selected budget prescribes an override.

### 6. Confirm

Run `/pstack models` again to validate the written choices. Report aliases, resolved models, configured effort, panel counts, and the files changed. A model-only `resolve()` result does not prove child effort. Use actual child `resolvedModel` and `resolvedThinkingLevel` when claiming dispatch verification. Every router reads the latest pstack role table at dispatch. Restart OMP after editing its system template or extension.

### 7. Offer a verification skill (optional)

Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once: "want a project-local verification skill, so agents can drive the app the way a user does and prove changes work? I can generate one with /create-verification-skill." On yes, invoke `/create-verification-skill` (resolves wherever pstack is installed: workspace, user, or plugin). On no, move on without pushing.

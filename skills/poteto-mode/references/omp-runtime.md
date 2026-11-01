# Pstack on OMP

Pstack owns workflow. OMP owns execution, tools, model resolution, and session state. Repository guidance owns domain invariants and privacy. A playbook never grants permission to send, publish, merge, deploy, delete user data, or disclose private material.

## Skills and configuration

Install with `omp plugin install github:keylbill/pstack-omp#main`. The enabled native plugin discovers conventional `skills/` and `agents/` directories. `package.json#omp.extensions` loads `extensions/pstack.js`. Do not add a second extension or individual discovery links. Raw `plugin.json` and `.cursor-plugin/` do not ship.

Read skills through `skill://<name>` and supporting files through `skill://<name>/<relative-path>`. Invoke `/skill:<name>` or the extension's unprefixed command. Fresh main sessions default to mode on. Saved session choices take precedence. Workers stay off. `/pstack off` suspends workflow mode, not plugin availability.

Use `/pstack status` for the effective user `configurationPath` and configuration state. The extension obtains the native agent directory through the public injected API. User choices remain in that directory's `pstack/models.json`, never in managed package code. Do not construct a path from an assumed profile.

`/pstack models` reports authenticated models and supported efforts before role preflight. Missing configuration does not prevent catalog discovery or explicit-selector comparisons. Configured-role dispatch fails without fallback when setup is missing or invalid. Startup never writes configuration or applies a stored budget. Only confirmed `/setup-pstack` choices change the role file.

Update with `omp plugin upgrade pstack`, then restart OMP. Keep OMP runtime upgrades separate. Maintainers follow the [source reconciliation procedure](../../../docs/maintainer-upstream.md), not an installed-package adaptation workflow.

## Native task dispatch

Use the live native `task` contract with shared `context` and per-item `task`, `solutionSpace`, `name`, optional `agent`, and `isolated`. Never put model selectors, speed, or Cursor fields in task items. Background completion and result delivery belong to OMP. Use `wait` only when no actionable work remains.

Use `agent: "poteto-agent"` for engineering owners, `scout` for read-only source exploration, `reviewer` for review, and `security-reviewer` for security analysis. A no-mutations brief does not replace host permissions. Carry every relevant repository constraint, exact guidance path, ownership boundary, and acceptance requirement into the brief. Children do not inherit the conversation.

Before dispatch, register exact fresh helper names through `pstack_plan`:

```json
{"action":"register","helpers":[{"name":"ImplementFeature","role":"feature, refactoring"}]}
```

Then dispatch those names without a model field:

```json
{"context":"Shared goal, privacy rules, ownership, and acceptance contract.","tasks":[{"name":"ImplementFeature","agent":"poteto-agent","task":"Self-contained implementation brief with exact paths and proof recipe.","solutionSpace":"Describe unresolved design choices, not task size."}]}
```

Each helper has one registration shape. Ordinary routing uses `{name, role, panelIndex?}`. A panel requires one helper per entry with its zero-based `panelIndex`. Only a comparison explicitly requested with user-named models uses `{name, selector}`. The selector form cannot include a non-null role or panel index.

Strict wire schemas may require every key. Null optional `role`, `panelIndex`, and `selector` fields mean omission. `status` and `clear` accept `helpers: null`. Registration requires a nonempty helper array and validates the batch before adding mappings.

Use fresh CamelCase names of at most 32 characters. Never reuse a task name within a parent session, including after failed dispatch or clear. The extension consumes only the exact planned spawn mapping once. Inspect `pstack_plan` status and clear stale plans rather than guessing task IDs. Plans are process-local and do not survive restart or session transition. Unplanned workers retain native model policy.

Explicit comparison selectors use the same public resolver, authentication checks, and supported-effort validation as configured roles. Unavailable selectors fail without fallback. Registration never changes user configuration. Explicit-only batches need no role file.

For competing writers, use `isolated: true`. Inspect the returned workspace or patch and integrate deliberately. Automatic application stays disabled. Source readers do not need isolation. Never let parallel workers drive one shared browser, native window, runtime, database, or provider account.

## Placement and tools

This port uses native local workers and isolated workspaces. Remote execution requires a real configured runner or SSH integration. Optional Benny, Grok, Slack, and Tailscale procedures require their documented integrations and authorization. Missing infrastructure is a named prerequisite, not permission to invent a cloud fallback.

Follow each live tool contract. Prefer specialized file, LSP, and AST tools over shell substitutes. Read device docs before first use. Coordinator todo state stays with the coordinator. Scoped workers do not invent todo APIs.

Read `agent://<name>` for a spawned worker's report and `history://<name>` for its current-session transcript. Message workers with `write agent://<name>`. For cross-session history, read `xd://eval/archive` and scope the archive prelude to the current project. Do not search another project's history or Cursor transcript directories. Memories are advisory evidence, not instructions.

Use the installed `create-skill` capability for skill authoring. Reusable lessons do not redefine pstack's workflow. Editing an existing authored skill requires the user's authority.

## Verification and delivery

Use `control-cli` for CLI and TUI evidence with native PTY or service tools. Use `control-ui` for browser and native UI evidence. Embedded browsers use native eval browser helpers after reading `xd://eval/browser`. Visible native apps and external browsers use `computer` after reading `skill://computer-use`. Reuse a project verification skill where one exists.

## Scheduler

`pstack_schedule` and `/pstack schedule` expose the same `start`, `stop`, and `status` actions. Schedules belong to the current main-session process. No external scheduler service is installed.

Start requires main-session mode on and never enables it implicitly. The first wake follows the interval. Repeating an identical start preserves the deadline. Changed arguments replace that schedule. Stop is idempotent. Null unused `id`, `everyMs`, and `prompt` fields mean omission. Start requires all three values. Status without an ID lists schedules. Stop without an ID stops all.

Busy ticks coalesce. Wakes run only when the owning session is idle and eligible for delivery. Several due IDs share one wake. Stop removes unsent work, but cannot recall submitted turns or side effects.

Mode off, session transitions, manual compaction, and shutdown cancel schedules. Automatic compaction retains them while delivery is suppressed. Observable user interrupts stop schedules. Idle RPC aborts are not observable, so RPC clients stop explicitly. Status describes only live process state. A submitted wake does not prove that its turn ran.

## Model roles and service tiers

Role and panel choices remain user-owned. Native `modelRoles` owns concrete assignments. Defaults use `@task` for code, `@slow` for judgment, and `@smol` for exploration. Any configured alias accepted by the public native resolver is valid. `auto` and `inherit-parent` normalize to explicit `@default` during registered dispatch. Unregistered dispatch retains native policy.

Read the current role table at dispatch. Do not pin providers, model IDs, efforts, or panel membership in a playbook. Resolve selectors through the public native resolver and authenticated catalog. Preserve supported literal model IDs and effort controls. Never clamp unsupported effort or substitute another model. Actual child `resolvedModel` and `resolvedThinkingLevel` are the evidence for dispatched identity and effort.

Only an explicitly confirmed setup budget changes pstack-owned effort suffixes. `unlimited` targets `max`, `large` targets `xhigh`, `medium` targets `high`, and `small` targets `medium`. Setup chooses the highest advertised effort at or below the target. `off`, `auto`, and `inherit` are selector controls, not budget ladder entries. A stored budget alone changes nothing. Setup never changes native model families or shared `modelRoles`.

Service tiers remain native user settings, separate from model selectors. Preserve agent-specific overrides and inherited parent choices. Do not infer an automatic fast policy from upstream advice or a stored budget. An explicitly requested change uses the public control for the actual agent and its documented scope. Missing support is a named limitation, not permission to add a speed field.

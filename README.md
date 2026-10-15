# pstack on OMP

pstack is an engineering workflow for investigating deeply, making focused changes, and delegating work with explicit verification. `/poteto-mode` matches your task to a playbook and runs the supporting skills.

This is [keylbill's native OMP adaptation](https://github.com/keylbill/pstack-omp) of [Lauren Tan's pstack](https://github.com/cursor/plugins/tree/main/pstack). It preserves the complete author workflows, supporting skills, worker profiles, guide, assets, and dormant Benny automation pack. It is not an official Cursor release.

The native package name is `pstack`. This repository is `pstack-omp`. Adapted release `0.15.25-omp.1` is based on upstream `0.15.25`. [Public provenance](./upstream.json) pins the exact source and team-kit dependencies.

## Install and configure

Use OMP 18.11 or later with the public extension APIs, and put Git on `PATH`. The standalone OMP executable embeds Bun for plugin package installation. That does not provide a `bun` command for authored helper programs. Install standalone Bun separately when a playbook invokes its Bun helpers. Node.js 22 or later runs the package checks and Node helper programs. Optional integrations need their own authenticated tools and authorization.

Author Bun helpers lazily install their frozen dependencies into the bundled helper's `node_modules` directory when invoked. This is disposable dependency material, not user configuration. An upgrade may rebuild it. Plugin installation and startup do not run the helper bootstrap.

```sh
omp plugin install github:keylbill/pstack-omp#main
omp plugin list --json
omp
```

In the fresh session, run the following commands.

```text
/pstack status
/pstack models
/setup-pstack
```

`status` reports the effective user `configurationPath` and distinguishes missing, valid-schema, invalid, and unreadable files. `models` reports authenticated native models and supported efforts even before configuration exists. Schema validity does not prove authentication or dispatch readiness.

`/setup-pstack` confirms your budget and role mappings before writing the external user file. No live `models.json` ships in this repository. The file lives at `<pi.pi.getAgentDir()>/pstack/models.json`, outside managed package code. The default profile commonly uses `~/.omp/agent/pstack/models.json`; use the reported path rather than constructing it. Native profiles and configuration-root overrides determine the effective directory.

Missing configuration does not prevent catalog loading. Configured-role dispatch fails with a setup diagnostic and no fallback. Startup creates no settings and applies no budget. Explicit-selector-only comparisons remain available without a role table.

Concrete models belong to your native `modelRoles`. Pstack owns only its external role and panel choices. Preserve deliberate model families, efforts, panel membership, and service tiers. A stored budget alone changes nothing.

Fresh main sessions start with mode on. Workers stay off. Saved branch choices take precedence. `/pstack off` suspends workflow mode for the branch; `/pstack on` or `/poteto-mode` enables it. `/skill:<name>` works independently of mode. Host permissions and repository privacy always apply.

For an existing manual or local-link setup, follow [Migrate an existing installation](./docs/migrate-existing-installation.md) before replacing it. Preserve your model choices and remove only verified pstack-owned activation.

Read the [guide](./docs/guide/README.md), or ask [`/poteto-help`](./skills/poteto-help/SKILL.md) for a recommendation without starting work.
## Usage

Use [`/poteto-mode`](./skills/poteto-mode/SKILL.md) at the start of a task. It matches your request to a playbook and runs the other skills as needed. `/skill:poteto-mode` invokes the same skill for that task but does not change sticky mode; `/poteto-mode` and `/pstack on` do. Every core skill also has a bare alias (`/how`, `/why`, etc.).

### Native plugin availability

```sh
omp plugin disable pstack
omp plugin enable pstack
```

Restart OMP after availability changes. `list` reports registration, not complete runtime proof. Confirm `/pstack status`, `/skill:poteto-mode`, and the bundled worker profiles in a fresh session. Disabling the plugin removes capabilities from new sessions; `/pstack off` only suspends workflow mode. Do not load a second copy with `-e` or individual discovery links.

### Start the compatible runtime

Launch your current OMP executable and check its version in the running terminal. The adapter uses public native extension APIs, not a patched or pinned OMP build. Reverify affected behavior after a breaking OMP update.

```sh
omp
```

Restart the compatible runtime after installation so it reloads the extension, roles, agents, and skill catalog. OMP uses its native built-in system prompt; this package ships no `SYSTEM_TEMPLATE.md` override. Use `/pstack status` to inspect installed aliases, then `/pstack models` for authenticated role preflight.

### Schedule recurring work

Turn pstack on, then start a named audit or heartbeat with its interval in milliseconds and complete prompt.

```text
/pstack on
/pstack schedule start audit 3600000 Re-read the installed execution playbook and audit active owners.
/pstack schedule status
/pstack schedule stop audit
```

Schedules run only while this OMP process is alive. They coalesce missed ticks while busy and never rearm from history. Explicit stop, mode-off, session transitions, manual compaction, and shutdown cancel future wakes. Automatic compaction retains schedules. Idle RPC aborts are not observable by the extension, so clients use explicit schedule-stop. Cancellation cannot recall already submitted or started work. The native `pstack_schedule` tool exposes the same start, stop, and status actions.

### Update pstack

```sh
omp plugin upgrade pstack
```

Restart OMP after the upgrade. The native manager refreshes the recorded Git ref and preserves enablement and feature selection. With `#main`, it tracks the moving branch. Fixed tags and commits stay fixed. Bare `omp plugin upgrade` is not a substitute for the named command. Local source links cannot use native upgrade.

The external configuration survives managed package replacement. An upgrade never applies a stored budget or replaces deliberate model choices. Required role changes go through confirmed `/setup-pstack`, not upstream defaults.

`/pstack update check` inspects the recorded recipient Git ref without installed writes. `/pstack update` requests the bounded native upgrade workflow. These agent-assisted commands may cost model calls. No background updater runs.

Maintainers use the separate [upstream reconciliation procedure](./docs/maintainer-upstream.md). Keep pinned raw source, adapted source, and new upstream source distinct. Do not port Cursor changes into a recipient's managed dependency tree.

Installing or upgrading the native package does not advance the upstream author pin. Read the [recipient update procedure](./skills/poteto-mode/references/upstream-update.md) for scope, prerequisites, and failure behavior.

### Just use [`/poteto-mode`](./skills/poteto-mode/SKILL.md)

This skill is the main shortcut. It comes with twenty-three playbooks:

```text
/poteto-mode this pr has a subtle bug where the scroll drifts every 750ms even when idle. repro
first, then fix and verify.
```

```text
/poteto-mode i'm going to bed. land the stack even if ci flakes. i want everything merged by
morning.
```

<details>
<summary>the twenty-three playbooks</summary>

| playbook | for |
|---|---|
| [investigation](./skills/poteto-mode/playbooks/investigation.md) | a read-only question. how does x work, why was y built this way, are we sure. |
| [bug fix](./skills/poteto-mode/playbooks/bug-fix.md) | reproduce a defect, root-cause it, and fix with runtime evidence. |
| [perf](./skills/poteto-mode/playbooks/perf-issue.md) | trace a measured slowness and improve it against a baseline. |
| [hillclimb](./skills/poteto-mode/playbooks/hillclimb.md) | sustained, scientific improvement of one metric against a target, looping hypotheses with before/after measurement and one commit per accepted win. |
| [runtime forensics](./skills/poteto-mode/playbooks/runtime-forensics.md) | diagnose a live symptom (leak, idle-cpu spin, glitch) from instrumentation. |
| [trace forensics](./skills/poteto-mode/playbooks/trace-forensics.md) | diagnose a captured profiling artifact (cpuprofile, trace, spindump, heap snapshot). |
| [feature](./skills/poteto-mode/playbooks/feature.md) | new or changed behavior, built from a named data shape. |
| [refactoring](./skills/poteto-mode/playbooks/refactoring.md) | a behavior-preserving change to structure or shape. |
| [prototype](./skills/poteto-mode/playbooks/prototype.md) | a throwaway sketch to make a design or behavioral decision cheaply, or to settle an empirical fork by observing it. |
| [visual parity](./skills/poteto-mode/playbooks/visual-parity.md) | pixel-exact ui equivalence between two implementations. |
| [authoring a skill](./skills/poteto-mode/playbooks/authoring-a-skill.md) | writing or editing a SKILL.md. |
| [eval](./skills/poteto-mode/playbooks/eval.md) | test how a skill or prompt change affects agent behavior, blinded. |
| [babysit](./skills/poteto-mode/playbooks/babysit.md) | drive a pr or a stack to merge-ready: conflicts, review threads, ci. |
| [shipping](./skills/poteto-mode/playbooks/shipping.md) | independently verify a green stack, then land the contiguous verified run bottom-up through `gh` by default or Origin when its CLI is available. |
| [autonomous run](./skills/poteto-mode/playbooks/autonomous-run.md) | drive a long task to completion without stopping. A blocked external action never blocks independent work. |
| [orchestrate](./skills/poteto-mode/playbooks/orchestrate.md) | a standing project handed to one coordinator chat: multi-day, many stacked prs, fleets of subagents. |
| [autopilot-full](./skills/poteto-mode/playbooks/autopilot-full.md) | run independent prs to merged with one owner per pr and a root swarm verdict on each round, from the code-ready head on. |
| [autopilot-stack](./skills/poteto-mode/playbooks/autopilot-stack.md) | build and verify one linear base-branch stack for the operator to review and land. |
| [session pickup](./skills/poteto-mode/playbooks/session-pickup.md) | resume or take over a prior agent's in-flight work (scoped OMP history, a real remote-agent artifact, or a pushed branch). |
| [pause safely](./skills/poteto-mode/playbooks/pause-safely.md) | suspend in-flight work cleanly so it can be resumed later. |
| [multi-phase plan](./skills/poteto-mode/playbooks/multi-phase-plan.md) | work that spans phases or stacked PRs. |
| [worktree cleanup](./skills/poteto-mode/playbooks/worktree-cleanup.md) | reclaim disk by pruning merged or abandoned worktrees and stale ios simulators, safety-gated. |
| [opening a pr](./skills/poteto-mode/playbooks/opening-a-pr.md) | open a ready pr from small ordered commits with a conventional commits title and a briefing-style body. invoked at the end of every other playbook. |

</details>

When invoked it:

1. matches your task to a [playbook](./skills/poteto-mode/playbooks/) and opens a todo list whose first items are its steps, copied in verbatim.
2. routes to the other skills as the steps fire. Before each native `task` batch, register helpers through `pstack_plan` with `{"action":"register","helpers":[{"name":"UniqueCamelCase","role":"bug-fix"}]}`. Each helper has one scalar role name and a zero-based `panelIndex` for a panel seat. Names must exactly match task item names and never be reused within the session. Native task items use `{name, agent?, task, solutionSpace, isolated?}`, with no `model` field. The registration tool reads the latest user-owned role table and validates selectors through OMP. The hook consumes each matching planned `spawnKey` once and normalizes `auto` and `inherit-parent` to explicit `@default` internally. Use `pstack_plan` actions `status` and `clear` to inspect or discard pending registrations. Engineering owners use `poteto-agent`, read-only explorers use `scout`, and reviewers use `reviewer` or `security-reviewer`. Workers are local native OMP workers in exclusive isolated workspaces where requested, never pretend-cloud VMs.
3. writes unslopped replies framed for the consumer and the maintainer, naming each principle that shaped a decision and the specific choice it changed.

The full rules and playbooks live in [`skills/poteto-mode/SKILL.md`](./skills/poteto-mode/SKILL.md), with host execution, model, history, and safety contracts in [`skills/poteto-mode/references/omp-runtime.md`](./skills/poteto-mode/references/omp-runtime.md).

[`/poteto-mode`](./skills/poteto-mode/SKILL.md) is also a sticky mode: once entered it stays on across turns, applying itself when a playbook matches or the task needs rigor and staying out of the way otherwise. Opt out for the session with `/pstack off` (or by saying so); re-enter with `/pstack on` or `/poteto-mode`.
## Skills

[`/poteto-mode`](./skills/poteto-mode/SKILL.md) runs most of these for you when a step needs them. The table below is for direct use. The port also ships the real dependency skills `deslop`, `control-cli`, `control-ui`, and `create-skill`.

```text
/how do we cancel runs? do we have an n+1 when we look up every run to cancel?
```

```text
/interrogate review this pr.
```

<details>
<summary>all skills</summary>

| skill | use it when |
|---|---|
| [`/poteto-mode`](./skills/poteto-mode/SKILL.md) | default entry point for any non-trivial task. |
| [`/poteto-help`](./skills/poteto-help/SKILL.md) | recommend a skill, playbook, or principle without starting the work. |
| [`/in-your-own-words`](./skills/in-your-own-words/SKILL.md) | restate your goal and problem before starting, only when explicitly requested. |
| [`/sharpen`](./skills/sharpen/SKILL.md) | improve the approach to your actual goal without overspecifying implementation. |
| [`/ketchup`](./skills/ketchup/SKILL.md) | summarize what changed since your last message with the evidence you need to judge it. |
| [`/how`](./skills/how/SKILL.md) | you want a walkthrough of how a subsystem works. |
| [`/why`](./skills/why/SKILL.md) | you want to know why something was built this way. Discovers actually-mounted `xd://` evidence tools at run time and queries each evidence category in parallel (source control, issue tracker, long-form docs, real-time chat, infra observability, error tracking, analytics warehouse), adapted from the per-source example playbooks. |
| [`/recall`](./skills/recall/SKILL.md) | you're starting or resuming work and want your recent context rebuilt from your own project-scoped history (native archive prelude, live `history://` for spawned agents) and the shared record, handed back as a tight current-state brief. Never another project's material. |
| [`/blast-radius`](./skills/blast-radius/SKILL.md) | you have a small-looking change and want to know what else it could break, with the one fact it's safe because of proven by running code, not asserted. |
| [`/architect`](./skills/architect/SKILL.md) | you're about to write code that crosses a function boundary and want the caller's usage, types, and module shape settled first. |
| [`/arena`](./skills/arena/SKILL.md) | you want N parallel attempts at the same thing, then to grab the best parts of each. Competing writers run isolated; the native plugin keeps automatic application disabled, so you inspect and integrate deliberately. |
| [`/swarm`](./skills/swarm/SKILL.md) | you want N parallel workers across different slices or races, then one aggregated report. |
| [`/interrogate`](./skills/interrogate/SKILL.md) | you have a diff and want several different models to try to break it, including a strict code-quality lens. |
| [`/automate-me`](./skills/automate-me/SKILL.md) | you want your own `-mode` skill, drafted from how you've actually worked. |
| [`/make-bot-ui`](./skills/make-bot-ui/SKILL.md) | you want a page whose buttons wake a real Grok Bot webhook routine, including the sender-key handoff and optional tailnet exposure. The Grok routine, webhook, credential handoff, and Tailscale are real external prerequisites requiring your explicit authorization; nothing is provisioned by installation. |
| [`/setup-pstack`](./skills/setup-pstack/SKILL.md) | you want to pick which models pstack uses per role. Detects your authenticated available models and writes [`models.json`](./models.json). Native `modelRoles` in the effective OMP config owns concrete selectors. |
| [`/reflect`](./skills/reflect/SKILL.md) | a long task landed and you want the recipe captured as a skill edit. |
| [`/correct`](./skills/correct/SKILL.md) | you keep correcting agents for the same mistakes. mines history for mistake classes, fixes each at the highest level that works (architecture, then types, lint, and ci, then tests, with docs last), and keeps a table pairing each rule with what enforces it. |
| [`/teach`](./skills/teach/SKILL.md) | you want to actually understand a change or subsystem, not just have it summarized. runs how + why and weaves one plain explanation, built up diagram by diagram. |
| [`/tdd`](./skills/tdd/SKILL.md) | you're fixing a bug and there's a cheap local test path. write the failing test first, then the fix. |
| [`/benchmark-checklist`](./skills/benchmark-checklist/SKILL.md) | you ran a benchmark or measured a speedup or regression. vets the number (limiter, tuning, errors, repeat runs, end-to-end relevance) before you report or act on it. |
| [`/no-comments`](./skills/no-comments/SKILL.md) | strip comments before review; spawns Comment Sicko, fixes accepted findings, offers encodings for claimed constraints. |
| [`/typescript-best-practices`](./skills/typescript-best-practices/SKILL.md) | you're reading or editing typescript. grounds the type-system-discipline principle in syntax. |
| [`/figure-it-out`](./skills/figure-it-out/SKILL.md) | no bundled playbook fits. designs a rigorous, auditable playbook for the task. |
| [`/show-me-your-work`](./skills/show-me-your-work/SKILL.md) | you want a reviewable decision trail. logs decisions to a tsv you can commit. |
| [`/create-verification-skill`](./skills/create-verification-skill/SKILL.md) | your project has no scripted way to prove app behavior. generates a project-local verify skill with a feature map, for any language or platform. |
| [`/maintain-verification-skill`](./skills/maintain-verification-skill/SKILL.md) | your verify skill's feature map has drifted from the app. source wave + one live pass, at most one PR of proven corrections. |
| [`/unslop`](./skills/unslop/SKILL.md) | you're cleaning up writing. removes AI tells. |
| [`/bro`](./skills/bro/SKILL.md) | you want the last message restated in plain human language, no jargon. |
| [`/technical-writing`](./skills/technical-writing/SKILL.md) | layered doc standard (Diátaxis + Google developer style + STE + Global English) for docs, RFCs, readmes, PR descriptions, commit messages. |
| [`/deslop`](./skills/deslop/SKILL.md) | dependency skill, now installed natively. Run it (with `/no-comments`) before delivery to strip slop. |
| [`/control-cli`](./skills/control-cli/SKILL.md) | dependency skill, now installed natively. Use for CLI/TUI runtime evidence instead of compilation or self-report. |
| [`/control-ui`](./skills/control-ui/SKILL.md) | dependency skill, now installed natively. Use for browser/native UI runtime evidence (repro twice, before/after) instead of mocks. |
| [`/create-skill`](./skills/create-skill/SKILL.md) | dependency skill, now installed natively. The real OMP skill-authoring capability used by the authoring-a-skill playbook. |

</details>

### Examples

Mostly type [`/poteto-mode`](./skills/poteto-mode/SKILL.md) at the start of a task and let it route to a playbook. The other skills fire as the steps need them. A few are reached for directly.

<details>
<summary>all the examples</summary>

```text
bug fix:           /poteto-mode this pr has a subtle bug where the scroll drifts every 750ms even
                   when idle. repro first, then fix and verify.
perf:              /poteto-mode a big list takes a second or two to load even though we virtualize.
                   run a cpu trace and tell me why.
feature:           /poteto-mode build a small feature behind a feature flag. verify it really works.
prototype:         /poteto-mode build two prototypes of the markdown renderer so we can compare.
                   spawn an agent for each.
multi-phase:       /poteto-mode open source these skills as a plugin. nothing internal leaks, work
                   in a temp dir, show me the dependency graph first.
overnight run:     /poteto-mode i'm going to bed. land the stack even if ci flakes. i want
                   everything merged by morning.
babysit:           /poteto-mode check on pr 123. anything outstanding?
visual parity:     /poteto-mode the row spacing is too tall when this flag is on. the second image
                   is correct. repro and fix until it matches.
figure it out:     /poteto-mode i'm stepping away. migrate every caller from the synchronous store
                   to the new async one, keeping behavior identical. i want to trust it was done
                   right when i'm back.
how:               /how do we cancel runs? do we have an n+1 when we look up every run to cancel?
why:               /why is this feature flag not on yet?
architect:         design this instrumentation to be high signal with no false positives. /architect
                   this first.
arena:             /arena take my prompt to the arena verbatim. i want to compare their proposals
                   with yours.
swarm:             /swarm check every package under packages/ against its check.sh. one worker per
                   package. one report.
interrogate:       /interrogate review this pr.
tdd:               /tdd implement
unslop:            can we unslop and tighten the new changes?
reflect:           /reflect that took too long. capture what we learned so the next run doesn't
                   repeat it.
correct:           /correct
show-me-your-work: /show-me-your-work keep a decision trail i can review when i'm back.
automate-me:       /automate-me
```

</details>
## Agents

pstack ships two agents (both linked into `~/.omp/agent/agents/`):

`/poteto-mode` runs in the session that receives it. That session owns its playbook, coordinator todo list, and helper dispatch. The bundled worker profile wraps delegates. It does not move the parent session into a subagent.

- [`poteto-agent`](./agents/poteto-agent.md) runs the house style end to end. Dispatch it natively as `agent: "poteto-agent"` from a `task` call; it reads `poteto-mode` in full, including its inline principles index, before doing any work. Substituting a generic worker skips that read and drifts.
- [`Comment Sicko`](./agents/comment-sicko.md) is a read-only comment reviewer, usually invoked through [`/no-comments`](./skills/no-comments/SKILL.md), not directly. There is no `subagent_type` field on OMP; use the native `agent` name.

## Principles

Twenty-four short skills, one principle each. `poteto-mode` indexes them inline and reads that index at task start. The standalone files are there so other skills can reference a principle by name, and so the index can point at the full rule for each.

<details>
<summary>all twenty-four principles</summary>

| principle | group | rule |
|---|---|---|
| [laziness-protocol](./skills/principle-laziness-protocol/SKILL.md) | core | Bias toward deletion and the smallest change that solves the problem. |
| [foundational-thinking](./skills/principle-foundational-thinking/SKILL.md) | core | Apply before writing logic: choosing core types and data structures, sequencing scaffold-vs-feature work, asking what concurrent actors share. Get the data structures right so downstream code becomes obvious. |
| [redesign-from-first-principles](./skills/principle-redesign-from-first-principles/SKILL.md) | core | Redesign as if the requirement had been a foundational assumption from day one, instead of bolting it on. |
| [attack-the-premise](./skills/principle-attack-the-premise/SKILL.md) | core | Apply when two or more fixes that share one premise have failed the same gate. Take a census of which actors hold the imbalance before the next fix, then question the premise instead of writing another fix that assumes it. |
| [subtract-before-you-add](./skills/principle-subtract-before-you-add/SKILL.md) | core | Remove dead weight, redundant validators, and stub references first, then build on the simpler base. |
| [minimize-reader-load](./skills/principle-minimize-reader-load/SKILL.md) | core | Count layers between question and answer, and hidden state in the reader's head; collapse one-caller wrappers and shrink mutable scope. |
| [experience-first](./skills/principle-experience-first/SKILL.md) | core | Choose user delight over implementation convenience; ship fewer polished features over more rough ones. |
| [exhaust-the-design-space](./skills/principle-exhaust-the-design-space/SKILL.md) | core | Build 2-3 competing prototypes and compare side by side before committing. |
| [build-the-lever](./skills/principle-build-the-lever/SKILL.md) | core | Apply to any non-trivial work, not just bulk work: edits, migrations, analyses, checks. Build the tool that does it or proves it (codemod, script, generator, or a skill your subagents follow) instead of working by hand. The tool is the artifact a reviewer can rerun. |
| [model-the-domain](./skills/principle-model-the-domain/SKILL.md) | architecture | Encode the domain in a structure instead of scattered conditionals. |
| [boundary-discipline](./skills/principle-boundary-discipline/SKILL.md) | architecture | Concentrate guards at system boundaries (CLI, config, network, external APIs); trust internal types and keep business logic in pure functions. |
| [type-system-discipline](./skills/principle-type-system-discipline/SKILL.md) | architecture | Make illegal states unrepresentable, brand semantic primitives, parse external data at boundaries, refuse to lie to the compiler, exhaust variants, derive from authoritative schemas. |
| [make-operations-idempotent](./skills/principle-make-operations-idempotent/SKILL.md) | architecture | Converge to the same end state regardless of partial prior runs. |
| [migrate-callers-then-delete-legacy-apis](./skills/principle-migrate-callers-then-delete-legacy-apis/SKILL.md) | architecture | Migrate callers and delete the old API in the same wave instead of preserving compatibility layers. |
| [separate-before-serializing-shared-state](./skills/principle-separate-before-serializing-shared-state/SKILL.md) | architecture | Eliminate the sharing first; serialize structurally only when one shared writer is a real invariant. |
| [prove-it-works](./skills/principle-prove-it-works/SKILL.md) | verification | Apply after completing a task, before declaring done. Verify against the real artifact (run the feature, read the actual value, inspect the diff), not a proxy, self-report, or 'it compiles.'. |
| [fix-root-causes](./skills/principle-fix-root-causes/SKILL.md) | verification | Trace each symptom to its root cause and fix it there; reproduce first, ask why until you reach it, resist nil-check guards that silence crashes. |
| [sequence-verifiable-units](./skills/principle-sequence-verifiable-units/SKILL.md) | verification | Apply to multi-step work (sweeps, migrations, runs of similar edits) and to how you stack commits and PRs. Break work into small units that each end in a verifiable state, check each before the next, and order delivery so the sequence proves itself to a reviewer. |
| [test-behavior-not-implementation](./skills/principle-test-behavior-not-implementation/SKILL.md) | verification | Apply when you write, change, or keep a test. Call the code the way its users do and assert the result they observe against a literal expected value. If the test would still pass when every imported function returns undefined, rewrite the assertion or delete the test. |
| [explain-the-number](./skills/principle-explain-the-number/SKILL.md) | verification | Apply before you trust, report, or act on a number you measured: a speedup, a regression, a throughput, a latency, or an eval result. Find what limits it, and rule out that it measured something other than the work you think. |
| [guard-the-context-window](./skills/principle-guard-the-context-window/SKILL.md) | delegation | Route bulk to subagents; keep summaries in the main thread, not raw payloads. |
| [never-block-on-the-human](./skills/principle-never-block-on-the-human/SKILL.md) | delegation | Proceed, present the result, let the human course-correct after the fact; reserve confirmation for irreversible actions. |
| [encode-lessons-in-structure](./skills/principle-encode-lessons-in-structure/SKILL.md) | meta | Encode the rule as a lint, metadata flag, runtime check, or script instead of more text. |

</details>
## Shipped here (native)

Everything the mode references is installed — nothing from the old "not shipped here" list is missing:

- `/deslop` and the `deslop` skill, `control-cli` (CLIs and TUIs), and `control-ui` (browser, Electron, web) are real installed OMP skills in this package, discovered through the enabled native plugin.
- `/create-skill` is the real installed OMP authoring capability in this package — not a host built-in.
- Inside `poteto-mode`, the [babysit playbook](./skills/poteto-mode/playbooks/babysit.md) handles PR-status requests end to end.

## Why are there no planning skills?

By design, not by omission: the author does not believe in planning as a default artifact — the best spec is code. [`/poteto-mode`](./skills/poteto-mode/SKILL.md) covers planning when a task genuinely needs it (multi-phase plans, stacked PRs), but it is not a default.

## Make it yours

`poteto-mode` is the author's style. You may not want exactly that.

Type [`/automate-me`](./skills/automate-me/SKILL.md). It mines your recent project-scoped history, drafts a `<your-name>-mode` skill from how you've actually worked, and routes through pstack underneath. You keep pstack as the base and end up with your own routing skill alongside `poteto-mode`.

Models are configurable too. [`/setup-pstack`](./skills/setup-pstack/SKILL.md) reads your authenticated models and preserves deliberate choices in [`models.json`](./models.json). `@task`, `@slow`, and `@smol` are the initial native selectors. Other configured native aliases are valid choices. `@default`, `inherit-parent`, and `auto` use the live parent model and effort. Panels are arrays with one worker per entry.

`/pstack models` preflights the configured selectors with no fallback. Missing roles or credentials are reported. A resolved model identity alone does not prove the selected effort. Actual child `resolvedModel` and `resolvedThinkingLevel` provide that evidence.

Re-running `/setup-pstack` preserves current choices where valid. Retired roles are removed and reported. Unrelated native OMP roles are never touched.

Choose effort recommendations explicitly during setup. `unlimited` targets `max`, `large` targets `xhigh`, `medium` targets `high`, and `small` targets `medium`, limited to each model's supported efforts. A stored budget does not alter settings. Setup confirms the mapping and writes only pstack-owned role overrides, never native `modelRoles` or service tiers.

For each job, choose the relevant role and panel size before dispatch. A strong parent with cheaper code delegates can reduce spend. Inheriting the parent is a model choice, not a cost guarantee. Native speed is config-only through `task.agentServiceTierOverrides[agentName]` before `tier.subagent`. Inherited tiers snapshot the live parent's `/fast` setting. `/fast` changes that live parent. Do not put speed fields in task items, eval workers, or agent frontmatter. See [setup and cost advice](./docs/guide/01-setup.md#keep-the-cost-in-check).

## Verification and delivery

Verify on the real surface: `control-ui` for browser/native UI (native `browser` helpers or `computer`), `control-cli` for CLI/TUI, or a project verification skill for its feature map where one exists.

## Automations (dormant Benny pack)

pstack ships a dormant [Benny automation pack](./automations/benny/). Benny triages Slack issue reports, then reproduces and fixes confirmed bugs with real UI evidence. Its three internal skills (`reproduce-and-fix-issues`, `setup-benny`, `triage-issue-reports`) intentionally stay dormant and non-slash, per their source setup contract — do not expose them as ordinary commands.

To set it up, point your OMP agent at [`FOR_AGENTS.md`](./automations/benny/FOR_AGENTS.md) and name the target repository. Setup merges the pack into the target at `.omp/automations/benny/`, confirms the shared pstack skills resolve in project scope, and keeps user configuration (and secrets) outside the copied pack. See the pack's [README](./automations/benny/README.md) and `templates/configuration.example.yaml`.

Benny, `make-bot-ui`, and any scheduler-backed routine are gated on real integrations: Slack access, a tracker, a control adapter plus feature map, the Grok webhook routine, optional Tailscale, and a real scheduler/automation host. Absence of any of them is a named prerequisite — finish independent authorized work and stop. Installation provisions no accounts, tokens, webhooks, or exposure, and never autostarts external automations.

## Remove the native package

```sh
omp plugin uninstall pstack
```

Run removal only when authorized, then restart OMP. Native removal manages the plugin registration and installed dependency. The external role file remains user-owned. Do not delete native configuration, credentials, sessions, unrelated skills, or model aliases. This package does not ship machine-specific installation receipts or historical rollback tools.

## Develop the adaptation

Use a separate source checkout. Install development dependencies with `npm install --ignore-scripts`, then run `npm run check`. The checks validate public package boundaries and exercise synthetic routing and scheduler behavior without reading active user configuration. CI runs the same command. Authenticated native dispatch and real Git-install upgrade proof are separate checks.

## Upstream history (Cursor era — not executable)

Kept for provenance. None of this runs in the OMP plugin; do not follow it as instructions.

- The source README installed with `/add-plugin pstack` from the Cursor marketplace and configured model roles through an always-applied Cursor rule. The OMP port uses native selectors instead of those historical concrete defaults.
- `/deslop`, `control-cli`, and `control-ui` shipped in the separate `cursor-team-kit` plugin; `/create-skill` and `/babysit` were Cursor built-ins. A rule written before 0.15.3 pinned the old default models and had to be deleted before re-running setup.
- `/poteto-mode` composed with Cursor's `/loop` command for multi-hour runs; workers were dispatched with Cursor fields (`subagent_type`, `readonly`, `environment`, `run_in_background`, `cloud_base_branch`) and could pretend at cloud execution.
- `why` queried third-party MCP servers per evidence category; `recall`/`correct`/`automate-me` mined Cursor chat transcripts; history meant Cursor transcript directories.
- The overnight example ("land the stack even if CI flakes, everything merged by morning") runs verification unattended under a full-autonomy grant; landing follows the Shipping playbook's verified-run mechanics and the host's permission contract.
- Original voice, kept verbatim: *"I'm [poteto](https://x.com/poteto). I'm not a president or ceo, but I've worked with millions of lines of code at Meta, Netflix, and Cursor. I'm also on the react core team where I help build and maintain react compiler. There's a growing sense that ai writes too much slop code. I agree … fork it. improve it. make it yours. PRs are welcome!"* — that invitation refers to the upstream project, not this native package.

## License

MIT. See [LICENSE](./LICENSE) for pstack and [LICENSE.cursor-team-kit](./LICENSE.cursor-team-kit) for the three bundled Cursor team-kit dependencies. The logo ([`assets/logo.png`](./assets/logo.png)) and [`.cursor-plugin/plugin.json`](./.cursor-plugin/plugin.json), including Lauren Tan's author credit, are retained as historical source provenance, not native activation.

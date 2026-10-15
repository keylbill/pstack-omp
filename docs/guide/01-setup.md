# Set up pstack

In this page you install the package, pick which models pstack uses, and run your first task. Setup is one command plus a short conversation.

## Install the package

Install with `omp plugin install github:keylbill/pstack-omp#main`, then inspect `omp plugin list --json` and restart OMP. OMP discovers its `skills/`, `agents/`, and manifest-declared `extensions/pstack.js` through the enabled package. Follow the root README for prerequisites. Do not add standalone extension or individual discovery links. Upgrade with `omp plugin upgrade pstack`.

Commands run as `/skill:<name>`. The pstack extension also registers each unprefixed pstack slash command, so `/poteto-mode` below works either way.

Use `omp plugin disable pstack` or `omp plugin enable pstack`, then restart OMP to change the effective plugin catalog. `/pstack off` only suspends mode, not the plugin. This local link updates in place through `/pstack update`; `omp plugin upgrade pstack` is unavailable for local links. Update OMP independently, and keep the raw author snapshot, adapted installation, and new upstream version separate during the three-way port.

## Pick your models

Run:

```text
/skill:setup-pstack
```

[`/setup-pstack`](../../skills/setup-pstack/SKILL.md) detects the models you have access to, asks for a reasoning budget, shows you each role (code delegates, judgment, the review panels), and asks what you want. Answer the questions. Your choices live in the file at the effective `configurationPath` reported by `/pstack status`, a small map every pstack skill reads.

Choose a budget explicitly during setup if you want effort recommendations. `unlimited` targets `max`, `large` targets `xhigh`, `medium` targets `high`, and `small` targets `medium`. Setup selects the highest advertised effort at or below that target for each chosen model. A stored budget alone changes nothing. Without an explicit new budget choice, setup preserves configured efforts and existing overrides.

Setup confirms the budget and role map before writing pstack-owned alias effort suffixes. The budget does not change native `modelRoles`, model families, panel membership, or user service tiers. Choose different models or panels explicitly in the role map when you want them. Unsupported efforts and unavailable models need an explicit choice, not a fallback.

Override only the roles you want to change. A role without an entry uses its documented default. To restore a default, remove that role's entry through setup. Existing entries pin previous choices when upstream defaults change, so review them rather than deleting the whole map. Rerunning setup preserves deliberate choices and reports retired roles.

Set a role to `inherit-parent` or `auto` to use the active parent model and effort. Register helpers through `pstack_plan` before dispatch. The native hook returns explicit `model: "@default"` internally. This is not a `task` input field. Omitting registration leaves native task overrides and worker-profile policy in effect, so omission does not request inheritance. A panel is a list with one worker per entry. Setup also configures `swarm workers` unless a race explicitly selects each arm.

## Accept the verification offer, or don't

At the end of setup, `/setup-pstack` looks for a way to prove app behavior in your project, either a `verify-*` skill or an existing harness. If it finds neither, it offers once to generate one with [`/create-verification-skill`](../../skills/create-verification-skill/SKILL.md).

Say yes and it writes `.omp/skills/verify-<app>/`, a project-local skill that teaches agents to drive your app the way a user does. It proves the skill works once before handing it over. Say no and setup moves on. You can run `/create-verification-skill` yourself any time. [Verify and ship](./06-verify-and-ship.md#create-a-project-verification-skill) covers when it earns its place.

If you're new to pstack, accept the offer when the host permits the required checks. A verification skill lets an agent check the actual result instead of handing every result back for you to inspect.

The role map is read at each registered dispatch. Restart OMP after installing or changing the extension, agents, or skill catalog.

## Keep the cost in check

pstack spends tokens on delegates and review panels. Choose where the additional review is useful.

- Rerun `/setup-pstack` and explicitly choose a smaller budget or cheaper models. A strong main model with cheaper code delegates can reduce cost.
- Use `auto` or `inherit-parent` when the parent model is the choice you want. This does not inherently make a run cheaper.
- Shorten a panel list when fewer independent reviews meet your needs. Each entry launches one worker.
- Use `/pstack off` for an obvious edit that does not need the full workflow.

For a particular job, choose the role or panel before dispatch rather than changing shared native model assignments. Service speed is separate from reasoning effort. Native speed comes only from `task.agentServiceTierOverrides[agentName]`, then `tier.subagent`. An inherited tier snapshots the live parent's `/fast` setting. `/fast` changes the live parent. There is no supported per-task speed field or skill frontmatter speed setting. A stored budget never changes service tiers.

## Run your first task

Pick something real but small, and describe it the way you'd describe it to a colleague:

```text
/poteto-mode add a --json flag to this command. text output stays byte-identical. verify both.
```

Watch the todo list. Its first items are the matched playbook's steps copied in, the Feature playbook for this prompt. If `/poteto-mode` skips a step, the step stays in the list with `skip: <reason>`, so you can see what it chose not to do.

From here you can type normal follow-ups. `/poteto-mode` is sticky. It stays on for the conversation until you opt out by saying so.

Next: [Route work through `/poteto-mode`](./02-poteto-mode.md).

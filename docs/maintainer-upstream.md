# Reconcile upstream changes in a source checkout

This procedure is for maintainers of `keylbill/pstack-omp`. Recipients use `omp plugin upgrade pstack` and restart OMP. Never adapt upstream code inside an installed dependency tree.

## Run `/upstream` from the source checkout

Open OMP at the root of a clean, up-to-date `main` checkout, then run:

```text
/upstream [candidate-commit]
```

OMP loads `/upstream` from `.omp/commands/upstream.md` as a project command, so it exists only in a session whose working directory is this checkout. The package never ships a root `commands/` directory, because plugin commands would load for every recipient. `npm run check` fails if one appears.

The command runs the scripts below, creates a `port/upstream-<version>` branch in an owned worktree, then has the agent review every changed upstream path against the contracts in this document, prove the result, and open a pull request. It leaves the shared source checkout on its original branch. Without an argument the candidate is the current `cursor/plugins` HEAD. With an argument the candidate is that commit.

## Script reference

Both scripts take the same options. Pass them after `--`, for example `npm run upstream:check -- --candidate <commit>`.

| Option | Default |
| --- | --- |
| `--base <commit>` | The `commit` in `upstream.json`. |
| `--candidate <commit>` | The `cursor/plugins` HEAD, resolved to a full commit hash. |

`npm run upstream:check` fetches the commit-pinned archives of the base and the candidate into a temporary directory. It reads each upstream version from `pstack/.cursor-plugin/plugin.json`, classifies every mapped and review path, and prints a Markdown report. Check writes nothing in the checkout. It runs `git merge-file` on temporary copies, so the report already shows which modified files would conflict.

`npm run upstream:apply` refuses a dirty working tree before it fetches anything. It writes the same classification into the checkout, leaves `<<<<<<< port` and `>>>>>>> upstream` markers in text conflicts, and applies executable bits. It then sets `commit` and `upstreamVersion` in `upstream.json` and `upstreamVersion` in `package.json`. If the upstream version changed, apply sets the package `version` to `<upstreamVersion>-omp.1`. Otherwise it increments the `-omp.N` suffix.

Run both scripts from the repository root. The report header lists `Base` and `Candidate`, each as a full commit with its pstack version, and the count of changed upstream files. The apply header also lists `Port version` as the old and new package versions. Each class then has a `## <class> (<count>)` section. A mapped entry reads `` `<upstream path>` -> `<port path>` ``. A review entry shows the upstream path and its unified diff.

If the candidate equals the base, or no mapped or review path changed, both scripts print one line that starts with `No upstream pull needed:` and exit 0 without writing. A completed report exits 0, conflicts included. The scripts never execute downloaded code or load candidate extensions. They exit 1 with an `upstream:` message on stderr for a usage error, a dirty tree on apply, a failed `ls-remote`, fetch, or extraction, a provenance mismatch, or an unsafe archive path or symlink. A failed fetch never means that upstream has no changes.

### Path mapping

The scripts map upstream prefixes to port prefixes in this order. The first match wins.

| Upstream path | Port path |
| --- | --- |
| `pstack/skills/` | `skills/` |
| `pstack/agents/` | `agents/` |
| `pstack/assets/` | `assets/` |
| `pstack/automations/` | `automations/` |
| `pstack/docs/guide/` | `docs/guide/` |
| `pstack/LICENSE` | `LICENSE` |
| `cursor-team-kit/skills/deslop/` | `skills/deslop/` |
| `cursor-team-kit/skills/control-cli/` | `skills/control-cli/` |
| `cursor-team-kit/skills/control-ui/` | `skills/control-ui/` |
| `cursor-team-kit/LICENSE` | `LICENSE.cursor-team-kit` |

Every other file under `pstack/` is a review path. That includes the README, the manifests, and the harness docs. The scripts report review paths and never write them. All other team-kit files are out of scope.

Port-native files are never upstream targets. They include `extensions/`, `skills/create-skill/`, `.omp/`, `scripts/`, `upstream.json`, and this document. Raw root `plugin.json` and `.cursor-plugin/` never ship. Native discovery uses the conventional `skills/` and `agents/` directories plus `package.json#omp.extensions`.

### Classes

The scripts compare three sides for each path, including bytes and the executable bit. `B` is the base commit, `C` is the candidate commit, and `A` is the adapted working tree. A path whose `B` and `C` sides are identical is unchanged and does not appear in the report. The report prints the classes in this table's order.

| Class | Condition | Apply writes | Reviewer action |
| --- | --- | --- | --- |
| `conflict` | Modified text, and the three-way merge conflicts. | The merge with conflict markers. | Resolve so that the adaptation survives and the upstream intent lands. |
| `conflict-add` | `B` absent, `C` present, `A` present and different. | Nothing. `A` stays. | Merge upstream intent into `A` by hand. |
| `conflict-delete` | `B` present, `C` absent, `A` differs from `B`. | Nothing. `A` stays. | Delete the adaptation with its callers, or keep it and record why. |
| `conflict-binary` | Modified binary, `A` differs from both sides. | Keeps `A` bytes. The separate executable rule still applies. | Choose the content deliberately and record why. |
| `port-absent` | Modified upstream, `A` absent. | Nothing. | Confirm that the port still omits the file on purpose. Port relevant content by hand. |
| `fast-forward` | Modified upstream, `A` equals `B`. | `C`. | Read the whole result. Upstream text has had no native review yet. |
| `merged` | Modified text, and the three-way merge is clean. | The merge. | Read the whole result. A clean merge can still add Cursor terms. |
| `added` | `B` absent, `C` present, `A` absent. | `C`. | Read the whole file and adapt it to the native contracts. |
| `removed` | `B` present, `C` absent, `A` equals `B`. | Deletes the file. | Remove every native caller, link, and catalog entry. |
| `none` | `A` already equals `C`, or upstream removed a file the port lacks. | Nothing. | Confirm that the port content still meets the contracts. |
| `review-added`, `review-removed`, `review-modified` | A review path changed. | Nothing. | Port relevant README, manifest, or harness changes into native docs by hand. |

Executable mode is a separate note on the entry line, not a class. An upstream change to only the mode follows the modified rows, so it appears as `fast-forward` when `A` equals `B` and as `none` when `A` already equals `C`. `exec applied` means that the port mode matched the base and apply wrote the candidate mode, even when binary content conflicted. `exec kept` means that apply preserved the port's own mode adaptation. `exec reported` means that the port file is absent, so apply cannot change its mode. Decide each reported mode by hand.

## Review every changed path against the native contracts

Review every path in the apply report, including `fast-forward`, `merged`, `added`, and `none`. Delegate independent slices with exclusive file ownership and the repository's privacy constraints. Each brief names this document and `skills/poteto-mode/references/omp-runtime.md`.

Preserve these native contracts:

- Public OMP tools, permissions, authentication, repository privacy, and the native base prompt.
- Fresh main sessions default on, saved mode choices persist, and workers stay off.
- Native `task` dispatch, explicit role registration, panel routing, and no silent model fallback.
- User-owned configuration outside the package. Never copy user model choices, credentials, or machine paths into source.
- Deliberate model families, efforts, panels, budgets, native `modelRoles`, and service tiers.
- Explicit `/setup-pstack` confirmation before role or budget changes. A stored budget alone changes nothing.
- Optional Benny, Grok, and Tailscale integration gates.

Rewrite each Cursor assumption to its native equivalent. If no native equivalent exists, drop the content and record the reason in the PR table.

| Upstream assumption | Native equivalent |
| --- | --- |
| Cursor task fields such as `subagent_type`, `run_in_background`, or a `model` field | Native `task` items `{name, agent?, task, solutionSpace, isolated?}` after `pstack_plan` registration. OMP owns background delivery. |
| Model, effort, or speed pins | A pstack role name resolved through `pstack_plan`. Service tiers stay native user settings. |
| Cloud agents, VMs, or remote machines | Native local workers and `isolated: true` workspaces. A real configured runner or SSH integration is a named prerequisite, never an invented fallback. |
| Cursor paths such as `.cursor/`, plugin directories, or transcript directories | `skill://<name>`, the `configurationPath` from `/pstack status`, `agent://`, `history://`, or the archive prelude scoped to the current project. |
| Cursor-only tools such as `TodoWrite` or `AskQuestion` | The live OMP tool for the same job. Coordinator todos stay with the coordinator. Scoped workers do not invent todo APIs. |
| Cursor plugin manifests or a root `commands/` directory | Nothing ships. Provenance lives in `upstream.json`. |

Do not introduce Cursor task fields or speed fields. Keep authored workflows complete rather than replacing them with summaries. Remove obsolete callers in the same change.

`npm run check` scans text files under `skills/`, `agents/`, `automations/`, and `docs/guide/` for the terms in the `cursorTerms` array in `scripts/check-package.mjs`. If you find a Cursor term by hand that the scan missed, append it to `cursorTerms` in the same change.

If upstream changes its role schema, update the extension schema, role consumers, setup migration, and routing fixtures together. Preserve valid deliberate choices. Use [setup-pstack](../skills/setup-pstack/SKILL.md) for confirmed recipient migration rather than importing upstream model defaults.

## Prove the adapted package

Run `npm install --ignore-scripts && npm run check` in the source checkout. The suite checks package boundaries, the upstream classifier, and synthetic routing and scheduler behavior without reading active user configuration.

For native runtime changes, read the bundled control-cli skill and use isolated native configuration and plugin roots. A source worktree does not isolate global OMP state. Never change an active installation to test a port.

Exercise affected public contracts with the current OMP executable:

- Git installation, moving-ref upgrade, native discovery, commands, and aliases.
- Mode persistence, worker profiles, and isolated dispatch.
- Missing, invalid, and unreadable configuration diagnostics and authenticated model discovery before setup.
- Fresh exact helper names, panel indices, one-shot routing, and unavailable selectors without substitution.
- Explicit comparison selectors, null-as-omission wire fields, and rejection of mixed registration forms.
- Actual child model and effort, user configuration preservation, and affected scheduler behavior.

Record the executable version and only the behavior exercised. Source inspection and synthetic fixtures do not prove authenticated dispatch or provider compatibility. If the public API changed, adapt to that API rather than downgrading the runtime or editing user settings.

## Record and publish the source change

Apply has already advanced `upstream.json` and the package versions. Add a `CHANGELOG.md` section for the new package version. Update the README skill catalog for added or removed skills. Preserve full author and team-kit license notices.

Exclude raw archives, dependencies, caches, temporary stages, and private settings from the package. Commit on `port/upstream-<version>` and open a pull request whose body has one table row for every path in the apply report: path, class, outcome (`kept`, `adapted`, or `dropped`), and reason. Review and publish through the repository's authorized workflow. Recipients then run `omp plugin upgrade pstack` and restart OMP.

If adaptation or proof fails, retain the source work needed to resume and name the exact missing prerequisite. Preserve unexpected changes. Remove disposable files and processes you created after preserving the required evidence.

# Reconcile upstream changes in a source checkout

This procedure is for maintainers of `keylbill/pstack-omp`. Recipients use `omp plugin upgrade pstack` and restart OMP. Never adapt upstream code inside an installed dependency tree.

## Fetch both upstream commits

1. Start from a source checkout. Read `upstream.json`, `package.json`, both licenses, and the [native runtime contract](../skills/poteto-mode/references/omp-runtime.md). Record the adapted repository's HEAD and preserve unrelated working changes.
2. Read the baseline commit from `upstream.json`. Fetch that exact commit from `https://codeload.github.com/cursor/plugins/tar.gz/<pinned-commit>` into a temporary directory. This freshly fetched source is baseline `B`.
3. Resolve the candidate with `git ls-remote --symref https://github.com/cursor/plugins HEAD`, or use the explicitly requested upstream commit. Record the full commit hash. Fetch its commit-pinned codeload archive into a separate temporary directory as candidate `C`.
4. Extract both archives only within their temporary directories. Do not execute downloaded scripts or load candidate extensions. Read the upstream version from each archive's `pstack/.cursor-plugin/plugin.json`.

A missing commit, unavailable archive, or provenance mismatch makes the comparison incomplete. Report the failed prerequisite. Do not interpret a failed fetch as no upstream changes.

## Compare the complete upstream delta

Compare `B` with `C` across these trees:

- `pstack/`, including manifests, skills, agents, docs, assets, and automations.
- `cursor-team-kit/skills/deslop/`.
- `cursor-team-kit/skills/control-cli/`.
- `cursor-team-kit/skills/control-ui/`.
- `cursor-team-kit/LICENSE`.

Compare path sets, file bytes, executable bits, and symlink targets. Report additions, removals, and modifications. Report repository commit movement separately from plugin version movement.

Exclude all other team-kit skills. The adapted `skills/create-skill/` is native and is not an upstream replacement target. Raw root `plugin.json` and `.cursor-plugin/` never ship in the native package. Native discovery uses conventional `skills/` and `agents/` plus `package.json#omp.extensions`.

If relevant content is identical, leave the upstream pin unchanged. Remove only temporary files you created.

## Apply the delta to the adapted source

Use three inputs. `B` is the pinned raw commit fetched above. `A` is the adapted repository HEAD recorded at the start. `C` is the new raw commit. The `B` to `C` delta identifies upstream changes. Apply that delta to `A` while preserving its OMP adaptations.

Do not copy a candidate file over an adapted file unless the adapted file equals its baseline byte for byte. Reconcile additions and removals with every affected native caller. Delegate independent slices with exclusive file ownership and the repository's privacy constraints.

Preserve these native contracts:

- Public OMP tools, permissions, authentication, repository privacy, and the native base prompt.
- Fresh main sessions default on, saved mode choices persist, and workers stay off.
- Native `task` dispatch, explicit role registration, panel routing, and no silent model fallback.
- User-owned configuration outside the package. Never copy user model choices, credentials, or machine paths into source.
- Deliberate model families, efforts, panels, budgets, native `modelRoles`, and service tiers.
- Explicit `/setup-pstack` confirmation before role or budget changes. A stored budget alone changes nothing.
- Optional Benny, Grok, and Tailscale integration gates.

Do not introduce Cursor task fields or speed fields. Keep authored workflows complete rather than replacing them with summaries. Remove obsolete callers in the same change.

If upstream changes its role schema, update the extension schema, role consumers, setup migration, and routing fixtures together. Preserve valid deliberate choices. Use [setup-pstack](../skills/setup-pstack/SKILL.md) for confirmed recipient migration rather than importing upstream model defaults.

## Prove the adapted package

Run `npm install --ignore-scripts && npm run check` in the source checkout. The suite checks package boundaries and synthetic routing and scheduler behavior without reading active user configuration.

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

After proof passes, advance `upstream.json` to the candidate commit and upstream version. Align package `upstreamVersion` and choose a distinct adapted release version. Update the changelog and catalog. Preserve full author and team-kit license notices.

Exclude raw archives, dependencies, caches, temporary stages, and private settings from the package. Review and publish through the repository's authorized workflow. Recipients then run `omp plugin upgrade pstack` and restart OMP.

If adaptation or proof fails, retain the source work needed to resume and name the exact missing prerequisite. Preserve unexpected changes. Remove disposable files and processes you created after preserving the required evidence.

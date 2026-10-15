# Reconcile upstream changes in a source checkout

This procedure is for maintainers of `keylbill/pstack-omp`, not installed-package recipients. Use a separate source checkout. Never edit a package-manager-managed dependency tree or the active user installation.

Read `upstream.json`, `package.json`, both licenses, and the native runtime reference. Set `P` to the source checkout. Fetch the exact pinned upstream commit into private temporary storage as immutable raw baseline `B`. A missing baseline, network access, or matching provenance makes the comparison incomplete.

## Compare the complete raw source

3. Resolve the public repository's actual default-branch HEAD once with `git ls-remote --symref https://github.com/cursor/plugins HEAD`.
   Record its branch and full commit hash. Fetch that exact commit into a private directory created by `mktemp -d`.
   Use the commit-pinned archive at `https://codeload.github.com/cursor/plugins/tar.gz/<resolved-commit>` and extract only inside that directory.
   Do not execute downloaded scripts or load candidate extensions. Read the candidate `pstack/.cursor-plugin/plugin.json` version.
   Preserve both `.cursor-plugin/plugin.json` and the root portable `plugin.json`, when present, unchanged in immutable raw source. Only `.cursor-plugin/plugin.json` remains as provenance in the adapted native package. Do not promote the root portable manifest: it actively selects OMP's strict portable provider and suppresses the intended native conventional skill catalog. Native extension activation comes from `package.json#omp.extensions`; verify the fresh native catalog separately after promotion.
   If metadata, baseline, authentication, or network access fails, report an incomplete comparison and name the failed prerequisite.

4. Compare candidate raw content with `B`, never with the intentionally adapted installed port. Cover these complete source trees:
   - `pstack/`, including manifests, skills, agents, docs, assets, and automations.
   - `cursor-team-kit/skills/deslop/`, `cursor-team-kit/skills/control-cli/`, and `cursor-team-kit/skills/control-ui/`.
   - `cursor-team-kit/LICENSE`, from the same resolved commit.
   Compare path sets, file bytes, executable bits, and symlink targets. Report additions, removals, and modifications.
   Exclude the other team-kit skills and native `P/skills/create-skill/` from the upstream replacement set.
   Report repository commit and plugin version movement separately. Neither movement alone proves a relevant update.

5. Report installed and candidate commits and versions, the raw content delta, integrity drift, and any missing prerequisites.
   Name affected native consumers and required dependencies when content changes. Never mistake intentional OMP port differences for new upstream changes.
   If relevant content is identical, make no installed writes, pin changes, or receipt changes, even when repository HEAD moved.
   Call the installation current only after a complete comparison and clean integrity. A failure is not evidence of no changes.
   For `check`, stop after this report. Do not adapt, promote, change mode, or schedule later work.
   Remove only temporary artifacts you created. Preserve ordinary session history.

## Adapt in the source checkout

Run the complete comparison in this invocation. If relevant content is unchanged, do not advance the upstream pin. Keep unrelated user edits intact. Use a staged copy or isolated worktree for adaptation.

   Preserve native OMP adapters, the built-in base prompt, default-on mode for fresh main sessions, saved branch mode choices, worker mode off, runtime tools, permissions, auth, and privacy boundaries.
   Preserve local `create-skill`, effective native `modelRoles`, model families, efforts, panels, and the no-fallback policy.
   Treat the external effective configuration file as mutable user data, outside source control, not staged port output. Never promote a staged or upstream copy over current choices.
   Preserve `task.agentServiceTierOverrides`, `tier.subagent`, and the live parent tier. Never infer a fast policy from upstream slugs or a saved budget.
   Apply budget effort advice only after an explicit setup choice. Do not add speed fields to task, eval, or agent frontmatter.
   Do not replace native contracts with Cursor fields or upstream defaults. Keep optional Benny, Grok, and Tailscale integrations gated.
   Incorporate upstream additions and removals. Migrate every affected skill, worker profile, catalog, alias, and task-model-role consumer when required.
   Remove obsolete callers in the same cutover. Do not retain compatibility shims or summarize the full workflow into a reduced profile.
   If the upstream role schema needs migration, follow [setup-pstack](../../setup-pstack/SKILL.md) with the current authenticated catalog and explicit model confirmation.
   Preserve current deliberate choices where valid. Never import upstream defaults, guess unavailable models, change effort incidentally, or silently fall back.
   Treat new dependency requirements as real prerequisites. Name missing integrations or credentials rather than inventing substitutes.


Delegate adaptation with exclusive file ownership and privacy constraints. Migrate affected native consumers together. Do not mutate global registrations, configuration, or active source links to test a source change.

## Prove the adapted package

Read the bundled control-cli skill. Use isolated native configuration and plugin roots for install and moving-ref upgrade proof. Coordinate any separately authorized live consumers before touching their state. A worktree alone does not isolate global OMP files.

   Prove real commands and aliases, authenticated model resolution, mode persistence and reset, full worker profiles, and isolated task/model dispatch where affected.
   Discover the currently installed OMP executable and record its actual version and path. Historical receipt binaries are evidence, not a permanent runtime pin.
   If the current public API changed, adapt and exercise that API in the stage. Do not downgrade or edit global configuration to make an old adapter pass.
   Prove role registration with exact fresh helper names, panel indices, one-shot consumption, and the public `before_subagent_spawn` hook.
   Verify that unplanned helpers retain native profile policy and that unavailable requested selectors fail without substitution.
   For explicitly user-named swarm model comparisons, also prove exclusive `{name,selector}` registration through the same native resolver and hook.
   Reject combinations with non-null `role` or `panelIndex`. Preserve ordinary `{name,role,panelIndex?}` routing and user configuration.
   Exercise registration through the real provider wire schema, including null-as-omission helper fields, panel index zero, and `status` or `clear` with `helpers:null`.
   Require non-null helper arrays for registration and reject non-null mixed role/selector forms. Source-only schema checks do not prove provider compatibility.
   Record actual model and effort, isolation, coordinator-only ownership, outcomes, and artifacts. Do not claim source inspection is runtime proof.

Also prove first-run missing, invalid, and unreadable configuration diagnostics, authenticated catalog access before setup, profile-separated external configuration, and upgrade preservation of exact choices. Exercise schedule regressions without reading active user settings.

## Record and publish the source change

After proof passes, advance the public `upstream.json` commit and upstreamVersion. Keep package `upstreamVersion` aligned and choose a distinct adapted release version. Preserve full author and team-kit license notices. Keep raw source and its root portable manifest out of the adapted runtime package.

Record only exercised proof in the review. Keep raw baselines and historical evidence immutable outside the package. Exclude dependencies, Python caches, temporary stages, credentials, and private settings. Review and publish through the repository's authorized workflow. Recipients then use native `omp plugin upgrade pstack`.

If adaptation or proof fails, retain the reviewed stage and name the exact prerequisite. Restore only known writes that still match your output. Preserve unexpected changes. Never call an unproved change current. Remove disposable stages and processes you created after preserving evidence.

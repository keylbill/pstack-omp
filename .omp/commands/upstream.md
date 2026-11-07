---
description: Merge a cursor/plugins upstream commit into this pstack-omp source checkout, then review every changed path for OMP nativeness and open a PR
---

# Port an upstream pstack commit

You port one `cursor/plugins` commit into this `pstack-omp` source checkout. The scripts do the mechanical fetch, classification, and three-way merge. You judge every changed upstream path against the native contracts, finish the adaptation, prove it, and open a pull request.

{{#if ARGUMENTS}}The maintainer requested candidate commit `{{arg 1}}`. Pass it as `--candidate {{arg 1}}` to the check in step 2.{{else}}No candidate was requested. The check in step 2 resolves the current `cursor/plugins` HEAD.{{/if}}

## Rules for this run

- Work only in this source checkout, at the directory that holds `upstream.json`. Never edit the installed plugin under the OMP plugins directory. Recipients update with `omp plugin upgrade pstack` and restart OMP.
- Never change OMP settings, native `modelRoles`, service tiers, or the user's `pstack/models.json`.
- `docs/maintainer-upstream.md` owns the class table, the native contracts, the Cursor-to-native rewrites, and the proof requirements. Read it in full before step 2. Also read `skills/poteto-mode/references/omp-runtime.md` in this checkout, not the installed copy.
- Run under `/poteto-mode`. Delegate independent review slices with exclusive file ownership, and put the contract doc paths in every brief.

## Steps

1. Confirm that `git status --porcelain` prints nothing and that the current branch is an up-to-date `main`. If the tree is dirty, stop and report the dirty paths. Do not stash, reset, or commit the maintainer's work.
2. Run `npm run upstream:check`. Append `-- --candidate <commit>` when a candidate was requested. Record the full commit and the pstack version from the report's `Candidate` line.
3. If the check prints a line that starts with `No upstream pull needed:`, report that line and stop. If the script exits 1, report its `upstream:` error as the missing prerequisite and stop. A failed fetch never means that upstream has no changes.
4. Create branch `port/upstream-<candidate version>` from `main` in a new owned worktree with `git worktree add <temporary worktree path> -b <branch> main`. If that branch already exists locally or on the remote, append `-<first 12 characters of the candidate commit>`. Do not switch the shared source checkout. Run all remaining commands and edits with the owned worktree as their working directory.
5. In the owned worktree, run `npm run upstream:apply -- --candidate <full candidate commit from step 2>`. Always pass the recorded commit, even when none was requested, so apply merges the commit that check classified rather than a newer HEAD. Keep the complete apply report. If the tool truncates the output, read the full result from its artifact. The report is the work list for steps 6 to 9 and the source of the PR table.
6. Review every path in the report, in every class. That includes `fast-forward`, `merged`, `added`, and `none` paths, not only conflicts. Decide every `exec reported` mode note by hand. For each path, read the resulting port file and follow the reviewer action for its class in the maintainer doc. `git diff` shows what apply changed in the port. For an upstream side that apply did not write, read it at `https://raw.githubusercontent.com/cursor/plugins/<commit>/<upstream path>` for the base and candidate commits.
7. For each path, check the result against every native contract in the maintainer doc. Rewrite each Cursor task field, cloud agent or VM assumption, Cursor path, Cursor-only tool, and model, effort, or speed pin to its native equivalent from the rewrite table. If no native equivalent exists, drop that content and record the reason. Resolve conflict markers so that the OMP adaptation survives and the upstream intent lands. Confirm that no conflict markers remain anywhere in the tree.
8. If you rewrite a Cursor term that the package check does not already catch, append that term to the `cursorTerms` array in `scripts/check-package.mjs`.
9. For each `review-added`, `review-removed`, and `review-modified` path, the scripts wrote nothing. Port each relevant README, manifest, or harness change into the native docs by hand: `README.md`, `docs/`, or the runtime reference. Record each irrelevant change as dropped with a reason.
10. Add a `CHANGELOG.md` section for the package version that apply wrote to `package.json`, and move any `Unreleased` entries into it. Name the upstream version and commit, and summarize what you kept, adapted, and dropped.
11. Run `npm install --ignore-scripts && npm run check`. Then run every runtime proof in the maintainer doc that the changed paths affect. Record the OMP executable version and only the behavior you exercised.
12. Commit in small ordered Conventional Commits, following `skills/poteto-mode/playbooks/opening-a-pr.md`. Push the branch and open a ready PR. The PR body adds `## Upstream changes` after `## What changed`. That section is a table with one row for every path in the apply report: the path, its class, the outcome (`kept`, `adapted`, or `dropped`), and the reason. Do not merge the PR.

If adaptation or proof fails, keep the branch, report the failing step and the exact missing prerequisite, and remove only temporary files and processes that you created.

## Final report

Report the base and candidate commits and versions, the branch, the PR URL, the count of paths per class and per outcome, every denylist term you added, and the checks and runtime proofs you ran with their results.

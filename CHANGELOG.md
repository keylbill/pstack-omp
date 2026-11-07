# Changelog

## Unreleased

Maintainer tooling only. The package release and the upstream pin are unchanged.

- Add `npm run upstream:check` and `npm run upstream:apply`. They fetch the pinned and candidate `cursor/plugins` commits, classify every mapped and review path against the adapted source, and apply clean upstream changes with a three-way merge.
- Add the project command `/upstream` in `.omp/commands/upstream.md`. It runs the scripts on a `port/upstream-<version>` branch, then has the agent review every changed path for OMP nativeness, prove the result, and open a pull request with a per-path outcome table.
- Replace the manual fetch, compare, and apply steps in `docs/maintainer-upstream.md` with the scripts and `/upstream`. Keep every native contract and proof requirement.
- Remove the literal version and commit pins from `scripts/check-package.mjs`, keep the consistency checks, scan shipped text for Cursor terms in `cursorTerms`, and reject a root `commands/` directory.
- Run the offline classifier tests in `npm run check`.

## 0.15.36-omp.1

Port upstream pstack 0.15.36 at commit `ae5650febf4320793844c12c4adaa937f417f8da`.

- Add `statechart`, `create-formal-verification-skill`, `maintain-formal-verification-skill`, and `ketchup-video`.
- Carry upstream workflow, verification, review, prompting, principle, and helper-script changes into the OMP adaptation.
- Remove the retired interrogate review references, orchestration runtime, and scripted frontier resolver. Orchestrate now tracks per-PR owners and verifiers with native task workers, no scripts, and no polling loops.
- Use `omp plugin upgrade pstack` and restart for recipient updates. Remove agent-driven update commands and their reference.
- Remove `.cursor-plugin/plugin.json` and historical Cursor installation prose. Keep source provenance in `upstream.json` and author credit in `LICENSE`.
- Rework maintainer reconciliation around freshly fetched pinned and candidate commits plus the adapted source HEAD.
- Reduce the runtime reference to public OMP contracts. Preserve user-owned roles, efforts, panels, tiers, and optional integration gates.
- Warn legacy local-link users to remove the verified `node_modules/pstack` symlink before Git installation.
- Exclude the alternate Claude Code mapping. The package ships the native OMP workflow.

## 0.15.25-omp.1

Initial standalone native OMP adaptation of pstack 0.15.25 at the commit pinned in `upstream.json`.

- Preserve the complete author workflows, guide, agents, assets, optional automation pack, and selected team-kit dependencies with both MIT notices.
- Install from `github:keylbill/pstack-omp#main` as native package `pstack`.
- Keep user role choices outside managed package code at the effective native agent directory's `pstack/models.json`.
- Report configuration state and authenticated model choices before setup without creating defaults or applying a stored budget.
- Preserve native routing, nullable provider fields, mode, scheduler behavior, and explicit-selector dispatch without implicit model fallback.
- Separate recipient native upgrades from maintainer upstream reconciliation.
- Add synthetic routing and scheduler checks and public package boundary checks.

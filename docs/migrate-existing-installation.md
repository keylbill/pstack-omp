# Move an existing installation to the public Git package

Replace a manual or local-link pstack installation with the Git-managed package while preserving your configuration.

Do not run this procedure while another session consumes the legacy installation. Publication alone does not authorize changing an active installation.

## Inventory exact activation owners

1. Record `omp plugin list --json` and the current effective native profile and configuration roots. Identify the `pstack` record's source, enabled state, selected features, and any pstack-specific registry settings.
2. In the legacy session, run `/pstack status`. Record its reported `configurationPath` and package root. Back up the exact role file privately and record its hash. Inspect native `modelRoles` and service-tier settings without rewriting them.
3. Inspect configured extension paths and discovered skill and agent links. Identify links by their resolved targets in the legacy pstack tree. For standalone files, require matching ownership receipts or exact source fingerprints. A matching name alone does not establish ownership.
4. Preserve unrelated skills, aliases, credentials, sessions, plugin settings, and other active work. Keep historical receipts, immutable raw baselines, and original backups as private evidence. Do not ship them.

## Prepare external choices before changing activation

Determine the destination as `<pi.pi.getAgentDir()>/pstack/models.json` in the intended native process profile. The default profile commonly uses `~/.omp/agent/pstack/models.json`, which may already be the legacy file. Do not assume that example for another profile.

If source and destination are the same regular file, leave it untouched. If they differ and the destination is absent, copy the original exact bytes only after confirming source and destination. If the destination exists, do not overwrite it. Compare deliberate choices and resolve conflicts explicitly through setup. An unreadable or invalid file needs repair confirmation, not default replacement.

Keep `schemaVersion` 1 and every valid deliberate role, panel, selector, effort, and budget. Native `modelRoles`, service tiers, and unrelated configuration remain unchanged.

## Replace only identified legacy activation

Coordinate all consumers before this step. Remove only the identified pstack local-link registration or standalone extension activation using the native manager or a leaf-scoped edit. Preserve its recorded availability controls for the new registration. Never run broad skill uninstall commands or delete a skill directory by name.

Native uninstall removes pstack-specific registry settings. If uninstall is needed, back up those settings privately and restore the supported settings after installation. A direct reinstall preserves the separate settings map but resets availability controls, so restore the recorded enablement and feature selection.

Remove an individual discovery link only after its resolved target proves it belongs to the legacy pstack package. Keep user-authored files and unrelated links intact. Do not delete the legacy source tree, role file, or receipts as part of activation cutover. Do not run a historical rollback helper that can restore unrelated native settings.

Install the Git-backed package.

```sh
omp plugin install github:keylbill/pstack-omp#main
omp plugin list --json
```

Restore only the recorded pstack enablement and feature selection through supported native controls. Restart OMP. Confirm a single native discovery owner with `/pstack status`, `/skill:poteto-mode`, and the worker profiles. Confirm the effective external role path and compare its exact hash with the private pre-migration evidence. `/pstack models` reports schema state and authenticated availability separately. Real child dispatch is needed to prove selected model and effort.

## Upgrade subsequent releases

Follow [Update pstack](../README.md#update-pstack) for later releases. Your external configuration remains independent of the installed package.


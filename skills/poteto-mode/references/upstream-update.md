# Update the native pstack package

Use the command-supplied request `{"mode":"check"}` or `{"mode":"apply"}`. Run as the main coordinator. Keep pstack mode, the state journal, native aliases, efforts, panels, and service tiers unchanged.

This is a recipient package update, not an upstream Cursor port. Never edit managed package files or fetch Cursor source into the installed package. Maintainers use the separate [upstream reconciliation procedure](../../../docs/maintainer-upstream.md) in a source checkout.

## Inspect the installed source

1. Run `omp plugin list --json`. Identify the exact native package named `pstack`, its recorded Git source and ref, and its enabled features. Do not guess a managed installation path.
2. Confirm the source is the intended `keylbill/pstack-omp` repository. A local link cannot use native upgrade. Report that prerequisite instead of rewriting the link or running an installation migration.
3. Run `/pstack status` and read its effective `configurationPath`. Record its configuration state. If the file exists, preserve its exact bytes as private comparison evidence. Never publish the choices or copy them into package code.

## Check the recorded ref

For a Git source, use `git ls-remote` on the recorded repository and exact ref. Compare its resolved commit with the installed resolution exposed by the native manager or its lockfile. Read only the pstack record. Do not change registry settings or lockfiles by hand.

A moving branch such as `main` can advance without a version bump. A fixed tag or commit stays fixed. An unavailable installed resolution, network, or ref makes the comparison incomplete, not current. Report the missing prerequisite.

For `check`, report the recorded source, installed and remote resolutions, and whether an update exists. Write no installed files, user settings, receipts, or bundles. Remove only temporary evidence you created.

## Upgrade through the native manager

For `apply`, check first in this invocation. If the recorded ref has not moved, make no package writes. Otherwise run `omp plugin upgrade pstack`. Never use bare `omp plugin upgrade` as a substitute. Never reinstall to update because reinstall can reset enablement and feature selection.

The user's `/pstack update` invocation authorizes this bounded native upgrade. Host permissions and genuine consumer ownership checks still apply. Do not create an installer, account, scheduler, integration, product issue, PR, push, or publication.

After success, restart OMP and inspect native registration and feature selection. Confirm `/pstack status`, `/skill:poteto-mode`, and the bundled worker profiles in a fresh session. Compare the external configuration with its exact pre-upgrade bytes. Report only exercised behavior. Configuration schema validity does not prove authentication or child effort.

A required role-schema migration is a separate `/setup-pstack` operation with authenticated choices and explicit confirmation. Never apply upstream defaults or change a stored budget during an upgrade. If upgrade fails, report the native error and preserve user choices. Do not hand-edit the managed dependency tree or invoke historical installation rollback helpers.

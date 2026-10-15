---
name: deslop
description: Remove AI-generated code slop and clean up code style
---

# Remove AI code slop

Inspect the scoped change against its agreed repository base, not an assumed `main`. Remove slop introduced by that change; do not re-audit completed mutations or touch unrelated user work.

## Focus Areas

- Extra comments that are unnecessary or inconsistent with local style
- Defensive checks or try/catch blocks that are abnormal for trusted code paths
- Casts to `any` used only to bypass type issues
- Deeply nested code that should be simplified with early returns
- Other patterns inconsistent with the file and surrounding codebase

## Guardrails

- Keep behavior unchanged unless fixing a clear bug.
- Prefer minimal, focused edits over broad rewrites.
- Keep the final report concise without dropping the active playbook's required evidence or decisions.

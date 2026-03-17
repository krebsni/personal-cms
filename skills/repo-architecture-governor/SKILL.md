---
name: repo-architecture-governor
description: Repo structure, security hygiene, and tooling consistency guardrails. Use when restructuring folders, consolidating configs, removing duplication, or reviewing architecture/security risks.
---

# Repo Architecture Governor

## Overview
Keep the repository coherent: one source of truth per app, minimal duplication, and explicit security/tooling practices.

## Workflow
1. Identify duplicated configs or competing source trees.
2. Propose a single canonical layout and migrate incrementally.
3. Update scripts, docs, and CI to match the new layout.
4. Verify that secrets, env files, and bindings stay out of source control.
5. Add or update guardrails (lint, typecheck, tests) after structural changes.

## Guardrails
- Prefer app-based layout (`apps/` or similar) with clear ownership.
- Remove unused configs to avoid drift.
- Document structure changes in README and plan files.

## References
- See `references/repo-structure.md` for repo-specific notes.

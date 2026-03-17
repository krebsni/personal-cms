---
name: qa-ci-automation
description: Testing, QA, and CI/CD automation guidance for this repo. Use when adding tests, configuring CI, improving test reliability, or creating automation scripts for lint/typecheck/test/build.
---

# QA + CI Automation

## Overview
Make tests and automation predictable: split frontend/backend checks, add a unified `check` workflow, and keep CI fast and deterministic.

## Workflow
1. Identify the target surface (frontend UI, Workers API, integration, or e2e).
2. Place tests next to the owning app or in a shared `tests/` area as needed.
3. Ensure scripts exist for `lint`, `typecheck`, and `test` per app.
4. Add a root `check` script that runs all required validations.
5. Keep CI steps minimal and repeatable (`npm ci` -> `npm run check`).

## Guardrails
- Prefer deterministic tests with stable data and minimal network reliance.
- Split checks by app to keep failures localized and faster to debug.
- Keep CI configuration small and readable.

## References
- See `references/qa-ci-context.md` for current scripts and test locations.

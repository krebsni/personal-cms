---
name: cloudflare-workers-stack
description: Cloudflare Workers/D1/R2 workflow and guardrails for this repo. Use when changing Workers routes, auth, D1 migrations/queries, R2 storage, Durable Objects, or wrangler configuration.
---

# Cloudflare Workers Stack

## Overview
Apply consistent patterns for Cloudflare Workers, D1, R2, and Durable Objects with safe local dev and deploy practices.

## Workflow
1. Identify the Worker surface area being changed (route, auth, DB, storage, realtime).
2. Check `wrangler.toml` and environment variables for bindings and compatibility date.
3. Update Worker code under `apps/api/` with Hono conventions and consistent JSON responses.
4. For D1 changes, add a migration under `migrations/` and update queries carefully.
5. For R2 changes, ensure key naming and content type handling are consistent.
6. Run or update tests covering the API behavior.
7. Document new endpoints or config changes in README if needed.

## Guardrails
- Keep API responses in the standard `{ success, data, message }` format.
- Use bindings from `Env` and avoid hard-coded secrets.
- Prefer additive, migration-first schema changes.

## References
- See `references/cloudflare-context.md` for repo-specific files and commands.

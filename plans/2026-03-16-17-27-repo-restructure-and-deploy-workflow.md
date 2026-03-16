# Plan: Repo Restructure + Automated Dev/Test + Cloudflare Test Deploy

Timestamp: 2026-03-16 17:27 (Europe/Berlin)

## Phase 1: Repo Restructure (Apps Layout)
- [x] Create `apps/` layout: move `frontend/` -> `apps/web`, `workers/` -> `apps/api` (keep current deletes).
- [x] Update configs to new paths: `wrangler.toml`, `docker-compose.yml`, `Dockerfile.frontend`, `Dockerfile.backend`, `Makefile` (if needed).
- [x] Update root `package.json` workspaces and scripts to target `apps/web` and `apps/api`.
- [x] Update README project structure + dev commands.
- [x] Add or update `.env.example` for each app if needed.
- [x] Commit phase 1.

## Phase 2: Test + Dev Workflow (Automation-Ready)
- [x] Decide test placement: keep root `tests/` for integration/e2e; add app tests later as needed.
- [x] Move or link existing `tests/` content accordingly (preserve history).
- [x] Update test configs and scripts (`vitest.config`, `tests/tsconfig.json`, root scripts) to run per app.
- [x] Add `npm run check` (lint + typecheck + tests) at root.
- [ ] Commit phase 2.

## Phase 3: GitHub Workflow + Cloudflare Test Deploy Guide
- [ ] Research current Cloudflare Pages/Workers/D1 GitHub integration requirements (official docs).
- [ ] Draft a step-by-step guide for a test/staging environment on GitHub.
- [ ] (Optional) Add a starter GitHub Actions workflow for CI (build + test) if you want it in-repo.
- [ ] Commit phase 3 (only if in-repo files are added).

# Plan: GitHub Actions Cloudflare Test Deploy (PR + staging)

Timestamp: 2026-03-16 18:40 (Europe/Berlin)

## Phase 1: Wrangler Env + Repo Config
- [x] Add a `staging` environment section in `wrangler.toml` with required bindings/vars.
- [x] Ensure Pages deploy uses `apps/web/dist` and Workers deploy uses `apps/api/index.ts`.
- [x] Document staging assumptions in README (brief).
- [ ] Commit phase 1.

## Phase 2: GitHub Actions Workflows
- [ ] Add workflow for PR preview deploy (Pages + Workers staging).
- [ ] Add workflow for pushes to `staging` branch (Pages + Workers staging).
- [ ] Use GitHub secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- [ ] Commit phase 2.

## Phase 3: Guide + Verification
- [ ] Add a concise README section on how the workflows work and required secrets.
- [ ] Provide a short verification checklist (manual).
- [ ] Commit phase 3.

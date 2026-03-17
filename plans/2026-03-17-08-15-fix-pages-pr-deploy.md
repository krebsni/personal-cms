# Plan: Fix Cloudflare Pages PR Deploy

Timestamp: 2026-03-17 08:15 (Europe/Berlin)

## Phase 1: Pages-Specific Wrangler Config
- [x] Add a Pages-only wrangler config file.
- [x] Remove Pages validation conflicts from PR deploy path.
- [ ] Commit phase 1.

## Phase 2: Workflow Updates
- [x] Update PR and staging workflows to use the Pages-only config.
- [x] Keep Workers deploy using the main wrangler config.
- [ ] Commit phase 2.

## Phase 3: Documentation
- [x] Update README with Pages config separation.
- [ ] Commit phase 3.

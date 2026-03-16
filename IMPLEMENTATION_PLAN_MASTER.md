# Personal CMS - Authoritative Implementation Plan

> This is the single source of truth for implementation sequencing.
> It supersedes `IMPLEMENTATION_PLAN.md` and `NEW_IMPLEMENTATION_PLAN.md`.

## North Star
Build a premium, Obsidian-like CMS centered on repositories (vaults), with collaborative highlighting, link previews, access requests, and owner-only raw editing. Stack: Cloudflare Workers + D1 + R2 + Durable Objects; React frontend on Cloudflare Pages.

## Phase 0: Repo + Workflow Baseline (Complete)
- [x] Restructure into `apps/web` and `apps/api`
- [x] CI staging deploy workflows
- [x] Plan-first process

## Phase 1: Data Model + Migrations
- [ ] Add `repositories` table
- [ ] Add `assignments` table (resource_id, user_id, role, cascade)
- [ ] Add `notifications` table
- [ ] Update `files`/`folders` with `repository_id`, `parent_id`, `is_public`
- [ ] Migration tests + seed adjustments

## Phase 2: Core Backend (Repositories + Assignments)
- [ ] CRUD for repositories (`apps/api/repositories.ts`)
- [ ] Assignment endpoints (`apps/api/assignments.ts`)
- [ ] Cascading permission resolution for folders/files
- [ ] Update `apps/api/files.ts` for repository scoping

## Phase 3: Notifications + Admin Enhancements
- [ ] Notifications API (`apps/api/notifications.ts`)
- [ ] Admin: manage repositories + highlight palettes
- [ ] Access request/approve flow

## Phase 4: Collaboration + Highlights Refinement
- [ ] Optimistic locking for highlights (REST or DO)
- [ ] Owner-only raw markdown edit API
- [ ] Harden DO routing and session logic

## Phase 5: Frontend Foundation + Repos UI
- [ ] App shell with premium styling
- [ ] Repository selector + tree view
- [ ] Admin view for repositories + users

## Phase 6: Read/Highlight + Code Edit Modes
- [ ] Unified read/highlight renderer
- [ ] Highlight styling popup + sync
- [ ] Owner-only code editor

## Phase 7: Link Previews + Access Requests
- [ ] Link preview popovers
- [ ] Request access UI + notification flow

## Phase 8: Verification + Release
- [ ] Integration tests for cascade permissions
- [ ] Visual verification and UX polish
- [ ] Production deploy checklist

## Test Strategy
- Backend integration tests for permissions and notifications
- Frontend component tests for critical UI
- Visual checks (mock-first + screenshots) per UI change

## Notes
- Keep staging/prod environment parity in `wrangler.toml`.
- For any UI change, follow mock-first screenshot approval flow.

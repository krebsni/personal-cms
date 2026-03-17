# Plan: Fix Pages Config Path Limitation

Timestamp: 2026-03-17 08:24 (Europe/Berlin)

## Phase 1: Config File Swap
- [x] Rename Workers config to `wrangler.workers.toml`.
- [x] Move Pages config to `wrangler.toml` (default path).
- [x] Commit phase 1.

## Phase 2: Workflow Updates
- [x] Update Workers deploy steps to use `--config wrangler.workers.toml`.
- [x] Remove `--config` from Pages deploy steps.
- [x] Commit phase 2.

## Phase 3: Documentation
- [x] Update README to describe dual-config setup.
- [x] Commit phase 3.

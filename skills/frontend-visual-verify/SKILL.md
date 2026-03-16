---
name: frontend-visual-verify
description: Visual verification workflow for React/Tailwind UI changes with mock-first data, screenshot gating, and Playwright/Puppeteer captures. Use when changing UI components, layouts, styles, or routes, or when asked to provide visual diffs/screenshots before wiring real state.
---

# Frontend Visual Verify

## Overview
Deliver UI changes by rendering with mock data first, capturing screenshots, and waiting for user approval before wiring real state or API calls.

## Workflow
1. Identify the target routes/components and the states to showcase (empty/loading/error/typical).
2. Inject mock data before state wiring.
   - Prefer a mock layer in `frontend/src/lib/api.ts` or in hooks under `frontend/src/hooks/`.
   - If no mock infra exists, add a small, temporary mock adapter and gate it behind a local flag.
3. Render the UI with mocks and capture screenshots (desktop + mobile).
   - Use Playwright or Puppeteer.
   - Provide clear, labeled screenshots for each state.
4. Present screenshots and wait for approval.
5. After approval, replace mocks with real state/API wiring and repeat screenshots if visuals change.

## Required Behavior
- Always show screenshots of new/changed UI with mock data first.
- Do not wire real state or backend calls until the user confirms visuals.
- If visuals change after wiring, provide updated screenshots.

## References
- See `references/frontend-context.md` for key repo paths and mock guidance.

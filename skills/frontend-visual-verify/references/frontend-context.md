# Frontend Context (Personal CMS)

Key paths:
- App entry: `apps/web/src/main.tsx`
- Routes: `apps/web/src/App.tsx`
- API wrapper: `apps/web/src/lib/api.ts`
- Hooks: `apps/web/src/hooks/`
- Pages: `apps/web/src/pages/`
- Components: `apps/web/src/components/`

Mock guidance:
- Preferred mock injection point: `apps/web/src/lib/api.ts` (wrap `fetchApi` or add a mock adapter)
- Alternative: mock data at hook level in `apps/web/src/hooks/` for specific pages
- Gate mocks behind a local flag or environment toggle

Visual verification:
- Capture both desktop and mobile states for new/changed UI
- Provide labeled screenshots for each state (empty/loading/error/typical)

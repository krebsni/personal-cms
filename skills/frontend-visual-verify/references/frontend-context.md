# Frontend Context (Personal CMS)

Key paths:
- App entry: `frontend/src/main.tsx`
- Routes: `frontend/src/App.tsx`
- API wrapper: `frontend/src/lib/api.ts`
- Hooks: `frontend/src/hooks/`
- Pages: `frontend/src/pages/`
- Components: `frontend/src/components/`

Mock guidance:
- Preferred mock injection point: `frontend/src/lib/api.ts` (wrap `fetchApi` or add a mock adapter)
- Alternative: mock data at hook level in `frontend/src/hooks/` for specific pages
- Gate mocks behind a local flag or environment toggle

Visual verification:
- Capture both desktop and mobile states for new/changed UI
- Provide labeled screenshots for each state (empty/loading/error/typical)

# Cloudflare Stack Context (Personal CMS)

Key paths:
- Worker entry: `apps/api/index.ts`
- Worker modules: `apps/api/*.ts`
- Env bindings: `apps/api/types.ts`
- Wrangler config: `wrangler.toml`
- Migrations: `migrations/`

Local dev commands:
- `npm run dev:workers`
- `npx wrangler d1 migrations apply <db> --local`

Notes:
- Durable Object: `CollaborationRoom` in `apps/api/collaboration.ts`
- D1 schema lives in `migrations/0001_initial.sql`

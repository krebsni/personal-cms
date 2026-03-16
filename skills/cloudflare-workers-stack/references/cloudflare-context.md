# Cloudflare Stack Context (Personal CMS)

Key paths:
- Worker entry: `workers/index.ts`
- Worker modules: `workers/*.ts`
- Env bindings: `workers/types.ts`
- Wrangler config: `wrangler.toml`
- Migrations: `migrations/`

Local dev commands:
- `npm run dev:workers`
- `npx wrangler d1 migrations apply <db> --local`

Notes:
- Durable Object: `CollaborationRoom` in `workers/collaboration.ts`
- D1 schema lives in `migrations/0001_initial.sql`

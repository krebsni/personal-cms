# Repo Structure Notes (Personal CMS)

Current layout highlights:
- Frontend: `frontend/`
- Backend: `workers/`
- D1 migrations: `migrations/`
- Tests: `tests/`
- Wrangler config: `wrangler.toml`
- Docker: `Dockerfile.frontend`, `Dockerfile.backend`, `docker-compose.yml`

Common risks:
- Duplicate configs at repo root vs app folder
- Orphaned scripts that still reference removed paths
- Environment variables drifting between local and CI

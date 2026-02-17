# Docker Deployment Guide

Quick guide for running Personal CMS locally using Docker.

## Prerequisites

- Docker Desktop or Docker Engine (version 20.10+)
- Docker Compose (version 2.0+)

## Quick Start (One Command)

```bash
docker-compose up
```

That's it! The application will be available at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8787

## What's Running

The docker-compose setup starts two services:

### Frontend Service
- **Port**: 5173
- **Technology**: Vite + React 19 + TypeScript
- **Hot Reload**: Enabled (changes to `src/` are reflected immediately)
- **Environment**: Development mode with HMR

### Backend Service
- **Port**: 8787
- **Technology**: Cloudflare Workers + Wrangler
- **Database**: Local D1 (SQLite)
- **Storage**: Local R2 simulation
- **Hot Reload**: Enabled (changes to `workers/` are reflected immediately)

## Commands

### Start Everything
```bash
docker-compose up
```

### Start in Background (Detached)
```bash
docker-compose up -d
```

### View Logs
```bash
# All services
docker-compose logs -f

# Frontend only
docker-compose logs -f frontend

# Backend only
docker-compose logs -f backend
```

### Stop Everything
```bash
docker-compose down
```

### Restart Services
```bash
docker-compose restart
```

### Rebuild Containers (after dependency changes)
```bash
docker-compose build
docker-compose up
```

### Clean Everything (including volumes)
```bash
docker-compose down -v
```

## Database Setup

The backend uses local D1 (SQLite) which is automatically initialized on first run.

### Apply Migrations Manually

```bash
# Execute migrations inside the backend container
docker-compose exec backend npx wrangler d1 execute personal-cms-dev --local --file=./migrations/0001_initial.sql
```

### Access Database

```bash
# Open SQLite shell
docker-compose exec backend sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*/db.sqlite
```

## Development Workflow

1. **Start Docker Compose**:
   ```bash
   docker-compose up
   ```

2. **Edit Code**:
   - Frontend: Edit files in `src/` - changes are hot-reloaded
   - Backend: Edit files in `workers/` - changes are hot-reloaded

3. **View Application**:
   - Open http://localhost:5173 in your browser
   - Backend API is available at http://localhost:8787

4. **Register First User**:
   - Go to http://localhost:5173/register
   - Create an account
   - Manually promote to admin if needed:
     ```bash
     docker-compose exec backend sqlite3 .wrangler/state/v3/d1/miniflare-D1DatabaseObject/*/db.sqlite
     sqlite> UPDATE users SET role = 'admin' WHERE username = 'yourusername';
     sqlite> .exit
     ```

## Volumes

The following directories are mounted for hot-reloading:

**Frontend**:
- `./src` - React components and pages
- `./public` - Static assets
- `./index.html` - Entry HTML
- Config files (vite.config.ts, tailwind.config.js, etc.)

**Backend**:
- `./workers` - Cloudflare Workers code
- `./migrations` - Database migrations
- `./wrangler.toml` - Wrangler configuration
- `./.wrangler` - Local D1/R2 state (persisted)

## Environment Variables

### Frontend
Create `.env` file in the project root:
```env
VITE_API_URL=http://localhost:8787
```

### Backend
Edit `wrangler.toml`:
```toml
[vars]
ENVIRONMENT = "development"
JWT_SECRET = "your-secret-key-here"
```

## Troubleshooting

### Port Already in Use

If ports 5173 or 8787 are already in use:

1. Stop conflicting services
2. Or change ports in `docker-compose.yml`:
   ```yaml
   ports:
     - "3000:5173"  # Change frontend to port 3000
     - "8788:8787"  # Change backend to port 8788
   ```

### Containers Won't Start

```bash
# View detailed logs
docker-compose logs

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

### Database Not Initialized

```bash
# Stop everything
docker-compose down

# Remove volumes
docker-compose down -v

# Start fresh
docker-compose up
```

### Hot Reload Not Working

```bash
# Restart the specific service
docker-compose restart frontend
# or
docker-compose restart backend
```

### Permission Issues

On Linux, you may need to fix permissions:
```bash
sudo chown -R $USER:$USER .
```

## Production Deployment

**Note**: This Docker setup is for **local development only**.

For production deployment to Cloudflare:
- See [DEPLOYMENT.md](./DEPLOYMENT.md) for full production deployment guide
- Use `npx wrangler deploy` to deploy Workers
- Use Cloudflare Pages for frontend hosting

## Architecture

```
┌─────────────────────────────────────────────┐
│           Docker Compose Network            │
│                                             │
│  ┌──────────────┐      ┌──────────────┐    │
│  │   Frontend   │      │   Backend    │    │
│  │   (Vite)     │─────▶│  (Wrangler)  │    │
│  │ Port: 5173   │      │ Port: 8787   │    │
│  └──────────────┘      └──────────────┘    │
│                              │              │
│                        ┌─────▼──────┐       │
│                        │  Local D1  │       │
│                        │  (SQLite)  │       │
│                        └────────────┘       │
│                                             │
└─────────────────────────────────────────────┘
```

## FAQ

### Do I need Cloudflare account?
No, for local development everything runs locally.

### Can I use this for production?
No, this is for local development. Use the production deployment guide.

### How do I add new npm packages?
1. Stop docker-compose
2. Add package to `package.json` or run `npm install <package>`
3. Rebuild: `docker-compose build`
4. Start: `docker-compose up`

### Can I use different Node versions?
Edit `Dockerfile.frontend` and `Dockerfile.backend` to change from `node:20-alpine`.

## Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/personal-cms/issues)
- **Full Documentation**: [README.md](./README.md)
- **Deployment Guide**: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

**Happy Coding!** 🚀

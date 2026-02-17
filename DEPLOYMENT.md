# Personal CMS - Deployment Guide

Complete guide for deploying the Personal CMS application to Cloudflare Workers with D1 database and R2 storage.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Setup](#local-development-setup)
9. [Database Setup](#database-setup)
10. [R2 Storage Setup](#r2-storage-setup)
11. [Environment Configuration](#environment-configuration)
12. [Deployment to Production](#deployment-to-production)
13. [Post-Deployment Verification](#post-deployment-verification)
14. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- **Node.js 20.x** - Use nvm: `nvm use 20`
- **npm 10.x** - Comes with Node.js 20
- **Cloudflare account** - Sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
- **Wrangler CLI** - Installed via `npm install` (already in package.json)
- **Git** - For version control

### Cloudflare Requirements

1. Sign up for Cloudflare account (free tier works)
2. Verify your email address
3. Get your Account ID from the dashboard

---

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
cd personal-cms
nvm use 20
npm install
```

### 2. Configure Wrangler

Login to Cloudflare:

```bash
npx wrangler login
```

This opens a browser window to authenticate with Cloudflare.

### 3. Update wrangler.toml

Edit `wrangler.toml` and set your account ID:

```toml
account_id = "your-account-id-here"  # Get from Cloudflare dashboard
```

---

## Database Setup

### 1. Create D1 Database

**For Development:**

```bash
npx wrangler d1 create personal-cms-dev
```

**For Production:**

```bash
npx wrangler d1 create personal-cms-prod
```

### 2. Update wrangler.toml with Database IDs

Copy the database IDs from the command output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "personal-cms-dev"
database_id = "your-dev-database-id"

[env.production.d1_databases]
binding = "DB"
database_name = "personal-cms-prod"
database_id = "your-prod-database-id"
```

### 3. Run Database Migrations

Create the schema file `migrations/001_initial_schema.sql`:

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Files table
CREATE TABLE files (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,
  content_r2_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Permissions table
CREATE TABLE permissions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  user_id TEXT,  -- NULL = public permission
  permission TEXT NOT NULL CHECK(permission IN ('read', 'write')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Highlights table
CREATE TABLE highlights (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  color TEXT NOT NULL,
  text_snapshot TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Sessions table
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_files_owner ON files(owner_id);
CREATE INDEX idx_files_path ON files(path);
CREATE INDEX idx_permissions_file ON permissions(file_id);
CREATE INDEX idx_permissions_user ON permissions(user_id);
CREATE INDEX idx_highlights_file ON highlights(file_id);
CREATE INDEX idx_highlights_user ON highlights(user_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token_hash);
```

Apply migrations:

```bash
# Development
npx wrangler d1 execute personal-cms-dev --file=./migrations/0001_initial.sql

# Production
npx wrangler d1 execute personal-cms-prod --file=./migrations/0001_initial.sql
```

---

## R2 Storage Setup

### 1. Create R2 Buckets

**For Development:**

```bash
npx wrangler r2 bucket create personal-cms-dev
```

**For Production:**

```bash
npx wrangler r2 bucket create personal-cms-prod
```

### 2. Update wrangler.toml with Bucket Bindings

```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "personal-cms-dev"

[env.production.r2_buckets]
binding = "R2_BUCKET"
bucket_name = "personal-cms-prod"
```

---

## Environment Configuration

### 1. Set Environment Variables

**Development** (in `wrangler.toml`):

```toml
[vars]
ENVIRONMENT = "development"
JWT_SECRET = "dev-secret-key-change-in-production-minimum-32-chars"
```

**Production** (use Wrangler secrets for sensitive data):

```bash
# Generate a strong JWT secret (32+ characters)
openssl rand -base64 32

# Set as a secret (not in wrangler.toml)
npx wrangler secret put JWT_SECRET --env production
# Paste the generated secret when prompted
```

Update production vars in `wrangler.toml`:

```toml
[env.production.vars]
ENVIRONMENT = "production"
# JWT_SECRET is set as a secret above, not here
```

### 2. Configure CORS (for production)

Edit `workers/index.ts` to restrict CORS in production:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": env.ENVIRONMENT === "production"
    ? "https://yourdomain.com"  // Replace with your frontend domain
    : "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true",
};
```

---

## Deployment to Production

### 1. Run Tests

Ensure all tests pass before deploying:

```bash
npm test
```

### 2. Build Frontend (if applicable)

```bash
cd frontend
npm run build
cd ..
```

### 3. Deploy Workers

**Deploy to Production:**

```bash
npx wrangler deploy --env production
```

**Deploy to Development/Staging:**

```bash
npx wrangler deploy
```

### 4. View Deployment

After deployment, Wrangler will output your worker URL:

```
Published personal-cms (production)
  https://personal-cms.your-subdomain.workers.dev
```

---

## Post-Deployment Verification

### 1. Health Check

Test the health endpoint:

```bash
curl https://personal-cms.your-subdomain.workers.dev/health
```

Expected response:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "environment": "production",
    "timestamp": 1234567890
  }
}
```

### 2. Create First Admin User

```bash
curl -X POST https://personal-cms.your-subdomain.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "secure-password-123"
  }'
```

### 3. Test Authentication

```bash
curl -X POST https://personal-cms.your-subdomain.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "secure-password-123"
  }'
```

### 4. Monitor Logs

View real-time logs:

```bash
npx wrangler tail --env production
```

---

## Troubleshooting

### Common Issues

#### 1. "Database binding not found"

**Problem:** Worker can't connect to D1 database.

**Solution:**
- Verify database ID in `wrangler.toml` matches the created database
- Run `npx wrangler d1 list` to see all databases
- Ensure migrations have been applied

#### 2. "R2 bucket not found"

**Problem:** Worker can't access R2 storage.

**Solution:**
- Verify bucket name in `wrangler.toml`
- Run `npx wrangler r2 bucket list` to see all buckets
- Ensure bucket exists in the correct account

#### 3. "Invalid token format"

**Problem:** JWT authentication failing.

**Solution:**
- Verify JWT_SECRET is set correctly
- For production, ensure it's set as a secret: `npx wrangler secret put JWT_SECRET --env production`
- JWT_SECRET must be at least 32 characters

#### 4. "CORS error in browser"

**Problem:** Frontend can't access API due to CORS.

**Solution:**
- Update `Access-Control-Allow-Origin` in `workers/index.ts`
- For production, set it to your frontend domain
- Ensure credentials are enabled if using cookies

#### 5. Tests failing with "binding not found"

**Problem:** Vitest can't find D1 or R2 bindings.

**Solution:**
- Check `vitest.config.ts` has correct binding names
- Ensure `d1Databases` and `r2Buckets` are defined in test config
- Run tests with `npm test` (not `vitest` directly)

### Viewing Worker Configuration

```bash
# List all D1 databases
npx wrangler d1 list

# List all R2 buckets
npx wrangler r2 bucket list

# View current secrets
npx wrangler secret list --env production

# View worker status
npx wrangler deployments list --env production
```

### Rolling Back

If deployment fails:

```bash
# View recent deployments
npx wrangler deployments list --env production

# Rollback to previous version
npx wrangler rollback --message "Rolling back due to issue"
```

---

## Performance Optimization

### 1. Enable Caching

Add cache headers for static content:

```typescript
// In workers/files.ts
return new Response(content, {
  headers: {
    "Content-Type": "text/plain",
    "Cache-Control": "public, max-age=3600",
  },
});
```

### 2. Database Query Optimization

- Use indexes on frequently queried columns (already created in migrations)
- Limit query results with `LIMIT` clause
- Use prepared statements (already implemented)

### 3. R2 Optimization

- Use multipart uploads for files > 5MB
- Set appropriate cache headers
- Consider CDN for public files

---

## Security Checklist

Before going to production:

- [ ] Change JWT_SECRET to a strong random value (32+ chars)
- [ ] Set JWT_SECRET as a Wrangler secret (not in wrangler.toml)
- [ ] Restrict CORS to specific domains
- [ ] Enable HTTPS only (automatic with Workers)
- [ ] Set secure cookie flags (HttpOnly, Secure, SameSite)
- [ ] Review and limit file upload sizes
- [ ] Implement rate limiting (future enhancement)
- [ ] Enable logging and monitoring
- [ ] Set up alerts for errors and downtime
- [ ] Regular security audits of dependencies

---

## Monitoring and Maintenance

### Cloudflare Dashboard

Monitor your worker at: `https://dash.cloudflare.com`

- View request metrics
- Monitor error rates
- Check CPU/memory usage
- View logs and traces

### Automated Backups

D1 databases are automatically backed up by Cloudflare. To create manual backups:

```bash
# Export database to SQL
npx wrangler d1 export personal-cms-prod --output=backup-$(date +%Y%m%d).sql
```

### Database Maintenance

```bash
# View database info
npx wrangler d1 info personal-cms-prod

# Query database directly
npx wrangler d1 execute personal-cms-prod --command="SELECT COUNT(*) FROM users"
```

---

## Scaling Considerations

Cloudflare Workers automatically scale, but consider:

1. **D1 Limits:**
   - 10 GB per database (contact Cloudflare for more)
   - 50,000 reads/day (free tier)
   - 100,000 writes/day (free tier)

2. **R2 Limits:**
   - 10 GB storage (free tier)
   - 1 million Class A operations/month (free tier)
   - 10 million Class B operations/month (free tier)

3. **Workers Limits:**
   - 100,000 requests/day (free tier)
   - 10ms CPU time per request
   - 128 MB memory per request

For production workloads, consider upgrading to Workers Paid ($5/month) or Workers Unbound.

---

## Support

- **Documentation:** [developers.cloudflare.com/workers](https://developers.cloudflare.com/workers/)
- **Community:** [community.cloudflare.com](https://community.cloudflare.com/)
- **Discord:** [discord.gg/cloudflaredev](https://discord.gg/cloudflaredev)
- **Issues:** [GitHub Issues](https://github.com/yourusername/personal-cms/issues)

---

## Next Steps

After successful deployment:

1. **Implement Frontend:** Connect React frontend to backend APIs
2. **Add Real-time Collaboration:** Implement Durable Objects (Phase 5)
3. **Create Admin Panel:** Build admin interface (Phase 3.6)
4. **Add Analytics:** Track usage and performance
5. **Implement Rate Limiting:** Protect against abuse
6. **Add Email Notifications:** For important events
7. **Create Documentation:** API docs and user guides

---

**Deployment Complete!** 🎉

Your Personal CMS is now running on Cloudflare's global edge network with sub-50ms latency worldwide.

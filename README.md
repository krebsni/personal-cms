# Personal CMS - Advanced Markdown Content Management System

A sophisticated content management system for publishing and managing markdown files with multi-user access control, real-time collaboration, and advanced features like color highlighting and nested link previews.

## Features

- **🔐 Multi-level Access Control**: Public, authenticated users, and admin sections
- **📁 File & Folder Management**: Upload, organize, and manage markdown files with nested folders
- **🎨 Color Highlighting**: Select and highlight text with configurable colors (admin-managed palette)
- **🔗 Smart Link Previews**: Obsidian-style nested link previews (hover on desktop, long-press on mobile)
- **⚡ Real-time Collaboration**: Multiple users can work simultaneously with live updates
- **📱 Responsive Design**: Optimized for both mobile and desktop experiences
- **🚀 Serverless Architecture**: Cloudflare Pages + Workers + D1 + R2 (generous free tier)

## Tech Stack

### Frontend
- React 19 + TypeScript
- Vite (build tool)
- TailwindCSS (styling)
- React Router (routing)
- Zustand (state management)
- react-markdown + remark-gfm (markdown rendering)

### Backend
- Cloudflare Workers (serverless functions)
- Cloudflare D1 (SQLite database at edge)
- Cloudflare R2 (object storage)
- Durable Objects (real-time WebSocket)

## Prerequisites

✅ **Node.js 20+** is required for this project (Vite 7, React Router 7, Wrangler).

### Install Node.js 20+ (Required for Deployment)

**Option 1: Using nvm (Recommended)**
```bash
# Install nvm if you don't have it
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Install and use Node 20
nvm install 20
nvm use 20
```

**Option 2: Using Volta**
```bash
# Install Volta
curl https://get.volta.sh | bash

# Install Node 20
volta install node@20
```

**Option 3: Download from nodejs.org**
Visit [nodejs.org](https://nodejs.org/) and download Node.js 20 LTS.

### Other Requirements
- npm (comes with Node.js)
- Cloudflare account (free tier available)
- Git (for version control)

## Installation

### 1. Clone and Install Dependencies

```bash
cd personal-cms
npm install
```

Note: The frontend lives in `apps/web/` and is wired via npm workspaces. Root scripts proxy into `apps/web/`.

### 2. Create Environment Files

```bash
cp apps/web/.env.example apps/web/.env
cp apps/api/.env.example apps/api/.env
```

Edit the app env files with your configuration:
```env
# apps/web/.env
VITE_API_URL=http://localhost:8787
VITE_WS_URL=ws://localhost:8787
```

```env
# apps/api/.env
JWT_SECRET=your-development-secret-key-change-in-production
ENVIRONMENT=development
```

## Local Development

### Option 1: Frontend Only (Quick Start)

For frontend development without backend:

```bash
npm run dev
```

Visit: http://localhost:5173

### Option 2: Full Stack (Frontend + Workers)

**Important**: Requires Node.js 20+

#### Step 1: Create Local D1 Database

```bash
# Create local D1 database
npx wrangler d1 create personal-cms-local

# Note the database ID from the output, update wrangler.toml if needed
```

#### Step 2: Run Migrations

```bash
# Apply database schema
npx wrangler d1 migrations apply personal-cms-local --local
```

#### Step 3: (Optional) Seed Database

Create a `seed.sql` file with test data:

```sql
-- Admin user (password: admin)
-- Password hash is bcrypt of 'admin'
INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
VALUES
  ('admin-1', 'admin', 'admin@example.com', '$2a$10$...', 'admin', strftime('%s', 'now'), strftime('%s', 'now')),
  ('user-1', 'testuser', 'user@example.com', '$2a$10$...', 'user', strftime('%s', 'now'), strftime('%s', 'now'));
```

Run seed:
```bash
npx wrangler d1 execute personal-cms-local --file=seed.sql --local
```

#### Step 4: Start Development Servers

```bash
# Start both frontend and backend
npm run dev:all

# Or run separately:
# Terminal 1: npm run dev:frontend
# Terminal 2: npm run dev:workers
```

Visit: http://localhost:5173 (frontend proxies API to :8787)

## Project Structure

```
personal-cms/
├── apps/                     # App workspace root
│   ├── web/                  # Frontend React app
│   │   ├── src/
│   │   │   ├── components/   # React components
│   │   │   │   ├── auth/     # Login, Register
│   │   │   │   ├── layout/   # Header, Sidebar
│   │   │   │   ├── markdown/ # MDRenderer, LinkPreview
│   │   │   │   ├── editor/   # HighlightOverlay, ColorPicker
│   │   │   │   ├── files/    # FileBrowser, FileTree
│   │   │   │   └── admin/    # UserManagement
│   │   │   ├── hooks/        # Custom React hooks
│   │   │   ├── store/        # Zustand stores
│   │   │   ├── lib/          # Utilities
│   │   │   ├── pages/        # Route pages
│   │   │   └── types.ts      # TypeScript types
│   ├── api/                  # Cloudflare Workers (backend)
│   │   ├── index.ts          # Main worker router
│   │   ├── auth.ts           # Authentication API
│   │   ├── files.ts          # File CRUD operations
│   │   ├── permissions.ts    # Permission management
│   │   ├── highlights.ts     # Highlight annotations
│   │   └── collaboration.ts  # Durable Object (WebSocket)
├── migrations/              # D1 database migrations
│   └── 0001_initial.sql    # Initial schema
├── public/                  # Static assets
├── wrangler.toml           # Cloudflare configuration
└── package.json            # Dependencies and scripts
```

## Deployment to Cloudflare

### Prerequisites
1. Cloudflare account (sign up at [cloudflare.com](https://cloudflare.com))
2. Node.js 20+ installed
3. Wrangler CLI (installed via npm)

### Step 1: Login to Cloudflare

```bash
npx wrangler login
```

### Step 2: Create Production Database

```bash
# Create production D1 database
npx wrangler d1 create personal-cms-prod

# Copy the database_id from output and update wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "personal-cms-prod"
# database_id = "<your-database-id>"
```

### Step 3: Apply Migrations to Production

```bash
npx wrangler d1 migrations apply personal-cms-prod
```

### Step 4: Create R2 Bucket

```bash
# Create R2 bucket for file storage
npx wrangler r2 bucket create personal-cms-files

# Update wrangler.toml:
# [[r2_buckets]]
# binding = "R2_BUCKET"
# bucket_name = "personal-cms-files"
```

### Step 5: Set Production Secrets

```bash
# Generate a secure JWT secret (use a password generator for 256-bit key)
npx wrangler secret put JWT_SECRET
# Paste your secure secret when prompted
```

### Step 6: Deploy Workers

```bash
# Deploy backend workers
npx wrangler deploy
```

### Step 7: Deploy Frontend to Cloudflare Pages

```bash
# Build frontend
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy apps/web/dist --project-name=personal-cms
```

### Step 8: Configure Custom Domain (Optional)

In Cloudflare dashboard:
1. Go to Workers & Pages
2. Select your project
3. Go to Settings > Domains
4. Add your custom domain

Or via CLI:
```bash
npx wrangler pages domain add personal-cms yourdomain.com
```

### Continuous Deployment (Recommended)

1. Push your code to GitHub
2. In Cloudflare dashboard, go to Workers & Pages
3. Click "Create application" > "Pages" > "Connect to Git"
4. Select your repository
5. Set build command: `npm run build`
6. Set build output directory: `dist`
7. Add environment variables from your `.env`

Every push to `main` will auto-deploy!

## Alternative: Deploy to AWS S3 (Fallback)

If you prefer AWS over Cloudflare:

### Architecture Changes
- Frontend: S3 + CloudFront
- Backend: API Gateway + Lambda
- Database: DynamoDB
- Storage: S3
- Real-time: API Gateway WebSockets + Lambda

### Deployment Steps

1. Install AWS CDK or Serverless Framework:
```bash
npm install -g aws-cdk
# or
npm install -g serverless
```

2. Configure AWS credentials:
```bash
aws configure
```

3. Deploy backend:
```bash
serverless deploy
# or
cdk deploy
```

4. Build and deploy frontend:
```bash
npm run build
aws s3 sync apps/web/dist/ s3://your-bucket-name
```

5. Setup CloudFront distribution for HTTPS and caching

**Trade-offs:**
- ❌ More complex setup (multiple services)
- ❌ Lambda cold starts (~100-500ms)
- ❌ Higher costs at scale (~$15-30/month after free tier)
- ✅ More mature ecosystem
- ✅ Better AWS service integration

## Development Workflow

### Running Tests
```bash
npm run test
```

### Linting
```bash
npm run lint
```

### Typechecking
```bash
npm run typecheck
```

### Full Check (Lint + Typecheck + Tests)
```bash
npm run check
```

### Formatting
```bash
npm run format
```

### Database Operations

**Create Migration:**
```bash
# Create new migration file
touch migrations/0002_your_migration.sql
```

**Apply Migration:**
```bash
# Local
npx wrangler d1 migrations apply personal-cms-local --local

# Production
npx wrangler d1 migrations apply personal-cms-prod
```

**Query Database:**
```bash
# Local
npx wrangler d1 execute personal-cms-local --command="SELECT * FROM users" --local

# Production
npx wrangler d1 execute personal-cms-prod --command="SELECT * FROM users"
```

## Usage Guide

### Admin Tasks

**Create First Admin User:**
After deployment, you'll need to manually create the first admin user via Wrangler:

```bash
npx wrangler d1 execute personal-cms-prod --command="
INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
VALUES ('admin-1', 'admin', 'admin@yourdomain.com', '<bcrypt-hash>', 'admin', strftime('%s', 'now'), strftime('%s', 'now'));
"
```

Generate bcrypt hash in Node.js:
```javascript
const bcrypt = require('bcrypt');
bcrypt.hash('your-password', 10, (err, hash) => console.log(hash));
```

**Add Users:**
1. Login as admin
2. Go to Admin panel
3. Click "Add User"
4. Enter username, email, password
5. Select role (user/admin)

**Manage Colors:**
1. Go to Admin > Highlight Colors
2. Add/remove/reorder colors
3. Users will see updated colors in picker

**Set Permissions:**
1. Right-click file/folder
2. Select "Manage Permissions"
3. Add users or set as public
4. Choose read/write access

### User Tasks

**Upload Files:**
1. Click "Upload" button
2. Select markdown files
3. Files are private by default
4. Share via permissions panel

**Highlight Text:**
1. Select text in markdown file
2. Color picker appears
3. Choose color
4. Highlight persists per user

**Preview Links:**
- **Desktop**: Hover over link
- **Mobile**: Long-press link
- Works recursively (preview in preview)

## Troubleshooting

### Node Version Issues

**Error**: `Wrangler requires at least Node.js v20.0.0`

**Solution**: Upgrade to Node 20+ (see Prerequisites section)

### Build Failures

**Error**: `EBADENGINE Unsupported engine`

**Solution**: These are warnings, not errors. The app should still work. Upgrade Node to remove warnings.

### Workers Not Responding

**Check logs:**
```bash
npx wrangler tail
```

### Database Issues

**Reset local database:**
```bash
rm -rf .wrangler/
npx wrangler d1 migrations apply personal-cms-local --local
```

### CORS Errors

Ensure your Workers are configured to allow CORS in `apps/api/index.ts`:
```typescript
headers: {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}
```

## Cost Estimates

### Cloudflare Free Tier (Generous!)
- **Pages**: Unlimited requests, unlimited bandwidth ✅
- **Workers**: 100,000 requests/day ✅
- **D1**: 5GB storage, 5M reads/day, 100K writes/day ✅
- **R2**: 10GB storage, 1M Class A ops, 10M Class B ops/month ✅
- **Durable Objects**: 1M requests/month ✅

**Expected Costs (10 active users):**
- Months 1-12: **$0/month** (within free tier)
- After limits: **~$5-10/month**

### AWS Free Tier (First 12 Months)
- **After 12 months**: ~$15-30/month
- More expensive at scale

## Future Enhancements

Planned features for Phase 2:
- Full-text search across all markdown files
- WYSIWYG markdown editor (Tiptap/Milkdown)
- Inline comments & @mentions
- File version control & history
- Export to PDF
- Public sharing links with expiry
- Mobile native apps (React Native)
- GitHub sync for backup
- Teams & groups for easier permission management
- Email notifications
- Analytics dashboard

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License

## Support

For issues or questions:
- Check the troubleshooting section
- Review Cloudflare Workers docs
- Open an issue on GitHub

## Acknowledgments

Built with:
- React & TypeScript
- Cloudflare Workers Platform
- TailwindCSS
- react-markdown
- And many other open-source libraries

---

**Next Steps**: Start implementing Phase 2 (Authentication System) from the implementation plan!

**Happy Building! 🚀**

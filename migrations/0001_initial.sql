-- Personal CMS Database Schema
-- SQLite (Cloudflare D1)

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Files Table
CREATE TABLE IF NOT EXISTS files (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,
  content_r2_key TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index on path and owner for faster lookups
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);

-- Folders Table
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  owner_id TEXT NOT NULL,
  parent_id TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE
);

-- Create index on path and parent for faster tree queries
CREATE INDEX IF NOT EXISTS idx_folders_path ON folders(path);
CREATE INDEX IF NOT EXISTS idx_folders_parent ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_owner ON folders(owner_id);

-- Permissions Table (File-level)
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  user_id TEXT,  -- NULL means public access
  permission TEXT NOT NULL CHECK(permission IN ('read', 'write')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for permission lookups
CREATE INDEX IF NOT EXISTS idx_permissions_file ON permissions(file_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_file_user ON permissions(file_id, user_id);

-- Folder Permissions Table
CREATE TABLE IF NOT EXISTS folder_permissions (
  id TEXT PRIMARY KEY,
  folder_id TEXT NOT NULL,
  user_id TEXT,  -- NULL means public access
  permission TEXT NOT NULL CHECK(permission IN ('read', 'write')),
  recursive INTEGER NOT NULL DEFAULT 1,  -- 1 = recursive, 0 = non-recursive
  created_at INTEGER NOT NULL,
  FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for folder permission lookups
CREATE INDEX IF NOT EXISTS idx_folder_permissions_folder ON folder_permissions(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_permissions_user ON folder_permissions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_folder_permissions_folder_user ON folder_permissions(folder_id, user_id);

-- Highlights Table (User-specific text highlighting)
CREATE TABLE IF NOT EXISTS highlights (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  color TEXT NOT NULL,
  text_snapshot TEXT NOT NULL,  -- For drift detection
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for highlight lookups
CREATE INDEX IF NOT EXISTS idx_highlights_file_user ON highlights(file_id, user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);

-- Highlight Colors Configuration Table (Admin-managed)
CREATE TABLE IF NOT EXISTS highlight_colors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hex_code TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

-- Create index on sort order
CREATE INDEX IF NOT EXISTS idx_highlight_colors_sort ON highlight_colors(sort_order);

-- Insert default highlight colors
INSERT INTO highlight_colors (id, name, hex_code, sort_order) VALUES
  ('color_yellow', 'Yellow', '#FEF08A', 1),
  ('color_green', 'Green', '#BBF7D0', 2),
  ('color_blue', 'Blue', '#BFDBFE', 3),
  ('color_red', 'Red', '#FECACA', 4),
  ('color_purple', 'Purple', '#E9D5FF', 5),
  ('color_orange', 'Orange', '#FED7AA', 6);

-- Sessions Table (for JWT token management and revocation)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create index for session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Activity Log Table (optional, for audit trail)
CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Create index for activity log lookups
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

-- Migration metadata
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

INSERT INTO schema_migrations (version, applied_at) VALUES ('0001_initial', strftime('%s', 'now'));

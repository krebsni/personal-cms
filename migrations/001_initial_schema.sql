-- Personal CMS - Initial Database Schema
-- Migration: 001
-- Date: 2026-02-13
-- Description: Create all initial tables for users, files, permissions, highlights, and sessions

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Files table
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

-- Permissions table
-- user_id = NULL means public permission
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  file_id TEXT NOT NULL,
  user_id TEXT,
  permission TEXT NOT NULL CHECK(permission IN ('read', 'write')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Highlights table
-- Stores text annotations with offset-based positioning
CREATE TABLE IF NOT EXISTS highlights (
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
-- Stores authentication session tokens
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Highlight colors table
-- Stores available colors for text highlighting
CREATE TABLE IF NOT EXISTS highlight_colors (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  hex_code TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_files_owner ON files(owner_id);
CREATE INDEX IF NOT EXISTS idx_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_permissions_file ON permissions(file_id);
CREATE INDEX IF NOT EXISTS idx_permissions_user ON permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_file ON highlights(file_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_highlight_colors_order ON highlight_colors(display_order);

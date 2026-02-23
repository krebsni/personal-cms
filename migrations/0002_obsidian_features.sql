-- Migration: Obsidian-like Features
-- Description: Adds multiple file ownership, highlights, and highlight colors.

-- 1. Create file_owners table for many-to-many relationship
CREATE TABLE file_owners (
  file_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (file_id, user_id),
  FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 2. Migrate existing owners to file_owners
INSERT INTO file_owners (file_id, user_id, created_at)
SELECT id, owner_id, created_at FROM files;

-- 3. Create highlights table
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

-- 4. Create highlight_colors table (admin defined)
CREATE TABLE highlight_colors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  hex_code TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- 5. Seed default highlight colors
INSERT INTO highlight_colors (id, name, hex_code, sort_order) VALUES
  ('color-yellow', 'Yellow', '#FFEB3B', 1),
  ('color-green', 'Green', '#4CAF50', 2),
  ('color-blue', 'Blue', '#2196F3', 3),
  ('color-red', 'Red', '#F44336', 4),
  ('color-purple', 'Purple', '#9C27B0', 5);

-- Note: We are keeping the owner_id column in files for now to avoid complex table recreation in SQLite,
-- but the application logic should switch to using file_owners.

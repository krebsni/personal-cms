-- Migration: Repositories and Folder/File Assignments
-- Description: Adds repositories, assignments, notifications, and updates files/folders.

-- 1. Create Repositories table
CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_repositories_owner_id ON repositories(owner_id);

-- 2. Create Assignments table (for cascading folder/file permissions)
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  resource_id TEXT NOT NULL, -- Either folder_id or file_id
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('viewer', 'editor')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  -- Note: We don't enforce foreign key on resource_id since it could be files or folders
);

CREATE INDEX IF NOT EXISTS idx_assignments_resource_id ON assignments(resource_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_user_resource ON assignments(user_id, resource_id);

-- 3. Create Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g. 'access_request'
  resource_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'granted', 'denied')),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);

-- 4. Alter Files table to add new columns
-- SQLite ALTER TABLE ADD COLUMN constraints: cannot have NOT NULL without DEFAULT
ALTER TABLE files ADD COLUMN parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE;
ALTER TABLE files ADD COLUMN repository_id TEXT REFERENCES repositories(id) ON DELETE CASCADE;
ALTER TABLE files ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;

-- 5. Alter Folders table to add new columns
ALTER TABLE folders ADD COLUMN repository_id TEXT REFERENCES repositories(id) ON DELETE CASCADE;
ALTER TABLE folders ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;

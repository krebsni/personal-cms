-- Seed data for development
-- Users (password: admin123 / user123)

INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at)
VALUES
  ('admin-1', 'admin', 'admin@example.com', '$2b$10$Z0idbz4T3K042y95okhVSe1vHyzmHtM6sY/XtAAWL88nIuZGOqIv6', 'admin', strftime('%s', 'now'), strftime('%s', 'now')),
  ('user-1', 'user', 'user@example.com', '$2b$10$BtAkTyGHALCP/HDbocxVDONN.5shOTZOprbYxbhDYPPrn78Q237y2', 'user', strftime('%s', 'now'), strftime('%s', 'now'));

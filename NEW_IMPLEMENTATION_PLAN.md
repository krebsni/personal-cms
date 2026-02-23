# Personal CMS - New Implementation Plan

## 1. Goal and Vision
The goal is to rebuild the Personal CMS into a premium, Obsidian-like web application. The application will center around "Repositories" (like vaults) containing folder structures of markdown files. It will support granular collaborative features, including unified read/highlight modes, raw code editing for owners, link previews, and access requests. The stack will use Cloudflare Workers (D1, R2, Durable Objects) for the backend and a modern React frontend deployed on Cloudflare Pages.

## 2. Database Schema Additions & Changes
To support the new requirements, we will expand the existing D1 schema:

### Users Table (Updates)
- Enforce unique `username` and `email`.
- Role management (`admin`, `user`).

### Repositories (New)
- **Fields**: `id`, `name`, `owner_id`, `created_at`.
- A grouping mechanism for files and folders (similar to Obsidian Vaults).

### Folder / File Assignments (New/Updated)
- **Fields**: `resource_id` (folder or file ID), `user_id`, `role` (viewer, editor).
- Allows admins or owners to assign users to specific folders or files. Folder assignments automatically cascade down to all subfolders and files inside them.

### Files / Folders (Updates)
- **Fields**: `id`, `name`, `parent_id` (parent folder ID), `repository_id`, `is_public` (boolean), `created_at`.
- Link to `repository_id`.
- **Visibility**: `is_public` (boolean). If true, anyone can read; if false, restricted to owner/assigned.

### Notifications (New)
- **Fields**: `id`, `recipient_id`, `sender_id`, `type` (e.g., 'access_request'), `resource_id` (file/folder), `status` (pending, granted, denied), `created_at`.
- Used to notify owners when someone requests access to a restricted link.

## 3. Backend API Implementation

### 3.1 Admin API
- **Manage Users**: List users, promote to admin.
- **Manage Repositories**: List all repositories.
- **Manage Highlights**: Configure the available color palette for highlighting.

### 3.2 Repositories & Files API
- CRUD operations for Repositories.
- File operations scoped to repositories.
- Manage assignments on folders and files (granting read/write to specific users via email/username). Assignments cascade to subfolders and files.

### 3.3 Collaboration & Highlight API
- **Highlighting Sync**: Optimistic locking implementation via REST APIs or Durable Objects (WebSockets). When a user highlights text, they send the offset and style (bold, cursive, underline, color).
- **Code Edit API**: Separate endpoint to update the raw Markdown content (restricted to owners).

### 3.4 Notifications API
- `POST /api/notifications/request-access` - Triggered when a user hovers a link they don't have access to.
- `GET /api/notifications` - Retrieve alerts for the top bar.
- `POST /api/notifications/:id/grant` - Owner 1-click access grant.

## 4. Frontend Application System (React 19, Vite, TailwindCSS)

### 4.1 UI/UX Design
- **Premium Aesthetics**: Dark mode by default, modern typography (Inter/Outfit), fluid micro-animations, glassmorphism, and a highly polished UI. Wait time should feel instantaneous.
- **Top Bar**: Global search, Notification bell (with interactive dropdown to grant access), User Profile.

### 4.2 Views & Modes
- **Admin View**: Tabbed interface to manage Users (promote/delete) and Repositories.
- **Repository View**: A sidebar tree-view showing the markdown file/folder structure. Admins/owners can manage folder/file assignments from here.
- **Unified Markdown Viewer (Read/Highlight Mode)**:
  - Renders files in an Obsidian-like style.
  - Text selection opens a persistent popup to apply styling (colors from the admin palette, bold, italic, underline).
  - Highlights apply optimistically and trigger background sync.
  - **Link Previews**: Hovering a markdown link fetches a preview popover. If the user lacks permissions, the popover provides a "Request Access" button.
- **Code Editor Mode**:
  - Accessible only by the file owner.
  - Raw markdown editor (e.g., using CodeMirror or Monaco) to edit the actual file source, fully independent of highlight annotations.

## 5. Phased Implementation Approach

### Phase 1: Database Schema & Repositories Worker
- Update D1 schema (migrations) to include `repositories`, `assignments` (for folders/files), and `notifications`.
- Update `files` table to include `parent_id`, `repository_id`, and `is_public`.
- Implement `workers/repositories.ts` for Repository CRUD operations.

### Phase 2: Files API & Cascading Assignments
- Update `workers/files.ts` to handle `parent_id` and `repository_id`.
- Implement logic to check permissions based on cascading folder assignments (e.g., a query that climbs the tree to check if a user is assigned to a parent folder).
- Implement assignment endpoints (`POST /api/assignments/:resource_id`, etc.).

### Phase 3: Notifications & Admin API Updates
- Update `workers/admin.ts` to manage repositories and highlight color palettes.
- Implement `workers/notifications.ts` for access requests and grant actions.

### Phase 4: Collaboration & Highlights API Updates
- Refine optimistic locking capabilities in `workers/highlights.ts` (or Durable Objects).
- Create a dedicated raw markdown code edit API endpoint restricted strictly to owners.

### Phase 5: Frontend - Foundation & Repository UI
- Setup base Tailwind styling for the premium aesthetic (Inter font, dark mode colors).
- Build the Layout (Top Bar, Sidebar).
- Implement Admin View for users & repositories.
- Implement Repository View for navigating the file/folder hierarchy.

### Phase 6: Frontend - Unified Markdown Viewer & Editor
- Refactor markdown renderer for the unified "Read & Highlight" Obsidian-style view.
- Implement text selection capture, styling popup menu, and highlight background sync.
- Embed the raw CodeEditor component available for file owners.

### Phase 7: Frontend - Notifications & Link Previews
- Add link hovering to fetch resource previews.
- Implement the "Request Access" UI state.
- Implement the global Notification bell and dropdown for owners to approve requests.

### Phase 8: Verification & Deployment
- Finalize and test integration tests for cascading folder assignments.
- Test visual UI thoroughly (simulated optimistic locking conflicts).
- Finalize production deploy step.

## 6. Verification Plan
- **Backend Tests**: Expand Vitest suites for the new APIs locally.
- **Automated Tests**: Local tests to verify optimistic locking resolution and folder/file cascading assignment access control.
- **Manual Verification**: Verify hover-link preview mechanism, access request, and highlight popup state persistence visually.

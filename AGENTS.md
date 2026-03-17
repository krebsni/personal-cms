# Persistent Agent Instructions

These instructions apply to all future tasks in this repository.

- Always create a plan first when asked to do any task.
- Persist each plan in `plans/` with filename format `yyyy-mm-dd-hh-mm-<meaningful-name>.md`.
- Each plan must include:
  - Timestamp (in filename) and short high-level change description (in filename).
  - Phased tasks with checkboxes.
  - Optional phased tasks depending on complexity.
- Do not execute the plan until the user reviews/approves it.
- As execution proceeds, update the plan checkboxes gradually to reflect progress.
- Create meaningful commits for each phase and create new branch with name `codex/<timestamp>-<meaningful-name>` for each plan.
- After completing the plan, create a pull request to merge the branch back to main.

## Boundaries & Permissions

- ✅ ALWAYS: Read files, run `npm test`, run `wrangler dev`, `git add`, `git commit`
- ⚠️ ASK FIRST: `git push`, `npm install`, `wrangler deploy`, `rm -rf`.
- 🚫 NEVER: `git push --force`, modifying `.env` files.

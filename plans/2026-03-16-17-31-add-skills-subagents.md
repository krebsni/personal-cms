# Plan: Add Project Skills (Subagents)

Timestamp: 2026-03-16 17:31 (Europe/Berlin)

## Phase 1: Skill Requirements
- [x] Identify the highest-value skills for this repo (workflows, tooling, domain knowledge).
- [x] Confirm scope, triggers, and boundaries for each skill.
- [x] Choose which skills need scripts/references/assets.

## Phase 2: Create Skills
- [x] Initialize skills with `init_skill.py` under the appropriate skills path.
- [x] Write concise `SKILL.md` instructions per skill.
- [x] Add optional references/scripts/assets.
- [x] Generate `agents/openai.yaml` metadata.

## Phase 3: Validate
- [x] Run `quick_validate.py` for each skill.
- [ ] (Optional) Forward-test with a subagent if requested.
- [x] Commit per phase (if you want skills in this repo).

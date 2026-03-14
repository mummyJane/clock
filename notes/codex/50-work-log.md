## 2026-03-14 Task 1
- Read `AGENTS.md`, `notes/codex/10-spec.md`, `notes/codex/20-plan.md`, `notes/codex/30-tasks.md`, `notes/codex/40-context.md`, `notes/codex/50-work-log.md`, and `notes/codex/60-decisions.md`.
- Inspected repository layout with `Get-ChildItem -Force`, `Get-ChildItem -Recurse notes`, `Get-ChildItem -Recurse project`, `Get-ChildItem -Recurse install`, `Get-ChildItem -Recurse update`, and `git status --short`.
- Added shared deployment helper script in `project/deploy/lib/common.sh`.
- Added release and latest install entrypoints in `install/`.
- Added release, latest, and test update entrypoints in `update/`.
- Added full install notes in `project/docs/full-install.md`.
- Corrected stale task-file path in `AGENTS.md`.
- Validation attempt: `bash -n` against all shell scripts failed in this Windows workspace with `Bash/Service/CreateInstance/E_ACCESSDENIED`.
- Validation completed: reviewed generated shell entrypoints with `Get-Content` and checked workspace changes with `git diff --stat`.

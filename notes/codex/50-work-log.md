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
- Runtime feedback: install/update scripts on the Pi required `chmod +x install/* update/*` before execution; documented this in the full install notes.

## 2026-03-14 Task 2
- Re-read `AGENTS.md`, `notes/codex/10-spec.md`, `notes/codex/20-plan.md`, `notes/codex/30-tasks.md`, and inspected `project/`.
- Added a dependency-free web interface in `project/web` with `server.py`, static assets, and JSON-backed setup/update metadata.
- Confirmed the web interface runtime depends on `python3`, which is present in the local workspace and expected on Raspberry Pi OS.
- Validation completed: `python -m py_compile project/web/server.py`.
- Validation completed: saved and reloaded settings through `project.web.server` using a workspace-local smoke file.
- Validation completed: started `ThreadingHTTPServer` in-process and fetched `GET /api/system`, which returned HTTP 200 with hostname, release, and update status.

## 2026-03-14 Task 3
- Re-read the `0.1.0` scope in `notes/codex/20-plan.md` and current task list in `notes/codex/30-tasks.md`.
- Verified that rerunning `install/install-latest.sh` correctly keeps the installed release at `0.1.0`, because `latest` currently targets the `0.1.0` baseline.
- Added release note `notes/codex/80-release-0.1.0.md` describing image choice, install flow, SSH setup, and current update behavior.
- Updated install script output to point operators to the setup web interface after installation.
- Recorded current release limitation: the setup UI still reads seeded release/update metadata and should later be wired directly to installed state files.

## 2026-03-14 Task 4
- Re-read `AGENTS.md`, `notes/codex/10-spec.md`, `notes/codex/20-plan.md`, `notes/codex/30-tasks.md`, and the existing `project/web` implementation before editing.
- Added module persistence and APIs in `project/web/server.py`, backed by seeded data in `project/web/data/modules.json`.
- Restructured the setup UI into a page shell with `Overview` and `Modules` pages, then added a `Clock` module page that only appears when the module is enabled.
- Updated `project/web/README.md` with the new module endpoints and `CLOCK_MODULES_FILE` environment variable.
- Validation completed: `python -m py_compile project/web/server.py`.
- Validation completed: saved and reloaded module state through `validate_modules`, `save_json`, and `load_json` using a workspace-local scratch path.
- Validation completed: started `ThreadingHTTPServer` in-process, confirmed `GET /api/modules` returned the default disabled clock module, confirmed `POST /api/modules` enabled it, and confirmed `GET /api/system` reflected the enabled module state.
- Tooling issue: `apply_patch` failed repeatedly for files under `project/web` with `windows sandbox: setup refresh failed with status exit code: 1`, so the Task 4 code files were written via PowerShell `Set-Content` instead.
- Validation issue: initial smoke scripts used `%LOCALAPPDATA%\\Temp` and failed cleanup with `PermissionError`; reran the checks inside `D:\\clock\\.codex-temp-tests` to keep validation inside the writable workspace.

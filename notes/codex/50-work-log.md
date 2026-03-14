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

## 2026-03-14 Task 4.1
- Added `project/modules/README.md` to define the module folder layout.
- Added `project/modules/clock/README.md` as the filesystem home for the built-in clock module.
- Validation completed: inspected the new module paths with `Get-ChildItem -Recurse project/modules`.

## 2026-03-14 Task 5
- Re-read `AGENTS.md`, `notes/codex/10-spec.md`, `notes/codex/20-plan.md`, `notes/codex/30-tasks.md`, `notes/codex/40-context.md`, and the current `project/modules` layout before editing.
- Added `project/modules/api.py` with a standard-library module host API covering time/date reads, alarm registration, config items, draw items, and screen press handlers.
- Added `project/modules/__init__.py`, `project/modules/clock/__init__.py`, and `project/modules/clock/module.py` so the built-in clock module can register against the shared API.
- Updated `project/modules/README.md` and `project/modules/clock/README.md` to document the Task 5 API scaffold.
- Validation completed: `python -m py_compile project/modules/__init__.py project/modules/api.py project/modules/clock/__init__.py project/modules/clock/module.py`.
- Validation completed: registered the built-in clock module through `ModuleHost`, dispatched a screen press event, and confirmed exported state included the expected config item, draw item, alarm, and handler registration.
- Tooling issue: `apply_patch` again failed for `project/` files with `windows sandbox: setup refresh failed with status exit code: 1`, so the Task 5 project files were written via PowerShell `Set-Content`.

## 2026-03-14 Task 6
- Re-read `AGENTS.md`, `notes/codex/10-spec.md`, `notes/codex/20-plan.md`, `notes/codex/30-tasks.md`, and the existing `project/web` module flow before editing.
- Extended `project/web/server.py` to persist and validate clock module settings for display type, hour mode, date format, display size, and screen position.
- Updated `project/web/data/modules.json` with default clock settings while keeping the clock module disabled by default.
- Reworked the enabled clock module page in `project/web/static/index.html`, `project/web/static/app.js`, and `project/web/static/styles.css` to add a settings form and preview summary.
- Updated `project/modules/clock/module.py` so the built-in clock module registration advertises the Task 6 config items through the shared module API.
- Updated `project/web/README.md` to document that `/api/modules` now carries module settings as well as enabled state.
- Validation completed: `python -m py_compile project/web/server.py project/modules/clock/module.py`.
- Validation completed: called `validate_modules()` with a clock settings payload and confirmed the validated settings were preserved.
- Validation completed: started `ThreadingHTTPServer` in-process, saved clock settings through `POST /api/modules`, and confirmed `GET /api/system` returned the saved clock settings.
- Tooling issue: `apply_patch` continued to fail for `project/` files with `windows sandbox: setup refresh failed with status exit code: 1`, so the Task 6 project files were written via PowerShell `Set-Content`.

## 2026-03-14 Task 7
- Re-read `AGENTS.md`, `notes/codex/10-spec.md`, `notes/codex/20-plan.md`, `notes/codex/30-tasks.md`, deployment scripts, and the current web/runtime code before editing.
- Added bedside runtime assets in `project/web/static/bedside.html`, `project/web/static/bedside.css`, and `project/web/static/bedside.js` so enabled modules can be rendered on the device display.
- Updated `project/deploy/lib/common.sh` to seed persistent runtime JSON state in `/var/lib/clock`, write the service environment file, install runtime assets, enable the web service, and configure boot-to-desktop behavior.
- Added deployment assets `project/deploy/systemd/clock-web.service`, `project/deploy/autostart/clock-bedside.desktop`, and `project/deploy/bin/start-bedside.sh`.
- Added release-specific installers and updaters for `0.2.0` and moved `install-latest.sh`, `update-latest.sh`, and `update-test.sh` to target `0.2.0`.
- Updated `project/docs/full-install.md`, `project/web/README.md`, and added `notes/codex/80-release-0.2.0.md` for the new runtime and release behavior.
- Validation completed: `python -m py_compile project/web/server.py project/modules/clock/module.py`.
- Validation completed: started `ThreadingHTTPServer` in-process, saved an enabled clock module through `POST /api/modules`, confirmed `GET /bedside.html` returned the bedside page, and confirmed `GET /api/system` exposed the saved enabled-module state and screen position.
- Validation attempt: `bash -n project/deploy/lib/common.sh install/install-0.2.0.sh update/update-0.2.0.sh project/deploy/bin/start-bedside.sh` failed in this Windows workspace with `Bash/Service/CreateInstance/E_ACCESSDENIED`.
- Tooling issue: `apply_patch` continued to fail for `project/` files with `windows sandbox: setup refresh failed with status exit code: 1`, so the Task 7 project files were written via PowerShell `Set-Content`.
- Runtime fix: Raspberry Pi OS Trixie reported `chromium-browser` as unavailable, so `project/deploy/lib/common.sh` was updated to install `chromium` when present and only fall back to `chromium-browser` on older images.

## 2026-03-14 Task 8
- Finalized the `0.2.0` release notes and task tracking after Task 7 runtime testing on Raspberry Pi OS.
- Updated `project/deploy/bin/start-bedside.sh` to pass `--no-first-run`, `--password-store=basic`, and disable password-manager onboarding/import prompts so Chromium kiosk mode does not request the desktop keyring password on autologin.
- Updated `notes/codex/80-release-0.2.0.md` and the `0.2.0` delivery notes to include the keyring-prompt workaround.
- Validation completed: reviewed the updated kiosk launcher flags in `project/deploy/bin/start-bedside.sh`.

## 2026-03-14 Task 9
- Re-read `AGENTS.md`, `notes/codex/20-plan.md`, `notes/codex/30-tasks.md`, and the current web update flow before editing.
- Extended `project/web/server.py` to store a `repo_path` in setup settings and added `POST /api/update-status/check` to run `git fetch` plus ahead/behind checks against the configured checkout.
- Updated `project/web/static/index.html` and `project/web/static/app.js` so setup preferences include the repository path and the `Check again` button performs a live backend update check instead of only reloading cached metadata.
- Updated `project/web/data/update-status.json` and `project/web/README.md` to match the new update-check behavior.
- Validation completed: `python -m py_compile project/web/server.py`.
- Validation completed: called `validate_settings()` and `check_update_status()` directly against the current repository path and confirmed a valid update result was returned.
- Validation completed: started `ThreadingHTTPServer` in-process, saved a repository path in settings, called `POST /api/update-status/check`, and confirmed `GET /api/update-status` returned the saved live git-check result.
- Tooling issue: `apply_patch` continued to fail for `project/` files with `windows sandbox: setup refresh failed with status exit code: 1`, so the Task 9 project files were written via PowerShell `Set-Content`.

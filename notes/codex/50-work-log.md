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
- Extended the Task 9 backend with `GET /api/system-status`, plus `POST /api/actions/reboot` and `POST /api/actions/halt`, using `CLOCK_POWER_ACTION_MODE=mock` to support safe validation without scheduling a real shutdown.
- Updated the overview UI to show live system health, mount details, and touchscreen reboot/power-off controls.
- Added `project/deploy/sudoers/clock-power-control` and updated `project/deploy/lib/common.sh` so deployed installs copy it to `/etc/sudoers.d/clock-power-control` with mode `0440`.
- Updated `project/docs/full-install.md` and `project/web/README.md` to document the Task 9 health and power-control behavior.
- Validation completed: `python -m py_compile project/web/server.py`.
- Validation completed: started `ThreadingHTTPServer` with `CLOCK_POWER_ACTION_MODE=mock`, confirmed `GET /api/system-status` returned mounts/temperature/battery payloads, and confirmed `POST /api/actions/reboot` plus `POST /api/actions/halt` returned scheduled mock responses.
- Validation issue: the first Task 9 smoke test used `tempfile.mkdtemp()` under `D:\clock` and still hit a Windows `PermissionError` on the scratch JSON files; reran inside `D:\clock\.codex-temp-tests\task9-http`, which passed.
- Runtime follow-up: update checks against `/home/roger/clock` on the Pi initially failed with git `dubious ownership` because the service runs as `clock` while the checkout is owned by `roger`.
- Fix applied: `project/web/server.py` now runs git commands with `-c safe.directory=<repo_path>` and returns a dedicated `repo-unreadable` status when path probing raises `PermissionError`.
- Validation completed: `check_update_status()` against the local `D:\clock` checkout returned `up-to-date` and resolved the latest tag successfully after the safe-directory change.
- Runtime follow-up: the overview `System health` and `Storage mounts` panels stayed on loading text on the Pi, which indicated `/api/system-status` was likely failing partway through a platform-specific probe.
- Fix applied: hardened `read_battery_voltage()`, `get_mount_status()`, and `build_system_status()` so probe failures return error/unavailable payloads instead of aborting the whole endpoint, and updated `project/web/static/app.js` to replace loading placeholders with a visible error message if the health request fails.
- Validation completed: `python -m py_compile project/web/server.py` and an in-process HTTP smoke test confirmed `GET /api/system-status` still returns HTTP 200 with temperature, battery, and mounts keys.
- Runtime follow-up: the Pi reports RTC backup voltage correctly through `vcgencmd pmic_read_adc BATT_V`, while the earlier `/sys/class/power_supply` probe does not reflect that hardware.
- Fix applied: switched the Task 9 battery probe in `project/web/server.py` to parse `vcgencmd pmic_read_adc BATT_V`, and relabeled the overview field to `RTC battery` in `project/web/static/index.html`.
- Validation completed: `python -m py_compile project/web/server.py` and a direct mocked parser test confirmed `read_battery_voltage()` returns an `rtc` source with the parsed float voltage.

## 2026-03-14 Task 10
- Re-read `AGENTS.md`, `notes/codex/10-spec.md`, `notes/codex/20-plan.md`, `notes/codex/30-tasks.md`, and the current bedside/setup runtime before editing.
- Extended `project/web/server.py` with media library APIs for browsing folders, selecting supported image/audio/video files, changing playback state, and streaming media files with byte-range support.
- Added persistent media state data in `project/web/data/media-state.json` and seeded a repo-local media folder at `project/web/data/media/`.
- Updated `project/web/static/index.html`, `project/web/static/app.js`, and `project/web/static/styles.css` to add a `Media` page with Samba path display, folder browsing, file selection, and selection clearing.
- Updated `project/web/static/bedside.html`, `project/web/static/bedside.js`, and `project/web/static/bedside.css` so selected media is rendered in bedside mode with touch-revealed playback controls that auto-hide after a short timeout.
- Reworked `project/deploy/lib/common.sh` so deployed installs seed `/var/lib/clock/media-state.json`, create `/var/lib/clock/media`, install Samba, and publish a guest `clock-media` share backed by that persistent media directory.
- Updated `project/web/README.md` and `project/docs/full-install.md` to document the new media APIs, Samba share, and bedside playback flow.
- Validation completed: `python -m py_compile project/web/server.py`.
- Validation completed: started `ThreadingHTTPServer` against a workspace-local media root, confirmed `GET /api/media/files` listed media entries, confirmed `POST /api/media/select` and `POST /api/media/action` updated media state, and confirmed `GET /media/photo.jpg` returned HTTP 206 for a range request.
- Tooling issue: `apply_patch` continued to fail for `project/` files with `windows sandbox: setup refresh failed with status exit code: 1`, so the Task 10 project files were edited through PowerShell file writes instead.

## 2026-03-15 Task 10 follow-up
- Re-read AGENTS.md, notes/codex/10-spec.md, notes/codex/20-plan.md, notes/codex/30-tasks.md, and notes/codex/40-context.md before debugging the bedside media regression report.
- Investigated project/web/server.py, project/web/static/bedside.js, and project/web/static/bedside.css after the runtime report that JPEG and WebM worked, MP4 did not, media was not using the full display area, and pause behaved the same as stop.
- Fix applied: added explicit media content-type fallbacks in project/web/server.py for common image, audio, and video extensions and reused that helper when streaming media files.
- Fix applied: updated project/web/static/bedside.js so media actions no longer rebuild the active audio or video element for the same selected file, which preserves playback position for pause and allows stop to reset to the beginning.
- Fix applied: updated project/web/static/bedside.css so active image and video media uses full-screen layout and the playback controls stay anchored over the full display surface.
- Runtime feedback handling: added a bedside video error hint for codec failures so unsupported MP4 files now produce guidance instead of failing silently.
- Validation completed: python -m py_compile project/web/server.py.
- Validation completed: ran a workspace-local Python smoke test against project.web.server to confirm .mp4 is classified as video and that backend media actions still persist distinct pause and stop states.
- Tooling issue: apply_patch still fails in this Windows workspace with "windows sandbox: setup refresh failed with status exit code: 1", so the follow-up edits were written through PowerShell file writes again.
- Follow-up fix: updated project/web/static/bedside.js so video decode errors persist across the bedside polling refresh instead of flashing briefly and disappearing.
- Follow-up fix: updated project/web/static/bedside.html, project/web/static/bedside.js, and project/web/static/bedside.css to add a bedside volume control for audio and video playback and to keep bedside mode blank when all modules are disabled.
- Follow-up fix: extended project/web/server.py with /media/current plus a temporary ffmpeg-backed transcode path for selected MP4, M4V, and MOV files, reusing the original file when ffmpeg is unavailable or transcoding fails.
- Follow-up fix: updated project/web/static/bedside.html and project/web/static/bedside.js so bedside playback now has a boosted 0-300 volume range, stores the chosen volume locally, and resumes the audio context on touch to improve MP3 and low-audio playback.
- Validation completed: python -m py_compile project/web/server.py.
- Validation completed: node --check project/web/static/bedside.js.
- Validation completed: ran a workspace-local Python smoke test to confirm MP4 selection resolves through a temporary .webm playback file and that clearing media removes the temp transcode file.
- Follow-up fix: reworked project/web/server.py and project/web/static/bedside.js so MP4, M4V, and MOV files are prepared in the background with a persisted preparing or ready status instead of blocking the bedside browser on direct playback.
- Validation completed: ran a workspace-local Python smoke test to confirm MP4 selection first returns playback_status=preparing, then updates to playback_status=ready after the background temp .webm file is created.

## 2026-03-16 Task 10 follow-up
- Re-read AGENTS.md, notes/codex/10-spec.md, notes/codex/20-plan.md, notes/codex/30-tasks.md, and notes/codex/40-context.md before changing the bedside video preparation path.
- Investigated project/web/server.py and confirmed the current path still did a full VP9/WebM transcode for selected MP4, M4V, and MOV files.
- Fix applied: updated project/web/server.py so video preparation now probes codecs with ffprobe, writes prepared files as temporary MP4 assets, remuxes H.264/AAC-class sources with `-c copy -movflags +faststart`, and only falls back to an `libx264`/`aac` preparation pass when the source codecs are not browser-friendly.
- Documentation updated: extended project/web/README.md and notes/codex/40-context.md to describe the faster preparation path and the new `CLOCK_FFPROBE_BIN` override.
- Decision logged: recorded the remux-first video preparation choice in notes/codex/60-decisions.md.
- Validation completed: `python -m py_compile project/web/server.py`.
- Validation completed: ran a workspace-local Python smoke test under `D:\clock\.tmp` to confirm H.264/AAC input takes the fast remux path.
- Validation completed: ran a workspace-local Python smoke test under `D:\clock\.tmp` to confirm incompatible input falls back to `libx264`/`aac` instead of the previous VP9/WebM path.
- Tooling issue: `apply_patch` still fails in this Windows workspace with `windows sandbox: setup refresh failed with status exit code: 1`, so this follow-up used PowerShell-mediated file writes again after the patch attempt failed.

## 2026-03-16 Task 11
- Re-read AGENTS.md, notes/codex/10-spec.md, notes/codex/20-plan.md, notes/codex/30-tasks.md, and notes/codex/40-context.md before starting the alarm module work.
- Extended project/web/server.py with a built-in alarm module definition, alarm validation, persisted alarm helpers, an in-process scheduler thread, and alarm add/toggle/delete/stop endpoints.
- Added the built-in module files under project/modules/alarm/ and seeded the new alarm module in project/web/data/modules.json.
- Updated project/web/static/index.html, project/web/static/app.js, and project/web/static/styles.css to add an Alarm module page where alarms can be created, enabled or disabled, deleted, and stopped.
- Updated project/web/static/bedside.html, project/web/static/bedside.js, and project/web/static/bedside.css so bedside mode shows alarm status and exposes a dedicated stop-alarm control while an alarm is active.
- Updated project/web/README.md and project/modules/README.md to document the new alarm APIs and built-in module layout.
- Validation completed: `python -m py_compile project/web/server.py project/modules/alarm/module.py project/modules/clock/module.py`.
- Validation completed: `node --check project/web/static/app.js`.
- Validation completed: `node --check project/web/static/bedside.js`.
- Validation completed: ran a workspace-local Python smoke test under `D:\clock\.tmp` to add an alarm, force it due, confirm it triggered media playback, and confirm stop removed the one-shot alarm and cleared media state.
- Tooling issue: `apply_patch` still fails in this Windows workspace with `windows sandbox: setup refresh failed with status exit code: 1`, so Task 11 edits were written through PowerShell-mediated file writes again.

## 2026-03-16 Task 11 follow-up
- Follow-up fix: extended the Alarm module settings in project/web/server.py so alarm info now has its own persisted `screen_position`, and added `POST /api/alarm/update` so existing alarms can be edited in place.
- Follow-up fix: updated project/web/static/index.html and project/web/static/app.js so the Alarm module page now exposes alarm layout settings, supports edit/cancel-edit actions for saved alarms, and includes an inline audio-file browser for selecting alarm audio from the shared media library.
- Follow-up fix: updated project/web/static/bedside.js and project/web/static/bedside.css so bedside modules are rendered into independent positioned slots and audio playback now uses a fixed full-screen audio stage that no longer creates a scroll path.
- Validation completed: `python -m py_compile project/web/server.py`.
- Validation completed: `node --check project/web/static/app.js`.
- Validation completed: `node --check project/web/static/bedside.js`.
- Validation completed: ran a workspace-local Python smoke test under `D:\clock\.tmp` to confirm alarm screen position persists and that an existing alarm can be updated from daily to weekly with a different file and enabled state.
- Follow-up fix: reduced the bedside audio-card footprint again for the 1024x600 target display, kept alarm audio on native media playback until touch unlocks the gain stage, and added Chromium `--autoplay-policy=no-user-gesture-required` to the kiosk launcher.
- Validation completed: `node --check project/web/static/bedside.js`.

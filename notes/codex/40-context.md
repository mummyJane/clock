## 2026-03-14
- Repository currently contains deployment notes and scaffolding only.
- Task 1 is focused on deployment system design before any clock UI or web app code.
- Install and update scripts target Raspberry Pi OS on a Pi 5 and deploy project files into `/opt/clock`.
- When cloned onto the Pi, shell entrypoints may need `chmod +x install/*.sh update/*.sh` because this repository is currently being prepared from Windows.
- Task 2 adds a dependency-free setup web interface in `project/web` backed by Python's standard library.
- The setup UI shows hostname, IPv4 addresses, release/update status, and allows editing core setup preferences.
- Release `0.1.0` uses the existing setup page as the first local touchscreen status/setup surface instead of introducing a separate kiosk runtime.
- Update handling for `0.1.0` is informational only; applying updates automatically remains a later task.
- Task 4 adds module management to the existing setup UI instead of creating a separate admin surface.
- Module state is persisted in `project/web/data/modules.json`, with the `clock` module seeded but disabled by default.
- Enabled modules now add their own navigation entries in the web UI; the first module page is a Task 4 placeholder for the clock module until Task 6 adds settings.
- Task 4.1 adds `project/modules/` as the filesystem home for modules, with `project/modules/clock/` reserved for the built-in clock module.
- Task 5 introduces a shared Python module API in `project/modules/api.py` so later bedside runtime work can expose a consistent contract to all modules.
- The built-in `clock` module now has registration code that exercises config, draw, alarm, and screen-press hooks through that shared API.
- Task 6 stores clock settings in the module registry and exposes them in the setup web interface when the clock module is enabled.
- The current clock settings are display type, 12/24-hour mode, date format, display size, and screen position.
- Task 7 adds a bedside page at `/bedside.html` that renders the enabled modules from live state, with the clock module respecting its Task 6 settings.
- Deployed installs now point the web server at `/var/lib/clock/*.json` for live state so setup and module choices survive application updates.
- The current boot strategy is `clock-web.service` for the local server plus a desktop autostart entry that launches Chromium in kiosk mode on the bedside page.
- Release `0.2.0` includes a Chromium kiosk launcher workaround to avoid desktop keyring password prompts on Raspberry Pi OS autologin sessions.
- Task 9 now includes a configurable repository path in setup settings so the local web UI can run git update checks without requiring SSH access.
- The `Check again` action now triggers a server-side `git fetch` and ahead/behind comparison against the configured upstream branch, then stores the result in `update-status.json`.
- The Task 9 overview page now also shows live system health from `/api/system-status`, including mounts, disk usage, CPU temperature, and any detected battery voltage source under `/sys/class/power_supply`.
- Task 9 power controls are exposed through `POST /api/actions/reboot` and `POST /api/actions/halt`; deployed installs rely on a dedicated sudoers rule so those actions work from the touchscreen without an SSH session.
- The Task 9 update check now passes `git -c safe.directory=<repo_path>` for each git command, so a repo owned by the login user can still be checked by the `clock` service user without requiring a manual git config change.
- The current battery field in Task 9 now specifically reports the Pi RTC backup battery using `vcgencmd pmic_read_adc BATT_V`; a future UPS battery should be added as a separate status item rather than merged into the same field.
- Task 10 adds a persistent media library rooted at `/var/lib/clock/media`, with a Samba share named `clock-media` so files can be copied onto the device without SSH.
- The setup web interface now includes a `Media` page for browsing folders in the media root, selecting a supported image/audio/video file, and clearing the current selection.
- Bedside mode now checks the persisted media state and, when a file is selected, renders that image/audio/video full-screen with on-screen controls that only appear after touch and auto-hide after a short timeout.

## 2026-03-15
- Runtime follow-up: bedside media controls were rebuilding the player element on every action, which made pause lose the current playback position and behave the same as stop.
- Runtime follow-up: bedside image and video media now switches the shell into a true full-screen media mode so selected media uses the display area instead of inheriting the module-page padding.
- Runtime follow-up: media content type detection now includes explicit extension fallbacks for common audio, video, and image formats so .mp4 and related files are still classified and served correctly when platform mime mappings are incomplete.
- Runtime follow-up: bedside video playback now surfaces an on-screen error hint when Chromium cannot decode a selected video, with guidance to prefer H.264 or AAC MP4 files or WebM on the Pi.
- Runtime follow-up: the bedside page refresh loop was clearing video decode errors every five seconds, so decode failures now stay visible for the currently selected file until the selection changes or is cleared.
- Runtime follow-up: bedside mode now includes a local volume slider for audio and video playback, and the bedside surface now stays blank when no modules are enabled instead of showing a placeholder card.
- Runtime follow-up: video playback now routes bedside media through /media/current so the server can create a temporary WebM transcode for selected MP4, M4V, or MOV files and clean that temp file up when the selection is cleared or changed.
- Runtime follow-up: bedside audio now uses a browser-side gain stage with persisted local volume, and touch interaction resumes the media audio path so quiet or previously blocked audio playback is more reliable for audio and video files.
- Runtime follow-up: selected MP4, M4V, and MOV files now enter a background preparation state instead of being handed straight to Chromium; bedside mode shows a status card until a temporary compatible file is ready or an error is returned.
- Runtime follow-up: the bedside playback controls now stay active while incompatible video is being prepared, which avoids the browser black-screen lockup path seen when Chromium tried to open unsupported MP4 content directly.

- Runtime follow-up: MP4, M4V, and MOV preparation now probes codecs with `ffprobe`, prefers a fast MP4 remux for H.264/AAC-class sources, and only falls back to an H.264/AAC transcode when re-encoding is required.

- Task 11 adds a built-in `alarm` module with persisted alarm definitions inside the module registry, supporting countdown, daily, and selected-day schedules against audio files in the shared media library.
- The web server now runs a local alarm scheduler thread, exposes alarm add/toggle/delete/stop endpoints, and restores the previous bedside media selection after an alarm is stopped.
- The setup UI now includes an enabled Alarm module page for managing saved alarms, and bedside mode now shows alarm status plus a dedicated stop-alarm control when an alarm is active.

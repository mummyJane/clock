## 2026-03-14
- Keep install and update logic in a shared shell library under `project/deploy/lib/common.sh` so release entrypoints stay thin and easy to version.
- Use bash scripts for Raspberry Pi deployment because the target runtime is Raspberry Pi OS, even though repository work is being done from PowerShell.
- Define `install-latest.sh`, `update-latest.sh`, and `update-test.sh` as stable entrypoints that delegate to explicit release scripts.
- Treat `chmod +x install/*.sh update/*.sh` as part of the current manual install flow until release artifacts are produced from an environment that preserves executable file mode.
- Implement the first setup web interface with Python's standard library and static files so deployment does not depend on external package registries.
- Store setup and update metadata as JSON files first, then layer system services and richer persistence on top in later tasks.
- Treat the existing setup page as sufficient to satisfy the `0.1.0` requirement for on-screen IP/status display, rather than adding a dedicated display runtime before Task 6.
- Keep `0.1.0` update behavior informational only until the server/runtime is wired to apply updates safely on the device.
- Keep module enablement in a separate `modules.json` file instead of folding it into setup settings, so module lifecycle can evolve independently from device-wide preferences.
- Seed the `clock` module in the registry but keep it disabled by default to match Task 4 and to make new module pages opt-in.
- Implement module pages as hash-routed sections in the existing static web app so Task 4 can add module navigation without introducing frontend dependencies.
- Store module source and assets under `project/modules/<module-id>/` so the UI registry, runtime code, and deployment layout can share the same module identifiers.
- Define the first module API in Python under `project/modules/api.py` because the current runtime and setup code already use Python, and the API needs to stay dependency-free for Raspberry Pi deployment.
- Keep the Task 5 API as an in-process registration scaffold first, with stored alarms, config items, draw items, and input handlers, then bind those capabilities to the real bedside renderer in later tasks.
- Keep clock settings inside `modules.json` rather than splitting them into a separate file, because they are part of module configuration and should travel with module enabled state.
- Validate Task 6 clock settings on the server against explicit option sets so the web UI remains simple but bad values still cannot be persisted.
- Keep the first bedside runtime inside the existing web server as `/bedside.html` so setup and bedside rendering share the same local service and data APIs.
- Move deployed JSON state into `/var/lib/clock` and inject the paths through `clock.env`, because keeping live state under `/opt/clock/project` would cause updates to overwrite user settings and enabled modules.
- Use a systemd web service plus a desktop autostart Chromium launcher for Task 7, because that is the simplest dependency-free path to automatic bedside mode on Raspberry Pi OS with Desktop.
- Resolve Chromium installation dynamically in the deploy helper, preferring `chromium` and only using `chromium-browser` when that older package name is what the image exposes.
- Force Chromium kiosk mode to use `--password-store=basic` and `--no-first-run` so Raspberry Pi OS autologin sessions do not block on a keyring password prompt.
- Use a configurable local repository path for web update checks instead of hardcoding a checkout location, because the user may keep the repo in different paths on different Pi installs.
- Make the `Check again` action call a dedicated backend endpoint that runs git commands, so the web UI can check for updates without SSH while keeping shell access on the server side only.
- Expose system-health data through a separate `/api/system-status` endpoint instead of folding it into `/api/system`, so the lightweight setup state and the more Pi-specific runtime probes can evolve independently.
- Use a dedicated sudoers drop-in for `/usr/sbin/shutdown` so the web UI can request reboot and halt actions without prompting for a password, while keeping privileged access narrower than full passwordless sudo.
- Pass `safe.directory` as an inline git config on Task 9 update checks instead of mutating the service user's global git config, so user-owned working trees can be inspected safely without creating hidden host-specific git state.
- Use `/var/lib/clock/media` as the Task 10 media root so uploaded files survive application updates and live alongside the other persistent runtime state.
- Expose the media library over a guest Samba share named `clock-media` because Task 10 is specifically about loading files without SSH and the device is intended for a trusted local network.
- Keep media selection and playback state in a separate `media-state.json` file rather than folding it into module settings, because media playback is a device-level runtime concern and not a property of the clock module itself.

## 2026-03-15
- Keep media action timestamps out of the bedside media URL so play, pause, and stop do not force the browser to recreate the active audio or video element and lose playback position.
- Add explicit extension-to-content-type fallbacks in project/web/server.py for common media formats instead of relying only on the host mime database, because Raspberry Pi and minimal Linux installs can vary in what mimetypes.guess_type() returns.
- Surface a bedside video decode hint in the UI rather than silently failing, because some MP4 files will remain unplayable on Pi Chromium when the file codec is unsupported even if the server sends the correct video/mp4 content type.
- Persist the last bedside video decode error in the browser state for the current media selection, because the periodic state refresh would otherwise erase the error before the user could read it.
- Keep the first bedside volume control client-side in the browser rather than persisting it in server state, because this fixes the immediate low-audio issue without extending the backend media schema yet.
- Route bedside playback through /media/current so the server can swap in a temporary transcoded file without changing the persisted selected media path or forcing the setup UI to know about playback artifacts.
- Use ffmpeg as a best-effort local transcode helper for MP4, M4V, and MOV playback, falling back to the source file when ffmpeg is missing or a transcode fails so playback degrades gracefully instead of breaking media selection entirely.
- Use a Web Audio API gain node with a 0-300 bedside volume range because the native HTML media element volume cap of 1.0 is not enough for the current speaker output level.
- Prepare incompatible browser video formats in a background worker and expose the result through media state, because synchronous on-request transcoding still let Chromium hit a black-screen failure path before the converted file was ready.

- Prefer codec-probed MP4 remuxing over full re-encode for bedside video preparation, because many phone and camera files are already H.264/AAC and can be made browser-ready much faster with `-c copy` plus `+faststart`.

- Persist Task 11 alarms inside the built-in `alarm` module settings in `modules.json`, because alarm definitions are module-owned configuration and should move with the module enablement model already used by the setup UI.
- Reuse the existing bedside media playback path for alarm audio instead of building a second audio pipeline, so alarm triggering can benefit from the current browser/runtime media support with less new runtime surface area.
- Restore the previous media state after stopping an alarm, because an alarm should temporarily interrupt bedside playback rather than permanently replacing the user's selected media.

- Give the built-in alarm module its own persisted `screen_position` setting and render modules into independently positioned bedside slots, because the user needs to place alarm info separately from the clock instead of sharing one global module position.
- Add in-place alarm editing plus an inline audio picker on the Alarm module page, because editing by delete-and-recreate and selecting files by manual path entry is too awkward for the touchscreen-first setup flow.
## 2026-03-19
- Cut release `0.3.0` as a packaging milestone only, reusing the already-completed Task 11 alarm functionality instead of adding new runtime behavior during the release step.
- Point `install-latest.sh`, `update-latest.sh`, and `update-test.sh` at `0.3.0`, because Task 12 is the new supported baseline and there is no separate unreleased test-only packaging path in the repository yet.
- Use the existing Foam project folder at `projects/clock/` for Task 13 instead of inventing a second documentation location, so project notes stay aligned with the configured workspace.
- Split the Foam documentation into architecture, runtime flow, deployment, modules, and web API notes rather than one large page, so the material stays navigable as the project grows.

- Persist Task 14 storage planning in a dedicated `storage.json` file instead of folding it into general settings, because mount entries have their own schema, secrets, and apply lifecycle.
- Apply storage mounts through a dedicated root-owned helper plus sudoers rule rather than running mount logic directly inside the `clock` service, so the web server keeps a narrower privilege boundary.
- Manage Clock-owned mount entries inside a marked `/etc/fstab` block, because that works for USB, NVMe, and SMB mounts without introducing another service manager dependency.

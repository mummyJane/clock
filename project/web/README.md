# Clock Web Interface

This folder contains the local setup web interface for the bedside clock.

## Run locally

```bash
python3 server.py
```

The server listens on port `8080` by default and serves:

- `GET /` for the setup page
- `GET /bedside.html` for the bedside runtime page
- `GET /api/system` for hostname, IP address, release, update status, settings, modules, and current media selection
- `GET /api/system-status` for mounts, disk usage, CPU temperature, and RTC battery details shown on the overview page
- `GET /api/settings` for saved setup settings
- `POST /api/settings` to save setup settings, including the local repository path for web update checks
- `GET /api/modules` for installed module metadata, enabled state, and module settings
- `POST /api/modules` to save module enabled state and module settings
- `GET /api/alarm/state` for the currently active alarm and the next upcoming alarm summary
- `POST /api/alarm/add` to create a countdown, daily, or selected-day alarm that plays an audio file from the media library
- `POST /api/alarm/toggle` to enable or disable a saved alarm
- `POST /api/alarm/delete` to remove a saved alarm
- `POST /api/alarm/stop` to stop the currently active alarm and apply its delete/disable-after-stop behavior
- `GET /api/update-status` for the last saved update-check result
- `POST /api/update-status/check` to run `git fetch` and compare the configured local checkout with its upstream branch
- `GET /api/media/files` to browse the configured media root
- `GET /api/media/state` to read the current selected media file and playback state
- `POST /api/media/select` to choose an image, audio file, or video file for bedside playback
- `POST /api/media/action` to send `play`, `pause`, `stop`, or `clear` playback actions
- `GET /media/<path>` to stream a file from the media root with range support for audio/video playback
- `POST /api/actions/reboot` to request an immediate system reboot through `sudo shutdown -r now`
- `POST /api/actions/halt` to request an immediate system halt through `sudo shutdown -h now`

## Data files

By default the server reads and writes JSON files in `project/web/data/`.

- `settings.json`
- `release.json`
- `modules.json`
- `update-status.json`
- `media-state.json`
- `media/`

The seeded module settings are:

- `clock.display_type`
- `clock.hour_mode`
- `clock.date_format`
- `clock.display_size`
- `clock.screen_position`
- `alarm.alarms`

For deployed installs, the systemd service points those JSON files at `/var/lib/clock/` so enabled modules, settings, and media state survive application updates. The media library itself is exposed from `/var/lib/clock/media` and can be shared over Samba.

Use these environment variables to point at deployment paths:

- `CLOCK_WEB_PORT`
- `CLOCK_SETUP_FILE`
- `CLOCK_RELEASE_FILE`
- `CLOCK_MODULES_FILE`
- `CLOCK_UPDATE_FILE`
- `CLOCK_MEDIA_STATE_FILE`
- `CLOCK_MEDIA_ROOT`
- `CLOCK_POWER_ACTION_MODE`

Set `CLOCK_POWER_ACTION_MODE=mock` when testing the reboot and halt endpoints in development so the handler reports success without actually powering off the machine.

Use `CLOCK_FFMPEG_BIN` and `CLOCK_FFPROBE_BIN` if `ffmpeg` or `ffprobe` are not on the default path. For selected `.mp4`, `.m4v`, and `.mov` files, the server now first probes the codecs, then prefers a fast MP4 remux when the source already uses browser-friendly H.264/AAC-class codecs, and only falls back to an H.264/AAC preparation pass when re-encoding is required.

The built-in alarm module uses the shared media library paths from Task 10. Alarm playback currently expects supported audio files and restores the previous bedside media selection after the alarm is stopped.

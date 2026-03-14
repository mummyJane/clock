# Clock Web Interface

This folder contains the local setup web interface for the bedside clock.

## Run locally

```bash
python3 server.py
```

The server listens on port `8080` by default and serves:

- `GET /` for the setup page
- `GET /bedside.html` for the bedside runtime page
- `GET /api/system` for hostname, IP address, release, update status, settings, and modules
- `GET /api/system-status` for mounts, disk usage, CPU temperature, and battery voltage details shown on the overview page
- `GET /api/settings` for saved setup settings
- `POST /api/settings` to save setup settings, including the local repository path for web update checks
- `GET /api/modules` for installed module metadata, enabled state, and module settings
- `POST /api/modules` to save module enabled state and module settings
- `GET /api/update-status` for the last saved update-check result
- `POST /api/update-status/check` to run `git fetch` and compare the configured local checkout with its upstream branch
- `POST /api/actions/reboot` to request an immediate system reboot through `sudo shutdown -r now`
- `POST /api/actions/halt` to request an immediate system halt through `sudo shutdown -h now`

## Data files

By default the server reads and writes JSON files in `project/web/data/`.

- `settings.json`
- `release.json`
- `modules.json`
- `update-status.json`

The seeded `clock` module settings are:

- `display_type`
- `hour_mode`
- `date_format`
- `display_size`
- `screen_position`

For deployed installs, the systemd service points those JSON files at `/var/lib/clock/` so enabled modules and settings survive application updates.

Use these environment variables to point at deployment paths:

- `CLOCK_WEB_PORT`
- `CLOCK_SETUP_FILE`
- `CLOCK_RELEASE_FILE`
- `CLOCK_MODULES_FILE`
- `CLOCK_UPDATE_FILE`
- `CLOCK_POWER_ACTION_MODE`

Set `CLOCK_POWER_ACTION_MODE=mock` when testing the reboot and halt endpoints in development so the handler reports success without actually powering off the machine.
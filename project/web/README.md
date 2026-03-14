# Clock Web Interface

This folder contains the local setup web interface for the bedside clock.

## Run locally

```bash
python3 server.py
```

The server listens on port `8080` by default and serves:

- `GET /` for the setup page
- `GET /api/system` for hostname, IP address, release, update status, and modules
- `GET /api/settings` for saved setup settings
- `POST /api/settings` to save setup settings
- `GET /api/modules` for installed module metadata, enabled state, and module settings
- `POST /api/modules` to save module enabled state and module settings
- `GET /api/update-status` for the current update metadata

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

Use these environment variables to point at deployment paths:

- `CLOCK_WEB_PORT`
- `CLOCK_SETUP_FILE`
- `CLOCK_RELEASE_FILE`
- `CLOCK_MODULES_FILE`
- `CLOCK_UPDATE_FILE`

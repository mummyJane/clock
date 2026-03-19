## Release 0.3.0

Date: 2026-03-19

### Included
- built-in Alarm module for countdown, daily, and selected-day alarms
- alarm add, edit, enable, disable, delete, and stop controls in the setup web interface
- alarm playback from the shared media library with restore of the previous bedside media after stop
- bedside alarm status with a dedicated stop control during active alarms
- release entrypoints updated so `install-latest.sh` and `update-latest.sh` now target `0.3.0`

### Upgrade notes
- Existing installs can move to `0.3.0` with `sudo ./update/update-latest.sh`.
- Alarm definitions are stored in the module registry alongside other module settings in `/var/lib/clock/modules.json`.
- The shared media library remains at `/var/lib/clock/media`; alarm audio files should be selected from that library.

### Validation summary
- verified the new `0.3.0` install and update entrypoints delegate to the shared deployment helpers
- verified the stable `latest` and `test` update entrypoints now target `0.3.0`
- verified the local seeded release metadata now reports `0.3.0-dev`

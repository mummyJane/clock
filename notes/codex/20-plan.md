## Relases with functions
- format <major>.<minor>.<patch>
- if a problem is found with a release the new release with be shown by the patch number

## 0.1.0
- Basic install notes
- which PI 5 image to use for best results
- SSH login
- IP address of unit displayed on screen
- web interface for setup
- check for updates and ask if to update unit

## 0.2.0
- clock with time and date
- in setup interface
    - clock format
    - clock size and location on the screen

## Task 4 delivery
- add a persisted module registry to the setup server
- add a Modules page where all modules start disabled by default
- show a module page in the web interface only after that module is enabled
- create a `project/modules` folder layout with a built-in `clock` module directory

## Task 5 delivery
- define a shared Python module host API under `project/modules/api.py`
- support module access to time, date, alarms, config items, draw items, and screen press handlers
- add a built-in clock module registration example against that API

## Task 6 delivery
- persist clock module settings inside the module registry data
- validate clock type, hour mode, date format, display size, and screen position on the server
- add a clock settings form and preview summary to the enabled clock module page

## Task 7 delivery
- add a bedside runtime page that renders enabled modules from the live module state
- install a systemd service so the web runtime starts automatically on boot
- install a desktop autostart entry so the Pi opens the bedside page in kiosk mode after reboot
- move live setup/module/update JSON data into `/var/lib/clock` so it survives application updates

## Release 0.2.0 delivery
- add the clock module settings required for bedside rendering
- start the web runtime automatically on boot
- render enabled modules on the bedside display
- update latest install and update entrypoints to target `0.2.0`
- launch Chromium in kiosk mode without prompting for the desktop keyring password

## Task 1 delivery
- define a shared install and update script framework
- provide latest and release-specific entrypoints
- document the full install path for a Raspberry Pi 5

## Task 2 delivery
- add a local setup web interface under `project/web`
- serve status and setup data through a Python standard-library HTTP server
- keep the implementation dependency-free for Raspberry Pi deployment

## Release 0.1.0 delivery
- use the setup web interface as the first-touch local status and setup surface
- document the Raspberry Pi image choice and SSH-first install flow
- keep update handling informational until service wiring is introduced in a later task

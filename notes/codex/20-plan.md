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

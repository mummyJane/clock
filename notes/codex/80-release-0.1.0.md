## Release 0.1.0

Date: 2026-03-14

### Included
- basic install notes
- recommended Raspberry Pi image guidance
- SSH-first setup workflow
- local web interface for setup
- status panel showing hostname, IP addresses, release, and update state
- update prompt area in the setup interface

### Recommended Pi image
- Use the current Raspberry Pi OS with desktop, 64-bit, on Raspberry Pi 5.
- Reason: this project uses a touch LCD and no keyboard, so a desktop image with a browser is the correct starting point.

### Install flow
1. Flash Raspberry Pi OS with desktop, 64-bit.
2. Enable SSH in Raspberry Pi Imager advanced options.
3. Boot the Pi on ethernet.
4. Clone this repository.
5. Run `chmod +x install/*.sh update/*.sh`.
6. Run `sudo ./install/install-latest.sh`.
7. Start the setup server with `python3 project/web/server.py`.
8. Open `http://<pi-ip>:8080/`.

### Notes
- For `0.1.0`, the setup page is also the on-screen status page when opened locally on the Pi touchscreen.
- Update status is currently informational and comes from `project/web/data/update-status.json`.
- Auto-start into bedside mode is intentionally left for Task 6.

### Official source references checked on 2026-03-14
- Raspberry Pi OS overview: https://www.raspberrypi.com/software/operating-systems/
- Raspberry Pi Imager download page: https://www.raspberrypi.com/software/

# Clock Full Install

## Goal

Bring a Raspberry Pi 5 from a fresh Raspberry Pi OS install to the current supported `clock` baseline.

## Assumptions

- Raspberry Pi OS 64-bit with Desktop is already installed on NVMe or SD card.
- The repository is available on the Pi.
- Commands are run over SSH as a user with `sudo` access.

## Recommended flow

1. Update the base OS.
2. Clone the `clock` repository onto the Pi.
3. Run `sudo ./install/install-latest.sh`.
4. Reboot the Pi and verify it opens the bedside mode automatically.
5. Use the setup page to enable modules, adjust clock settings, and verify system health.

## Example

```bash
sudo apt-get update
sudo apt-get full-upgrade -y
git clone <repo-url> ~/clock
cd ~/clock
sudo ./install/install-latest.sh
sudo cat /var/lib/clock/release.env
sudo cat /etc/clock/clock.env
sudo reboot
```

## What the install scripts do

- install required packages: `git`, `rsync`, `curl`, `jq`, `avahi-daemon`, `python3`, and a Chromium package
- prefer `chromium` on newer Raspberry Pi OS and fall back to `chromium-browser` on older images
- create the dedicated `clock` system user and group
- create `/opt/clock`, `/etc/clock`, and `/var/lib/clock`
- sync the repository `project` directory into `/opt/clock/project`
- create `/etc/clock/clock.env` pointing the web server at persistent JSON state files in `/var/lib/clock`
- seed `/var/lib/clock/modules.json` and `/var/lib/clock/update-status.json` on first install
- record the installed release in `/var/lib/clock/release.env` and `/var/lib/clock/release.json`
- install and enable the `clock-web.service` systemd unit
- install a desktop autostart entry that opens Chromium in kiosk mode on `http://127.0.0.1:8080/bedside.html`
- install `/etc/sudoers.d/clock-power-control` so the setup page can request reboot and halt actions without an SSH login
- try to switch Raspberry Pi OS boot behavior to Desktop Autologin using `raspi-config`

## Update flow

Run one of the following from a newer checkout of the repository:

```bash
sudo ./update/update-latest.sh
sudo ./update/update-test.sh
```

Both update entrypoints currently target `0.2.0`. Updates keep the live module and setup JSON data in `/var/lib/clock`, so enabled modules and settings survive application syncs.

## Task 9 web controls

After deployment, the setup page overview now exposes:

- a live system health summary with CPU temperature, detected battery voltage, disk usage, and mounts
- a repository-path driven `Check again` action that performs a real git fetch/check on the device
- `Reboot device` and `Power off device` buttons that call the local web API, which then runs `sudo /usr/sbin/shutdown`

If you want to test the power endpoints without actually rebooting the Pi, set `CLOCK_POWER_ACTION_MODE=mock` in the service environment before starting the web server.
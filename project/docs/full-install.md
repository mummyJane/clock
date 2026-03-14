# Clock Full Install

## Goal

Bring a Raspberry Pi 5 from a fresh Raspberry Pi OS install to the current supported `clock` baseline.

## Assumptions

- Raspberry Pi OS 64-bit is already installed on NVMe or SD card.
- The repository is available on the Pi.
- Commands are run over SSH as a user with `sudo` access.

## Recommended flow

1. Update the base OS.
2. Clone the `clock` repository onto the Pi.
3. Run `sudo ./install/install-latest.sh`.
4. Verify the installed release metadata and config files.

## Example

```bash
sudo apt-get update
sudo apt-get full-upgrade -y
git clone <repo-url> ~/clock
cd ~/clock
sudo ./install/install-latest.sh
sudo cat /var/lib/clock/release.env
sudo cat /etc/clock/clock.env
```

## What the install scripts do

- install required packages: `git`, `rsync`, `curl`, `jq`, `avahi-daemon`
- create the dedicated `clock` system user and group
- create `/opt/clock`, `/etc/clock`, and `/var/lib/clock`
- sync the repository `project` directory into `/opt/clock/project`
- create a default config file in `/etc/clock/clock.env`
- record the installed release in `/var/lib/clock/release.env`

## Update flow

Run one of the following from a newer checkout of the repository:

```bash
sudo ./update/update-latest.sh
sudo ./update/update-test.sh
```

Both update entrypoints currently target the latest defined release. Later releases can add version-specific migrations in `update/update-<release>.sh`.

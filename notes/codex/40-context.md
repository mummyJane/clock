## 2026-03-14
- Repository currently contains deployment notes and scaffolding only.
- Task 1 is focused on deployment system design before any clock UI or web app code.
- Install and update scripts target Raspberry Pi OS on a Pi 5 and deploy project files into `/opt/clock`.
- When cloned onto the Pi, shell entrypoints may need `chmod +x install/*.sh update/*.sh` because this repository is currently being prepared from Windows.
- Task 2 adds a dependency-free setup web interface in `project/web` backed by Python's standard library.
- The setup UI shows hostname, IPv4 addresses, release/update status, and allows editing core setup preferences.

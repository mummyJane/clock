## 2026-03-14
- Keep install and update logic in a shared shell library under `project/deploy/lib/common.sh` so release entrypoints stay thin and easy to version.
- Use bash scripts for Raspberry Pi deployment because the target runtime is Raspberry Pi OS, even though repository work is being done from PowerShell.
- Define `install-latest.sh`, `update-latest.sh`, and `update-test.sh` as stable entrypoints that delegate to explicit release scripts.

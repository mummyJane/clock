## 2026-03-14
- Keep install and update logic in a shared shell library under `project/deploy/lib/common.sh` so release entrypoints stay thin and easy to version.
- Use bash scripts for Raspberry Pi deployment because the target runtime is Raspberry Pi OS, even though repository work is being done from PowerShell.
- Define `install-latest.sh`, `update-latest.sh`, and `update-test.sh` as stable entrypoints that delegate to explicit release scripts.
- Treat `chmod +x install/*.sh update/*.sh` as part of the current manual install flow until release artifacts are produced from an environment that preserves executable file mode.
- Implement the first setup web interface with Python's standard library and static files so deployment does not depend on external package registries.
- Store setup and update metadata as JSON files first, then layer system services and richer persistence on top in later tasks.
- Treat the existing setup page as sufficient to satisfy the `0.1.0` requirement for on-screen IP/status display, rather than adding a dedicated display runtime before Task 6.
- Keep `0.1.0` update behavior informational only until the server/runtime is wired to apply updates safely on the device.

#!/usr/bin/env python3

from __future__ import annotations

import json
import mimetypes
import os
import shutil
import socket
import subprocess
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


APP_ROOT = Path(__file__).resolve().parent
STATIC_ROOT = APP_ROOT / "static"
DEFAULT_DATA_ROOT = APP_ROOT / "data"
SETTINGS_PATH = Path(os.environ.get("CLOCK_SETUP_FILE", DEFAULT_DATA_ROOT / "settings.json"))
RELEASE_PATH = Path(os.environ.get("CLOCK_RELEASE_FILE", DEFAULT_DATA_ROOT / "release.json"))
UPDATE_STATUS_PATH = Path(os.environ.get("CLOCK_UPDATE_FILE", DEFAULT_DATA_ROOT / "update-status.json"))
MODULES_PATH = Path(os.environ.get("CLOCK_MODULES_FILE", DEFAULT_DATA_ROOT / "modules.json"))
POWER_ACTION_MODE = os.environ.get("CLOCK_POWER_ACTION_MODE", "live")
THERMAL_PATH = Path("/sys/class/thermal/thermal_zone0/temp")
POWER_SUPPLY_ROOT = Path("/sys/class/power_supply")
MOUNT_EXCLUDE_TYPES = {
    "autofs",
    "binfmt_misc",
    "bpf",
    "cgroup",
    "cgroup2",
    "configfs",
    "debugfs",
    "devpts",
    "devtmpfs",
    "efivarfs",
    "fusectl",
    "hugetlbfs",
    "mqueue",
    "overlay",
    "proc",
    "pstore",
    "securityfs",
    "squashfs",
    "sysfs",
    "tmpfs",
    "tracefs",
}

CLOCK_DISPLAY_TYPES = {"analog", "digital"}
CLOCK_HOUR_MODES = {"12", "24"}
CLOCK_DATE_FORMATS = {"dd/mm/yyyy", "mm/dd/yyyy", "yyyy-mm-dd"}
CLOCK_DISPLAY_SIZES = {"small", "medium", "large"}
CLOCK_SCREEN_POSITIONS = {
    "top-left",
    "top-center",
    "top-right",
    "center-left",
    "center",
    "center-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
}

DEFAULT_SETTINGS: dict[str, Any] = {
    "device_name": "clock",
    "timezone": "Europe/London",
    "web_port": 8080,
    "ssh_enabled": True,
    "update_channel": "stable",
    "repo_path": "",
}

DEFAULT_RELEASE: dict[str, Any] = {
    "release": "0.2.0-dev",
    "updated_at": "unknown",
}

DEFAULT_UPDATE_STATUS: dict[str, Any] = {
    "status": "unknown",
    "latest_release": "unknown",
    "message": "No update metadata is available yet.",
    "checked_at": "never",
    "repo_path": "",
}

DEFAULT_MODULES: dict[str, Any] = {
    "modules": {
        "clock": {
            "title": "Clock",
            "description": "Primary bedside clock surface.",
            "enabled": False,
            "settings": {
                "display_type": "digital",
                "hour_mode": "24",
                "date_format": "dd/mm/yyyy",
                "display_size": "large",
                "screen_position": "center",
            },
        }
    }
}


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def load_json(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return dict(default)
    with path.open("r", encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict):
        raise ValueError(f"Expected an object in {path}")
    merged = dict(default)
    merged.update(data)
    return merged


def save_json(path: Path, payload: dict[str, Any]) -> None:
    ensure_parent(path)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def run_git(repo_path: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo_path), *args],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def current_timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_cpu_temperature() -> dict[str, Any]:
    if not THERMAL_PATH.exists():
        return {"celsius": None, "status": "unavailable"}
    try:
        raw_value = THERMAL_PATH.read_text(encoding="utf-8").strip()
        return {"celsius": round(int(raw_value) / 1000, 1), "status": "ok"}
    except (OSError, ValueError):
        return {"celsius": None, "status": "error"}


def read_battery_voltage() -> dict[str, Any]:
    if not POWER_SUPPLY_ROOT.exists():
        return {"volts": None, "status": "unavailable", "source": "none"}

    for supply in POWER_SUPPLY_ROOT.iterdir():
        voltage_file = supply / "voltage_now"
        if not voltage_file.exists():
            continue
        try:
            raw_value = voltage_file.read_text(encoding="utf-8").strip()
            return {
                "volts": round(int(raw_value) / 1_000_000, 3),
                "status": "ok",
                "source": supply.name,
            }
        except (OSError, ValueError):
            return {"volts": None, "status": "error", "source": supply.name}

    return {"volts": None, "status": "unavailable", "source": "none"}


def get_mount_status() -> list[dict[str, Any]]:
    mounts: list[dict[str, Any]] = []
    seen_mounts: set[str] = set()
    mounts_file = Path("/proc/mounts")
    if not mounts_file.exists():
        return mounts

    for line in mounts_file.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue
        device, mount_point, filesystem = parts[:3]
        if filesystem in MOUNT_EXCLUDE_TYPES or mount_point in seen_mounts:
            continue
        mount_path = Path(mount_point)
        if not mount_path.exists():
            continue
        try:
            usage = shutil.disk_usage(mount_path)
        except OSError:
            continue
        seen_mounts.add(mount_point)
        total_gb = round(usage.total / (1024 ** 3), 2)
        used_gb = round((usage.total - usage.free) / (1024 ** 3), 2)
        free_gb = round(usage.free / (1024 ** 3), 2)
        percent_used = round(((usage.total - usage.free) / usage.total) * 100, 1) if usage.total else 0.0
        mounts.append(
            {
                "device": device,
                "mount_point": mount_point,
                "filesystem": filesystem,
                "total_gb": total_gb,
                "used_gb": used_gb,
                "free_gb": free_gb,
                "percent_used": percent_used,
            }
        )
    return mounts


def build_system_status() -> dict[str, Any]:
    mounts = get_mount_status()
    return {
        "checked_at": current_timestamp(),
        "temperature": read_cpu_temperature(),
        "battery": read_battery_voltage(),
        "mounts": mounts,
        "mount_count": len(mounts),
    }


def request_power_action(action: str) -> dict[str, Any]:
    if action not in {"reboot", "halt"}:
        raise ValueError("Unsupported power action.")

    if POWER_ACTION_MODE == "mock":
        return {
            "status": "scheduled",
            "action": action,
            "message": f"Mock {action} action accepted.",
            "requested_at": current_timestamp(),
        }

    command = ["sudo", "-n", "/usr/sbin/shutdown", "-r" if action == "reboot" else "-h", "now"]
    try:
        subprocess.run(command, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or exc.stdout or str(exc)).strip()
        return {
            "status": "error",
            "action": action,
            "message": f"Power action failed: {stderr}",
            "requested_at": current_timestamp(),
        }

    return {
        "status": "scheduled",
        "action": action,
        "message": f"{action.title()} requested.",
        "requested_at": current_timestamp(),
    }


def check_update_status(settings: dict[str, Any]) -> dict[str, Any]:
    repo_path_value = str(settings.get("repo_path", "")).strip()
    checked_at = current_timestamp()

    if not repo_path_value:
        return {
            "status": "repo-not-set",
            "latest_release": "unknown",
            "message": "Set the repository path in setup preferences to enable web update checks.",
            "checked_at": checked_at,
            "repo_path": "",
        }

    repo_path = Path(repo_path_value)
    if not repo_path.exists():
        return {
            "status": "repo-missing",
            "latest_release": "unknown",
            "message": f"Repository path does not exist: {repo_path}",
            "checked_at": checked_at,
            "repo_path": str(repo_path),
        }
    if not (repo_path / ".git").exists():
        return {
            "status": "repo-invalid",
            "latest_release": "unknown",
            "message": f"Repository path is not a git checkout: {repo_path}",
            "checked_at": checked_at,
            "repo_path": str(repo_path),
        }

    try:
        run_git(repo_path, "fetch", "--tags", "--quiet")
        branch = run_git(repo_path, "rev-parse", "--abbrev-ref", "HEAD")
        local_sha = run_git(repo_path, "rev-parse", "HEAD")
        try:
            upstream = run_git(repo_path, "rev-parse", "--abbrev-ref", "@{upstream}")
        except subprocess.CalledProcessError:
            latest_release = run_git(repo_path, "describe", "--tags", "--abbrev=0") if repo_has_tags(repo_path) else local_sha[:7]
            return {
                "status": "no-upstream",
                "latest_release": latest_release,
                "message": f"Branch {branch} has no upstream configured.",
                "checked_at": checked_at,
                "repo_path": str(repo_path),
            }

        remote_sha = run_git(repo_path, "rev-parse", upstream)
        counts = run_git(repo_path, "rev-list", "--left-right", "--count", f"HEAD...{upstream}")
        behind_count, ahead_count = [int(value) for value in counts.split()]
        latest_release = describe_release(repo_path, upstream, remote_sha)

        if behind_count > 0 and ahead_count > 0:
            status = "diverged"
            message = f"Local branch {branch} has diverged from {upstream}: {behind_count} behind, {ahead_count} ahead."
        elif behind_count > 0:
            status = "updates-available"
            message = f"Local branch {branch} is {behind_count} commit(s) behind {upstream}."
        elif ahead_count > 0:
            status = "ahead"
            message = f"Local branch {branch} is {ahead_count} commit(s) ahead of {upstream}."
        else:
            status = "up-to-date"
            message = f"Local branch {branch} matches {upstream}."

        return {
            "status": status,
            "latest_release": latest_release,
            "message": message,
            "checked_at": checked_at,
            "repo_path": str(repo_path),
            "branch": branch,
            "upstream": upstream,
            "local_sha": local_sha[:7],
            "remote_sha": remote_sha[:7],
        }
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or exc.stdout or str(exc)).strip()
        return {
            "status": "error",
            "latest_release": "unknown",
            "message": f"Git update check failed: {stderr}",
            "checked_at": checked_at,
            "repo_path": str(repo_path),
        }


def repo_has_tags(repo_path: Path) -> bool:
    try:
        run_git(repo_path, "describe", "--tags", "--abbrev=0")
        return True
    except subprocess.CalledProcessError:
        return False


def describe_release(repo_path: Path, ref: str, fallback_sha: str) -> str:
    try:
        return run_git(repo_path, "describe", "--tags", "--abbrev=0", ref)
    except subprocess.CalledProcessError:
        return fallback_sha[:7]


def validate_settings(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Settings payload must be a JSON object.")

    cleaned = dict(DEFAULT_SETTINGS)
    device_name = str(payload.get("device_name", DEFAULT_SETTINGS["device_name"])).strip()
    timezone = str(payload.get("timezone", DEFAULT_SETTINGS["timezone"])).strip()
    update_channel = str(payload.get("update_channel", DEFAULT_SETTINGS["update_channel"])).strip()
    repo_path = str(payload.get("repo_path", DEFAULT_SETTINGS["repo_path"])).strip()

    if not device_name:
        raise ValueError("Device name is required.")
    if not timezone:
        raise ValueError("Timezone is required.")
    if update_channel not in {"stable", "test"}:
        raise ValueError("Update channel must be stable or test.")

    cleaned["device_name"] = device_name[:64]
    cleaned["timezone"] = timezone[:64]
    cleaned["ssh_enabled"] = bool(payload.get("ssh_enabled", DEFAULT_SETTINGS["ssh_enabled"]))
    cleaned["repo_path"] = repo_path[:512]

    web_port = payload.get("web_port", DEFAULT_SETTINGS["web_port"])
    if isinstance(web_port, bool):
        raise ValueError("Web port must be a number.")
    try:
        web_port = int(web_port)
    except (TypeError, ValueError) as exc:
        raise ValueError("Web port must be a number.") from exc
    if not 1 <= web_port <= 65535:
        raise ValueError("Web port must be between 1 and 65535.")

    cleaned["web_port"] = web_port
    cleaned["update_channel"] = update_channel
    return cleaned


def validate_clock_settings(payload: Any) -> dict[str, str]:
    if not isinstance(payload, dict):
        raise ValueError("Clock settings must be a JSON object.")

    display_type = str(payload.get("display_type", DEFAULT_MODULES["modules"]["clock"]["settings"]["display_type"])).strip()
    hour_mode = str(payload.get("hour_mode", DEFAULT_MODULES["modules"]["clock"]["settings"]["hour_mode"])).strip()
    date_format = str(payload.get("date_format", DEFAULT_MODULES["modules"]["clock"]["settings"]["date_format"])).strip()
    display_size = str(payload.get("display_size", DEFAULT_MODULES["modules"]["clock"]["settings"]["display_size"])).strip()
    screen_position = str(payload.get("screen_position", DEFAULT_MODULES["modules"]["clock"]["settings"]["screen_position"])).strip()

    if display_type not in CLOCK_DISPLAY_TYPES:
        raise ValueError("Clock display type must be analog or digital.")
    if hour_mode not in CLOCK_HOUR_MODES:
        raise ValueError("Clock hour mode must be 12 or 24.")
    if date_format not in CLOCK_DATE_FORMATS:
        raise ValueError("Clock date format is invalid.")
    if display_size not in CLOCK_DISPLAY_SIZES:
        raise ValueError("Clock display size must be small, medium, or large.")
    if screen_position not in CLOCK_SCREEN_POSITIONS:
        raise ValueError("Clock screen position is invalid.")

    return {
        "display_type": display_type,
        "hour_mode": hour_mode,
        "date_format": date_format,
        "display_size": display_size,
        "screen_position": screen_position,
    }


def validate_modules(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Modules payload must be a JSON object.")

    raw_modules = payload.get("modules", payload)
    if not isinstance(raw_modules, dict):
        raise ValueError("Modules payload must contain a modules object.")

    cleaned_modules: dict[str, Any] = {}
    for module_id, default_module in DEFAULT_MODULES["modules"].items():
        source_module = raw_modules.get(module_id, {})
        if not isinstance(source_module, dict):
            raise ValueError(f"Module {module_id} must be a JSON object.")

        cleaned_module = {
            "title": str(source_module.get("title", default_module["title"])).strip() or default_module["title"],
            "description": str(source_module.get("description", default_module["description"])).strip() or default_module["description"],
            "enabled": bool(source_module.get("enabled", default_module["enabled"])),
        }
        if module_id == "clock":
            cleaned_module["settings"] = validate_clock_settings(source_module.get("settings", default_module["settings"]))
        cleaned_modules[module_id] = cleaned_module

    return {"modules": cleaned_modules}


def get_ip_addresses() -> list[str]:
    hostnames = {
        socket.gethostname(),
        f"{socket.gethostname()}.local",
        "localhost",
    }
    addresses: set[str] = set()
    for hostname in hostnames:
        try:
            for result in socket.getaddrinfo(hostname, None, family=socket.AF_INET):
                address = result[4][0]
                if not address.startswith("127."):
                    addresses.add(address)
        except OSError:
            continue
    return sorted(addresses)


def build_system_state() -> dict[str, Any]:
    release = load_json(RELEASE_PATH, DEFAULT_RELEASE)
    update_status = load_json(UPDATE_STATUS_PATH, DEFAULT_UPDATE_STATUS)
    settings = load_json(SETTINGS_PATH, DEFAULT_SETTINGS)
    modules = load_json(MODULES_PATH, DEFAULT_MODULES)
    return {
        "hostname": socket.gethostname(),
        "ip_addresses": get_ip_addresses(),
        "release": release,
        "update_status": update_status,
        "settings": settings,
        "modules": modules,
    }


class ClockRequestHandler(BaseHTTPRequestHandler):
    server_version = "ClockSetup/0.1"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/settings":
            self.send_json(load_json(SETTINGS_PATH, DEFAULT_SETTINGS))
            return
        if parsed.path == "/api/modules":
            self.send_json(load_json(MODULES_PATH, DEFAULT_MODULES))
            return
        if parsed.path == "/api/system":
            self.send_json(build_system_state())
            return
        if parsed.path == "/api/system-status":
            self.send_json(build_system_status())
            return
        if parsed.path == "/api/update-status":
            self.send_json(load_json(UPDATE_STATUS_PATH, DEFAULT_UPDATE_STATUS))
            return
        self.serve_static(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/settings":
            self.handle_save_settings()
            return
        if parsed.path == "/api/modules":
            self.handle_save_modules()
            return
        if parsed.path == "/api/update-status/check":
            self.handle_check_update_status()
            return
        if parsed.path == "/api/actions/reboot":
            self.handle_power_action("reboot")
            return
        if parsed.path == "/api/actions/halt":
            self.handle_power_action("halt")
            return
        self.send_error(HTTPStatus.NOT_FOUND, "Endpoint not found.")

    def handle_save_settings(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
            settings = validate_settings(payload)
            save_json(SETTINGS_PATH, settings)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_json({"error": f"Invalid JSON payload: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        except ValueError as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        self.send_json(settings, HTTPStatus.OK)

    def handle_save_modules(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
            modules = validate_modules(payload)
            save_json(MODULES_PATH, modules)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_json({"error": f"Invalid JSON payload: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        except ValueError as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        self.send_json(modules, HTTPStatus.OK)

    def handle_check_update_status(self) -> None:
        settings = load_json(SETTINGS_PATH, DEFAULT_SETTINGS)
        update_status = check_update_status(settings)
        save_json(UPDATE_STATUS_PATH, update_status)
        self.send_json(update_status, HTTPStatus.OK)

    def handle_power_action(self, action: str) -> None:
        result = request_power_action(action)
        status = HTTPStatus.OK if result.get("status") != "error" else HTTPStatus.BAD_REQUEST
        self.send_json(result, status)

    def serve_static(self, request_path: str) -> None:
        normalized = request_path.lstrip("/") or "index.html"
        file_path = (STATIC_ROOT / normalized).resolve()
        if not str(file_path).startswith(str(STATIC_ROOT.resolve())) or not file_path.exists():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found.")
            return
        if file_path.is_dir():
            file_path = file_path / "index.html"
        if not file_path.exists():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found.")
            return

        content_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
        body = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, payload: dict[str, Any], status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    port = int(os.environ.get("CLOCK_WEB_PORT", DEFAULT_SETTINGS["web_port"]))
    ensure_parent(SETTINGS_PATH)
    ensure_parent(RELEASE_PATH)
    ensure_parent(UPDATE_STATUS_PATH)
    ensure_parent(MODULES_PATH)
    server = ThreadingHTTPServer(("0.0.0.0", port), ClockRequestHandler)
    print(f"Clock setup server listening on http://0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()

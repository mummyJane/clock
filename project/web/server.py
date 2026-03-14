#!/usr/bin/env python3

from __future__ import annotations

import json
import mimetypes
import os
import socket
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
}

DEFAULT_RELEASE: dict[str, Any] = {
    "release": "0.1.0-dev",
    "updated_at": "unknown",
}

DEFAULT_UPDATE_STATUS: dict[str, Any] = {
    "status": "unknown",
    "latest_release": "unknown",
    "message": "No update metadata is available yet.",
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


def validate_settings(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Settings payload must be a JSON object.")

    cleaned = dict(DEFAULT_SETTINGS)
    device_name = str(payload.get("device_name", DEFAULT_SETTINGS["device_name"])).strip()
    timezone = str(payload.get("timezone", DEFAULT_SETTINGS["timezone"])).strip()
    update_channel = str(payload.get("update_channel", DEFAULT_SETTINGS["update_channel"])).strip()

    if not device_name:
        raise ValueError("Device name is required.")
    if not timezone:
        raise ValueError("Timezone is required.")
    if update_channel not in {"stable", "test"}:
        raise ValueError("Update channel must be stable or test.")

    cleaned["device_name"] = device_name[:64]
    cleaned["timezone"] = timezone[:64]
    cleaned["ssh_enabled"] = bool(payload.get("ssh_enabled", DEFAULT_SETTINGS["ssh_enabled"]))

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

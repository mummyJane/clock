#!/usr/bin/env python3

from __future__ import annotations

import hashlib
import json
import mimetypes
import os
import shutil
import socket
import subprocess
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse


APP_ROOT = Path(__file__).resolve().parent
STATIC_ROOT = APP_ROOT / "static"
DEFAULT_DATA_ROOT = APP_ROOT / "data"
SETTINGS_PATH = Path(os.environ.get("CLOCK_SETUP_FILE", DEFAULT_DATA_ROOT / "settings.json"))
RELEASE_PATH = Path(os.environ.get("CLOCK_RELEASE_FILE", DEFAULT_DATA_ROOT / "release.json"))
UPDATE_STATUS_PATH = Path(os.environ.get("CLOCK_UPDATE_FILE", DEFAULT_DATA_ROOT / "update-status.json"))
MODULES_PATH = Path(os.environ.get("CLOCK_MODULES_FILE", DEFAULT_DATA_ROOT / "modules.json"))
MEDIA_STATE_PATH = Path(os.environ.get("CLOCK_MEDIA_STATE_FILE", DEFAULT_DATA_ROOT / "media-state.json"))
MEDIA_ROOT = Path(os.environ.get("CLOCK_MEDIA_ROOT", DEFAULT_DATA_ROOT / "media"))
MEDIA_TEMP_ROOT = Path(os.environ.get("CLOCK_MEDIA_TEMP_ROOT", DEFAULT_DATA_ROOT / "media-temp"))
FFMPEG_BIN = os.environ.get("CLOCK_FFMPEG_BIN", "ffmpeg")
FFPROBE_BIN = os.environ.get("CLOCK_FFPROBE_BIN", "ffprobe")
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
MEDIA_FILE_KINDS = {"image", "audio", "video"}
TRANSCODE_VIDEO_SUFFIXES = {".mp4", ".m4v", ".mov"}
MEDIA_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".aac": "audio/aac",
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".ogv": "video/ogg",
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

DEFAULT_MEDIA_STATE: dict[str, Any] = {
    "selected_file": "",
    "selected_kind": "none",
    "playback_state": "stopped",
    "playback_status": "idle",
    "playback_url": "",
    "message": "",
    "updated_at": "never",
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


MEDIA_TRANSCODE_LOCK = threading.Lock()
MEDIA_TRANSCODE_THREADS: dict[str, threading.Thread] = {}
FASTSTART_VIDEO_CODECS = {"h264", "avc1"}
FASTSTART_AUDIO_CODECS = {"aac", "mp4a", "mp3"}


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
        ["git", "-c", f"safe.directory={repo_path}", "-C", str(repo_path), *args],
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
    try:
        result = subprocess.run(
            ["vcgencmd", "pmic_read_adc", "BATT_V"],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError:
        return {"volts": None, "status": "unavailable", "source": "vcgencmd"}
    except subprocess.CalledProcessError:
        return {"volts": None, "status": "error", "source": "vcgencmd"}

    output = result.stdout.strip()
    try:
        voltage_text = output.split("=", 1)[1].strip().rstrip("Vv")
        return {
            "volts": round(float(voltage_text), 3),
            "status": "ok",
            "source": "rtc",
        }
    except (IndexError, ValueError):
        return {"volts": None, "status": "error", "source": "vcgencmd"}


def get_mount_status() -> list[dict[str, Any]]:
    mounts: list[dict[str, Any]] = []
    seen_mounts: set[str] = set()
    mounts_file = Path("/proc/mounts")
    try:
        if not mounts_file.exists():
            return mounts
        mount_lines = mounts_file.read_text(encoding="utf-8").splitlines()
    except OSError:
        return mounts

    for line in mount_lines:
        parts = line.split()
        if len(parts) < 3:
            continue
        device, mount_point, filesystem = parts[:3]
        if filesystem in MOUNT_EXCLUDE_TYPES or mount_point in seen_mounts:
            continue
        mount_path = Path(mount_point)
        try:
            if not mount_path.exists():
                continue
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
    try:
        mounts = get_mount_status()
        return {
            "checked_at": current_timestamp(),
            "temperature": read_cpu_temperature(),
            "battery": read_battery_voltage(),
            "mounts": mounts,
            "mount_count": len(mounts),
        }
    except OSError:
        return {
            "checked_at": current_timestamp(),
            "temperature": {"celsius": None, "status": "error"},
            "battery": {"volts": None, "status": "error", "source": "none"},
            "mounts": [],
            "mount_count": 0,
        }


def media_content_type_for_name(name: str) -> str | None:
    content_type, _ = mimetypes.guess_type(name)
    if content_type:
        return content_type
    return MEDIA_CONTENT_TYPES.get(Path(name).suffix.lower())


def media_kind_for_name(name: str) -> str:
    content_type = media_content_type_for_name(name)
    if not content_type:
        return "other"
    if content_type.startswith("image/"):
        return "image"
    if content_type.startswith("audio/"):
        return "audio"
    if content_type.startswith("video/"):
        return "video"
    return "other"


def clean_media_relative_path(value: str) -> str:
    normalized = str(value or "").replace("\\", "/").strip("/")
    if not normalized:
        return ""
    path = Path(normalized)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise ValueError("Media path is invalid.")
    return path.as_posix()


def resolve_media_path(relative_path: str) -> Path:
    cleaned = clean_media_relative_path(relative_path)
    media_root = MEDIA_ROOT.resolve()
    candidate = (media_root / cleaned).resolve()
    if not str(candidate).startswith(str(media_root)):
        raise ValueError("Media path escapes the media root.")
    return candidate


def media_requires_transcode(file_path: Path) -> bool:
    return media_kind_for_name(file_path.name) == "video" and file_path.suffix.lower() in TRANSCODE_VIDEO_SUFFIXES


def cleanup_media_temp_files(exclude: set[Path] | None = None) -> None:
    exclusions = {path.resolve() for path in (exclude or set())}
    if not MEDIA_TEMP_ROOT.exists():
        return
    for child in MEDIA_TEMP_ROOT.iterdir():
        try:
            resolved = child.resolve()
        except OSError:
            resolved = child
        if resolved in exclusions:
            continue
        try:
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
        except OSError:
            continue


def current_playback_url_for(state: dict[str, Any]) -> str:
    selected_file = str(state.get("selected_file", "")).strip()
    selected_kind = str(state.get("selected_kind", "none")).strip()
    if not selected_file:
        return ""
    selection_key = f"{selected_kind}:{selected_file}"
    return f"/media/current?key={selection_key}"


def transcoded_media_path_for(file_path: Path) -> Path:
    stat = file_path.stat()
    digest_source = f"{file_path.resolve()}:{stat.st_mtime_ns}:{stat.st_size}"
    digest = hashlib.sha256(digest_source.encode("utf-8")).hexdigest()[:12]
    safe_stem = "".join(character if character.isalnum() else "-" for character in file_path.stem).strip("-") or "media"
    return MEDIA_TEMP_ROOT / f"{safe_stem}-{digest}.mp4"


def probe_media_streams(file_path: Path) -> dict[str, str]:
    command = [
        FFPROBE_BIN,
        "-v",
        "error",
        "-show_entries",
        "stream=codec_name,codec_type",
        "-of",
        "json",
        str(file_path),
    ]
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    payload = json.loads(result.stdout or "{}")
    streams = payload.get("streams", [])
    if not isinstance(streams, list):
        return {}

    codecs: dict[str, str] = {}
    for stream in streams:
        if not isinstance(stream, dict):
            continue
        codec_type = str(stream.get("codec_type", "")).strip()
        codec_name = str(stream.get("codec_name", "")).strip().lower()
        if codec_type and codec_name and codec_type not in codecs:
            codecs[codec_type] = codec_name
    return codecs


def can_remux_for_browser(file_path: Path) -> bool:
    codecs = probe_media_streams(file_path)
    video_codec = codecs.get("video", "")
    audio_codec = codecs.get("audio", "")
    if video_codec not in FASTSTART_VIDEO_CODECS:
        return False
    return not audio_codec or audio_codec in FASTSTART_AUDIO_CODECS


def ensure_transcoded_media(file_path: Path) -> Path:
    MEDIA_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = transcoded_media_path_for(file_path)
    cleanup_media_temp_files({output_path})
    if output_path.exists() and output_path.stat().st_size > 0:
        return output_path

    if can_remux_for_browser(file_path):
        command = [
            FFMPEG_BIN,
            "-y",
            "-i",
            str(file_path),
            "-c",
            "copy",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    else:
        command = [
            FFMPEG_BIN,
            "-y",
            "-i",
            str(file_path),
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-crf",
            "23",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            str(output_path),
        ]
    subprocess.run(command, check=True, capture_output=True, text=True)
    return output_path


def start_media_transcode(selected_file: str, file_path: Path) -> None:
    output_path = transcoded_media_path_for(file_path)

    with MEDIA_TRANSCODE_LOCK:
        running = MEDIA_TRANSCODE_THREADS.get(selected_file)
        if running and running.is_alive():
            return

        def worker() -> None:
            try:
                ensure_transcoded_media(file_path)
                state = load_media_state()
                if str(state.get("selected_file", "")).strip() != selected_file:
                    cleanup_media_temp_files()
                    return
                save_media_state(
                    {
                        **state,
                        "playback_status": "ready",
                        "playback_url": current_playback_url_for(state),
                        "message": "",
                        "updated_at": current_timestamp(),
                    }
                )
            except FileNotFoundError:
                state = load_media_state()
                if str(state.get("selected_file", "")).strip() == selected_file:
                    save_media_state(
                        {
                            **state,
                            "playback_status": "error",
                            "playback_url": "",
                            "message": "ffmpeg or ffprobe is not installed, so this video cannot be prepared for browser playback.",
                            "updated_at": current_timestamp(),
                        }
                    )
            except subprocess.CalledProcessError as exc:
                try:
                    output_path.unlink(missing_ok=True)
                except OSError:
                    pass
                state = load_media_state()
                if str(state.get("selected_file", "")).strip() == selected_file:
                    stderr = (exc.stderr or exc.stdout or str(exc)).strip()
                    save_media_state(
                        {
                            **state,
                            "playback_status": "error",
                            "playback_url": "",
                            "message": f"Video transcode failed: {stderr[:240]}",
                            "updated_at": current_timestamp(),
                        }
                    )
            finally:
                with MEDIA_TRANSCODE_LOCK:
                    MEDIA_TRANSCODE_THREADS.pop(selected_file, None)

        thread = threading.Thread(target=worker, daemon=True, name=f"clock-transcode-{selected_file}")
        MEDIA_TRANSCODE_THREADS[selected_file] = thread
        thread.start()


def resolve_current_media_playback_path() -> Path:
    state = load_media_state()
    selected_file = str(state.get("selected_file", "")).strip()
    if not selected_file:
        raise ValueError("No media file is selected.")

    source_path = resolve_media_path(selected_file)
    if media_requires_transcode(source_path):
        output_path = transcoded_media_path_for(source_path)
        if not output_path.exists() or output_path.stat().st_size <= 0:
            raise ValueError("Playback file is not ready.")
        cleanup_media_temp_files({output_path})
        return output_path
    cleanup_media_temp_files()
    return source_path


def list_media_entries(relative_path: str = "") -> dict[str, Any]:
    directory = resolve_media_path(relative_path)
    if not directory.exists():
        raise ValueError("Media path does not exist.")
    if not directory.is_dir():
        raise ValueError("Media path is not a directory.")

    entries: list[dict[str, Any]] = []
    for child in sorted(directory.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower())):
        if child.name.startswith("."):
            continue
        child_relative = child.relative_to(MEDIA_ROOT.resolve()).as_posix()
        if child.is_dir():
            entries.append(
                {
                    "name": child.name,
                    "type": "directory",
                    "relative_path": child_relative,
                    "kind": "directory",
                }
            )
            continue

        kind = media_kind_for_name(child.name)
        entries.append(
            {
                "name": child.name,
                "type": "file",
                "relative_path": child_relative,
                "kind": kind,
                "size_bytes": child.stat().st_size,
                "selectable": kind in MEDIA_FILE_KINDS,
            }
        )

    current_path = clean_media_relative_path(relative_path)
    parent_path = ""
    if current_path:
        parent = Path(current_path).parent
        parent_path = "" if str(parent) == "." else parent.as_posix()

    return {
        "share_path": str(MEDIA_ROOT),
        "current_path": current_path,
        "parent_path": parent_path,
        "entries": entries,
    }


def load_media_state() -> dict[str, Any]:
    return load_json(MEDIA_STATE_PATH, DEFAULT_MEDIA_STATE)


def save_media_state(payload: dict[str, Any]) -> dict[str, Any]:
    state = dict(DEFAULT_MEDIA_STATE)
    state.update(payload)
    if not state.get("selected_file"):
        state["playback_status"] = "idle"
        state["playback_url"] = ""
        state["message"] = ""
    save_json(MEDIA_STATE_PATH, state)
    return state


def select_media_file(relative_path: str) -> dict[str, Any]:
    cleaned = clean_media_relative_path(relative_path)
    file_path = resolve_media_path(cleaned)
    if not file_path.exists() or not file_path.is_file():
        raise ValueError("Selected media file does not exist.")

    kind = media_kind_for_name(file_path.name)
    if kind not in MEDIA_FILE_KINDS:
        raise ValueError("Selected file is not a supported image, audio, or video file.")

    cleanup_media_temp_files()
    state = {
        "selected_file": cleaned,
        "selected_kind": kind,
        "playback_state": "playing",
        "updated_at": current_timestamp(),
    }
    if kind == "video" and media_requires_transcode(file_path):
        state.update(
            {
                "playback_status": "preparing",
                "playback_url": "",
                "message": "Preparing a temporary compatible video file. Playback controls stay available while this runs.",
            }
        )
        saved_state = save_media_state(state)
        start_media_transcode(cleaned, file_path)
        return saved_state

    state.update(
        {
            "playback_status": "ready",
            "playback_url": current_playback_url_for(state),
            "message": "",
        }
    )
    return save_media_state(state)


def change_media_playback(action: str) -> dict[str, Any]:
    if action not in {"play", "pause", "stop", "clear"}:
        raise ValueError("Unsupported media action.")

    state = load_media_state()
    if action == "clear":
        cleanup_media_temp_files()
        return save_media_state(
            {
                "selected_file": "",
                "selected_kind": "none",
                "playback_state": "stopped",
                "playback_status": "idle",
                "playback_url": "",
                "message": "",
                "updated_at": current_timestamp(),
            }
        )

    if not state.get("selected_file"):
        raise ValueError("Select a media file before changing playback.")

    next_state = dict(state)
    next_state["playback_state"] = "playing" if action == "play" else action
    next_state["updated_at"] = current_timestamp()
    return save_media_state(next_state)


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


def build_repo_status(status: str, message: str, checked_at: str, repo_path: Path | None = None) -> dict[str, Any]:
    return {
        "status": status,
        "latest_release": "unknown",
        "message": message,
        "checked_at": checked_at,
        "repo_path": str(repo_path) if repo_path is not None else "",
    }


def check_update_status(settings: dict[str, Any]) -> dict[str, Any]:
    repo_path_value = str(settings.get("repo_path", "")).strip()
    checked_at = current_timestamp()

    if not repo_path_value:
        return build_repo_status(
            "repo-not-set",
            "Set the repository path in setup preferences to enable web update checks.",
            checked_at,
        )

    repo_path = Path(repo_path_value)
    try:
        if not repo_path.exists():
            return build_repo_status(
                "repo-missing",
                f"Repository path does not exist: {repo_path}",
                checked_at,
                repo_path,
            )
        if not (repo_path / ".git").exists():
            return build_repo_status(
                "repo-invalid",
                f"Repository path is not a git checkout: {repo_path}",
                checked_at,
                repo_path,
            )
    except PermissionError:
        return build_repo_status(
            "repo-unreadable",
            f"Repository path is not readable by the clock service user: {repo_path}",
            checked_at,
            repo_path,
        )

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
    media_state = load_media_state()
    return {
        "hostname": socket.gethostname(),
        "ip_addresses": get_ip_addresses(),
        "release": release,
        "update_status": update_status,
        "settings": settings,
        "modules": modules,
        "media_state": media_state,
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
        if parsed.path == "/api/media/files":
            media_path = parse_qs(parsed.query).get("path", [""])[0]
            self.handle_media_listing(media_path)
            return
        if parsed.path == "/api/media/state":
            self.send_json(load_media_state())
            return
        if parsed.path == "/media/current":
            self.serve_current_media()
            return
        if parsed.path.startswith("/media/"):
            self.serve_media(parsed.path.removeprefix("/media/"))
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
        if parsed.path == "/api/media/select":
            self.handle_media_select()
            return
        if parsed.path == "/api/media/action":
            self.handle_media_action()
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

    def handle_media_listing(self, media_path: str) -> None:
        try:
            listing = list_media_entries(media_path)
        except ValueError as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        self.send_json(listing, HTTPStatus.OK)

    def handle_media_select(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
            state = select_media_file(str(payload.get("relative_path", "")))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_json({"error": f"Invalid JSON payload: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        except ValueError as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        self.send_json(state, HTTPStatus.OK)

    def handle_media_action(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(content_length)
        try:
            payload = json.loads(raw_body.decode("utf-8"))
            state = change_media_playback(str(payload.get("action", "")))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self.send_json({"error": f"Invalid JSON payload: {exc}"}, HTTPStatus.BAD_REQUEST)
            return
        except ValueError as exc:
            self.send_json({"error": str(exc)}, HTTPStatus.BAD_REQUEST)
            return
        self.send_json(state, HTTPStatus.OK)

    def serve_static(self, request_path: str) -> None:
        normalized = request_path.lstrip("/") or "index.html"
        file_path = (STATIC_ROOT / normalized).resolve()
        if not str(file_path).startswith(str(STATIC_ROOT.resolve())):
            self.send_error(HTTPStatus.NOT_FOUND, "File not found.")
            return
        if file_path.is_dir():
            file_path = file_path / "index.html"
        if not file_path.exists():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found.")
            return
        self.serve_file(file_path)

    def serve_media(self, relative_path: str) -> None:
        try:
            file_path = resolve_media_path(relative_path)
        except ValueError:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found.")
            return
        if not file_path.exists() or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found.")
            return
        self.serve_file(file_path)

    def serve_current_media(self) -> None:
        try:
            file_path = resolve_current_media_playback_path()
        except ValueError:
            self.send_error(HTTPStatus.NOT_FOUND, "File not found.")
            return
        if not file_path.exists() or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found.")
            return
        self.serve_file(file_path)

    def serve_file(self, file_path: Path) -> None:
        content_type = media_content_type_for_name(file_path.name) or "application/octet-stream"
        file_size = file_path.stat().st_size
        range_header = self.headers.get("Range")
        start = 0
        end = file_size - 1
        status = HTTPStatus.OK

        if range_header and range_header.startswith("bytes="):
            try:
                range_spec = range_header.removeprefix("bytes=").split(",", 1)[0]
                start_text, end_text = range_spec.split("-", 1)
                if start_text:
                    start = int(start_text)
                if end_text:
                    end = int(end_text)
                if start < 0 or end >= file_size or start > end:
                    raise ValueError
                status = HTTPStatus.PARTIAL_CONTENT
            except ValueError:
                self.send_error(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE, "Invalid range.")
                return

        content_length = end - start + 1
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Length", str(content_length))
        if status == HTTPStatus.PARTIAL_CONTENT:
            self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
        self.end_headers()

        with file_path.open("rb") as handle:
            handle.seek(start)
            remaining = content_length
            while remaining > 0:
                chunk = handle.read(min(64 * 1024, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)

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
    ensure_parent(MEDIA_STATE_PATH)
    MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
    MEDIA_TEMP_ROOT.mkdir(parents=True, exist_ok=True)
    server = ThreadingHTTPServer(("0.0.0.0", port), ClockRequestHandler)
    print(f"Clock setup server listening on http://0.0.0.0:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()















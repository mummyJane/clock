from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
from pathlib import Path, PurePosixPath
from typing import Any

DEFAULT_STORAGE_CONFIG: dict[str, Any] = {
    "entries": [],
    "last_apply": {
        "status": "never",
        "message": "Storage mounts have not been applied yet.",
        "applied_at": "never",
        "details": [],
    },
}

FSTAB_BEGIN_MARKER = "# BEGIN CLOCK STORAGE"
FSTAB_END_MARKER = "# END CLOCK STORAGE"
DEFAULT_LOCAL_OPTIONS = "defaults,nofail,x-systemd.device-timeout=10"
DEFAULT_NAS_OPTIONS = "iocharset=utf8,nofail,x-systemd.automount,_netdev,uid=clock,gid=clock,file_mode=0664,dir_mode=0775"
ENTRY_ID_PATTERN = re.compile(r"[^a-z0-9-]+")
FILESYSTEM_PATTERN = re.compile(r"^[A-Za-z0-9._+-]{1,32}$")
FILESYSTEM_FORMATTERS = {
    "ext4": ["mkfs.ext4", "-F"],
    "ext3": ["mkfs.ext3", "-F"],
    "ext2": ["mkfs.ext2", "-F"],
    "vfat": ["mkfs.vfat"],
    "fat32": ["mkfs.vfat", "-F", "32"],
    "exfat": ["mkfs.exfat", "-f"],
}


def current_timestamp() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def load_storage_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        return json.loads(json.dumps(DEFAULT_STORAGE_CONFIG))
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return validate_storage_config(payload)


def save_storage_config(path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    cleaned = validate_storage_config(payload)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(cleaned, handle, indent=2)
        handle.write("\n")
    return cleaned


def validate_storage_config(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Storage payload must be a JSON object.")

    raw_entries = payload.get("entries", [])
    if not isinstance(raw_entries, list):
        raise ValueError("Storage payload must contain an entries list.")

    cleaned_entries: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_mount_points: set[str] = set()
    for index, raw_entry in enumerate(raw_entries, start=1):
        entry = validate_storage_entry(raw_entry, index)
        if entry["entry_id"] in seen_ids:
            raise ValueError(f"Duplicate storage entry id: {entry['entry_id']}")
        if entry["mount_point"] in seen_mount_points:
            raise ValueError(f"Duplicate storage mount point: {entry['mount_point']}")
        seen_ids.add(entry["entry_id"])
        seen_mount_points.add(entry["mount_point"])
        cleaned_entries.append(entry)

    last_apply = payload.get("last_apply", DEFAULT_STORAGE_CONFIG["last_apply"])
    if not isinstance(last_apply, dict):
        last_apply = dict(DEFAULT_STORAGE_CONFIG["last_apply"])

    return {
        "entries": cleaned_entries,
        "last_apply": {
            "status": str(last_apply.get("status", "never")).strip() or "never",
            "message": str(last_apply.get("message", "")).strip() or DEFAULT_STORAGE_CONFIG["last_apply"]["message"],
            "applied_at": str(last_apply.get("applied_at", "never")).strip() or "never",
            "details": list(last_apply.get("details", [])) if isinstance(last_apply.get("details", []), list) else [],
        },
    }


def validate_storage_entry(payload: Any, index: int) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Each storage entry must be a JSON object.")

    kind = str(payload.get("kind", "usb")).strip().lower()
    if kind not in {"usb", "nvme", "nas"}:
        raise ValueError("Storage kind must be usb, nvme, or nas.")

    label = str(payload.get("label", f"Storage {index}")).strip()[:64] or f"Storage {index}"
    entry_id = slugify(str(payload.get("entry_id", "")).strip() or label or f"storage-{index}")
    mount_point = normalize_mount_point(str(payload.get("mount_point", "")).strip())
    enabled = bool(payload.get("enabled", True))
    auto_mount = bool(payload.get("auto_mount", True))
    options = normalize_options(str(payload.get("options", "")).strip())

    entry: dict[str, Any] = {
        "entry_id": entry_id,
        "label": label,
        "kind": kind,
        "enabled": enabled,
        "auto_mount": auto_mount,
        "format_if_needed": bool(payload.get("format_if_needed", False)),
        "mount_point": mount_point,
        "options": options or (DEFAULT_NAS_OPTIONS if kind == "nas" else DEFAULT_LOCAL_OPTIONS),
    }

    if kind in {"usb", "nvme"}:
        source = normalize_local_source(str(payload.get("source", "")).strip())
        filesystem = str(payload.get("filesystem", "auto")).strip().lower() or "auto"
        if filesystem != "auto" and not FILESYSTEM_PATTERN.match(filesystem):
            raise ValueError("Local filesystem must be auto or a simple filesystem name such as ext4 or exfat.")
        if entry["format_if_needed"] and filesystem == "auto":
            raise ValueError("Format if needed requires a specific filesystem such as ext4 or exfat.")
        entry["source"] = source
        entry["filesystem"] = filesystem
        entry["host"] = ""
        entry["share"] = ""
        entry["username"] = ""
        entry["password"] = ""
        entry["domain"] = ""
        entry["version"] = ""
    else:
        host = str(payload.get("host", "")).strip()
        share = str(payload.get("share", "")).strip().strip("/")
        if not host:
            raise ValueError("NAS host is required.")
        if not share:
            raise ValueError("NAS share is required.")
        entry["source"] = f"//{host}/{share}"
        entry["filesystem"] = "cifs"
        entry["host"] = host[:255]
        entry["share"] = share[:255]
        entry["username"] = str(payload.get("username", "")).strip()[:128]
        entry["password"] = str(payload.get("password", "")).strip()[:256]
        entry["domain"] = str(payload.get("domain", "")).strip()[:128]
        entry["version"] = str(payload.get("version", "3.0")).strip()[:32] or "3.0"
        entry["format_if_needed"] = False

    return entry


def slugify(value: str) -> str:
    normalized = ENTRY_ID_PATTERN.sub("-", value.lower()).strip("-")
    return normalized[:64] or "storage-entry"


def normalize_mount_point(value: str) -> str:
    if not value:
        raise ValueError("Storage mount point is required.")
    if not value.startswith("/"):
        raise ValueError("Storage mount point must be an absolute path.")
    path = PurePosixPath(value)
    normalized = path.as_posix().rstrip("/") or "/"
    if normalized == "/":
        raise ValueError("Storage mount point cannot be /.")
    if any(part in {".", ".."} for part in path.parts):
        raise ValueError("Storage mount point is invalid.")
    return normalized


def normalize_local_source(value: str) -> str:
    if not value:
        raise ValueError("Local storage source is required.")
    if not value.startswith("/"):
        raise ValueError("Local storage source must be an absolute device path such as /dev/disk/by-uuid/... or /dev/nvme0n1p1.")
    path = PurePosixPath(value)
    if any(part in {".", ".."} for part in path.parts):
        raise ValueError("Local storage source is invalid.")
    return path.as_posix()


def normalize_options(value: str) -> str:
    if not value:
        return ""
    parts = [part.strip() for part in value.split(",") if part.strip()]
    return ",".join(parts)


def list_storage_devices() -> list[dict[str, Any]]:
    command = [
        "lsblk",
        "-J",
        "-o",
        "NAME,PATH,TYPE,FSTYPE,SIZE,LABEL,UUID,MOUNTPOINT,TRAN,MODEL,SERIAL",
    ]
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        return []

    try:
        payload = json.loads(result.stdout or "{}")
    except json.JSONDecodeError:
        return []

    devices: list[dict[str, Any]] = []

    def walk(items: list[dict[str, Any]], parent_transport: str = "") -> None:
        for item in items:
            if not isinstance(item, dict):
                continue
            path = str(item.get("path", "")).strip()
            item_type = str(item.get("type", "")).strip()
            transport = str(item.get("tran", "")).strip().lower() or parent_transport
            if path and item_type in {"disk", "part"}:
                storage_class = classify_device(path, transport)
                if storage_class in {"usb", "nvme"}:
                    devices.append(
                        {
                            "name": str(item.get("name", "")).strip(),
                            "path": path,
                            "type": item_type,
                            "filesystem": str(item.get("fstype", "")).strip(),
                            "size": str(item.get("size", "")).strip(),
                            "label": str(item.get("label", "")).strip(),
                            "uuid": str(item.get("uuid", "")).strip(),
                            "mount_point": str(item.get("mountpoint", "")).strip(),
                            "transport": transport,
                            "model": str(item.get("model", "")).strip(),
                            "serial": str(item.get("serial", "")).strip(),
                            "storage_class": storage_class,
                        }
                    )
            children = item.get("children", [])
            if isinstance(children, list):
                walk(children, transport)

    walk(payload.get("blockdevices", []) if isinstance(payload.get("blockdevices", []), list) else [])
    return devices


def classify_device(path: str, transport: str) -> str:
    if path.startswith("/dev/nvme"):
        return "nvme"
    if transport == "usb":
        return "usb"
    return "other"


def local_device_matches_source(device: dict[str, Any], source: str) -> bool:
    path = str(device.get("path", "")).strip()
    uuid = str(device.get("uuid", "")).strip()
    normalized_source = str(source).strip()
    if not normalized_source:
        return False
    if normalized_source == path:
        return True
    if uuid and normalized_source == f"/dev/disk/by-uuid/{uuid}":
        return True
    return False


def build_storage_overview(config: dict[str, Any], mounts: list[dict[str, Any]] | None = None) -> dict[str, Any]:
    cleaned = validate_storage_config(config)
    active_mounts = mounts or []
    mounts_by_point = {str(item.get("mount_point", "")): item for item in active_mounts}
    entries: list[dict[str, Any]] = []
    for entry in cleaned["entries"]:
        mount = mounts_by_point.get(entry["mount_point"])
        details = dict(entry)
        details["is_mounted"] = mount is not None
        details["mounted_device"] = str(mount.get("device", "")) if mount else ""
        details["mounted_filesystem"] = str(mount.get("filesystem", "")) if mount else ""
        entries.append(details)

    devices = list_storage_devices()
    local_entry_sources = [entry["source"] for entry in cleaned["entries"] if entry.get("kind") in {"usb", "nvme"}]
    filtered_devices: list[dict[str, Any]] = []
    skipped_devices: list[dict[str, Any]] = []

    for device in devices:
        mount_point = str(device.get("mount_point", "")).strip()
        is_planned = any(local_device_matches_source(device, source) for source in local_entry_sources)
        skip_reason = ""
        if mount_point:
            skip_reason = "mounted"
        elif is_planned:
            skip_reason = "planned"

        if skip_reason:
            skipped_device = dict(device)
            skipped_device["skip_reason"] = skip_reason
            skipped_devices.append(skipped_device)
        else:
            filtered_devices.append(device)

    return {
        "entries": entries,
        "last_apply": cleaned["last_apply"],
        "detected_devices": filtered_devices,
        "detected_counts": {
            "usb": sum(1 for item in filtered_devices if item.get("storage_class") == "usb"),
            "nvme": sum(1 for item in filtered_devices if item.get("storage_class") == "nvme"),
        },
        "detected_groups": {
            "usb": [item for item in filtered_devices if item.get("storage_class") == "usb"],
            "nvme": [item for item in filtered_devices if item.get("storage_class") == "nvme"],
        },
        "skipped_detected_counts": {
            "usb": sum(1 for item in skipped_devices if item.get("storage_class") == "usb"),
            "nvme": sum(1 for item in skipped_devices if item.get("storage_class") == "nvme"),
        },
        "skipped_detected_groups": {
            "usb": [item for item in skipped_devices if item.get("storage_class") == "usb"],
            "nvme": [item for item in skipped_devices if item.get("storage_class") == "nvme"],
        },
        "active_mounts": active_mounts,
    }

def render_storage_preview(config: dict[str, Any], credentials_dir: Path) -> dict[str, Any]:
    cleaned = validate_storage_config(config)
    lines = [FSTAB_BEGIN_MARKER]
    credential_files: list[dict[str, str]] = []
    mount_points: list[str] = []

    for entry in cleaned["entries"]:
        if not entry.get("enabled", True):
            continue
        mount_points.append(entry["mount_point"])
        if entry["kind"] == "nas":
            options = build_nas_options(entry, credentials_dir)
            lines.append(f"{entry['source']} {entry['mount_point']} cifs {options} 0 0")
            credential_path = credentials_path_for(entry, credentials_dir)
            if credential_path is not None:
                credential_files.append({
                    "entry_id": entry["entry_id"],
                    "path": credential_path.as_posix(),
                })
        else:
            filesystem = entry.get("filesystem", "auto") or "auto"
            passno = "2" if filesystem != "auto" else "0"
            options = build_local_options(entry)
            lines.append(f"{entry['source']} {entry['mount_point']} {filesystem} {options} 0 {passno}")

    lines.append(FSTAB_END_MARKER)
    return {
        "fstab_preview": "\n".join(lines) + "\n",
        "mount_points": mount_points,
        "credential_files": credential_files,
        "enabled_count": len(mount_points),
    }


def build_nas_options(entry: dict[str, Any], credentials_dir: Path) -> str:
    options = [part for part in normalize_options(entry.get("options", DEFAULT_NAS_OPTIONS)).split(",") if part]
    if entry.get("auto_mount", True):
        if "x-systemd.automount" not in options:
            options.append("x-systemd.automount")
    else:
        options = [part for part in options if part != "x-systemd.automount"]

    version = str(entry.get("version", "")).strip()
    if version and not any(part.startswith("vers=") for part in options):
        options.append(f"vers={version}")

    credential_path = credentials_path_for(entry, credentials_dir)
    if credential_path is not None:
        options.append(f"credentials={credential_path.as_posix()}")
    elif entry.get("username"):
        options.append(f"username={entry['username']}")
        if entry.get("password"):
            options.append(f"password={entry['password']}")
        if entry.get("domain"):
            options.append(f"domain={entry['domain']}")
    else:
        options.append("guest")

    return dedupe_options(options)


def build_local_options(entry: dict[str, Any]) -> str:
    options = [part for part in normalize_options(entry.get("options", DEFAULT_LOCAL_OPTIONS)).split(",") if part]
    if entry.get("auto_mount", True):
        if "x-systemd.automount" not in options:
            options.append("x-systemd.automount")
    else:
        options = [part for part in options if part != "x-systemd.automount"]
    return dedupe_options(options)


def dedupe_options(options: list[str]) -> str:
    deduped: list[str] = []
    seen: set[str] = set()
    for option in options:
        if option not in seen:
            deduped.append(option)
            seen.add(option)
    return ",".join(deduped)


def credentials_path_for(entry: dict[str, Any], credentials_dir: Path) -> Path | None:
    if not entry.get("username"):
        return None
    return credentials_dir / f"{entry['entry_id']}.cred"


def apply_storage_config_file(config_path: Path, fstab_path: Path, credentials_dir: Path) -> dict[str, Any]:
    config = load_storage_config(config_path)
    preview = render_storage_preview(config, credentials_dir)

    credentials_dir.mkdir(parents=True, exist_ok=True)
    prepare_local_filesystems(config)
    write_fstab_block(fstab_path, preview["fstab_preview"])
    ensure_mount_points(preview["mount_points"])
    write_credentials(config, credentials_dir)
    mount_all()

    result = {
        "status": "ok",
        "message": f"Applied {preview['enabled_count']} storage mount(s).",
        "applied_at": current_timestamp(),
        "details": [
            f"Updated {fstab_path}",
            f"Mount points ensured: {', '.join(preview['mount_points']) if preview['mount_points'] else 'none'}",
        ],
        "preview": preview,
    }
    config["last_apply"] = {
        "status": result["status"],
        "message": result["message"],
        "applied_at": result["applied_at"],
        "details": result["details"],
    }
    save_storage_config(config_path, config)
    return result


def prepare_local_filesystems(config: dict[str, Any]) -> None:
    for entry in config.get("entries", []):
        if not entry.get("enabled", True):
            continue
        if entry.get("kind") not in {"usb", "nvme"}:
            continue
        if not entry.get("format_if_needed", False):
            continue
        filesystem = str(entry.get("filesystem", "auto")).strip().lower()
        source = str(entry.get("source", "")).strip()
        if filesystem == "auto" or not source:
            continue
        if detect_filesystem(source):
            continue
        format_device(source, filesystem)


def detect_filesystem(source: str) -> str:
    try:
        result = subprocess.run(["blkid", "-o", "value", "-s", "TYPE", source], check=True, capture_output=True, text=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        return ""
    return result.stdout.strip().lower()


def format_device(source: str, filesystem: str) -> None:
    command = FILESYSTEM_FORMATTERS.get(filesystem)
    if command is None:
        raise ValueError(f"Formatting is not supported for filesystem {filesystem}.")
    subprocess.run([*command, source], check=True, capture_output=True, text=True)


def write_fstab_block(fstab_path: Path, block: str) -> None:
    existing = fstab_path.read_text(encoding="utf-8") if fstab_path.exists() else ""
    if FSTAB_BEGIN_MARKER in existing and FSTAB_END_MARKER in existing:
        before, remainder = existing.split(FSTAB_BEGIN_MARKER, 1)
        _, after = remainder.split(FSTAB_END_MARKER, 1)
        content = before.rstrip() + "\n\n" + block.rstrip() + "\n" + after.lstrip("\n")
    else:
        content = existing.rstrip() + ("\n\n" if existing.strip() else "") + block.rstrip() + "\n"
    fstab_path.write_text(content, encoding="utf-8")


def ensure_mount_points(mount_points: list[str]) -> None:
    for mount_point in mount_points:
        Path(mount_point).mkdir(parents=True, exist_ok=True)


def write_credentials(config: dict[str, Any], credentials_dir: Path) -> None:
    active_paths: set[Path] = set()
    for entry in config.get("entries", []):
        credential_path = credentials_path_for(entry, credentials_dir)
        if credential_path is None:
            continue
        content_lines = [f"username={entry['username']}"]
        if entry.get("password"):
            content_lines.append(f"password={entry['password']}")
        if entry.get("domain"):
            content_lines.append(f"domain={entry['domain']}")
        credential_path.write_text("\n".join(content_lines) + "\n", encoding="utf-8")
        os.chmod(credential_path, 0o600)
        active_paths.add(credential_path)

    for existing in credentials_dir.glob("*.cred"):
        if existing not in active_paths:
            try:
                existing.unlink()
            except OSError:
                continue


def mount_all() -> None:
    subprocess.run(["mount", "-a"], check=True, capture_output=True, text=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply clock storage configuration.")
    subcommands = parser.add_subparsers(dest="command", required=True)

    apply_parser = subcommands.add_parser("apply")
    apply_parser.add_argument("--config", required=True)
    apply_parser.add_argument("--fstab", default="/etc/fstab")
    apply_parser.add_argument("--credentials-dir", default="/etc/clock/storage-credentials")

    args = parser.parse_args()
    if args.command == "apply":
        result = apply_storage_config_file(Path(args.config), Path(args.fstab), Path(args.credentials_dir))
        print(json.dumps(result))


if __name__ == "__main__":
    main()

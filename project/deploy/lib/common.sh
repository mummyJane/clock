#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

CLOCK_USER="${CLOCK_USER:-clock}"
CLOCK_GROUP="${CLOCK_GROUP:-${CLOCK_USER}}"
CLOCK_INSTALL_ROOT="${CLOCK_INSTALL_ROOT:-/opt/clock}"
CLOCK_CONFIG_ROOT="${CLOCK_CONFIG_ROOT:-/etc/clock}"
CLOCK_STATE_ROOT="${CLOCK_STATE_ROOT:-/var/lib/clock}"
CLOCK_RELEASE_FILE="${CLOCK_RELEASE_FILE:-${CLOCK_STATE_ROOT}/release.env}"

log() {
    printf '[clock] %s\n' "$*"
}

require_root() {
    if [[ "${EUID}" -ne 0 ]]; then
        echo "Run this script as root or with sudo." >&2
        exit 1
    fi
}

ensure_command() {
    local command_name="$1"
    if ! command -v "${command_name}" >/dev/null 2>&1; then
        echo "Required command not found: ${command_name}" >&2
        exit 1
    fi
}

apt_install() {
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y "$@"
}

ensure_clock_user() {
    if ! getent group "${CLOCK_GROUP}" >/dev/null; then
        groupadd --system "${CLOCK_GROUP}"
    fi

    if ! id -u "${CLOCK_USER}" >/dev/null 2>&1; then
        useradd \
            --system \
            --gid "${CLOCK_GROUP}" \
            --home-dir "${CLOCK_INSTALL_ROOT}" \
            --shell /usr/sbin/nologin \
            "${CLOCK_USER}"
    fi
}

create_layout() {
    install -d -m 0755 "${CLOCK_INSTALL_ROOT}"
    install -d -m 0755 "${CLOCK_CONFIG_ROOT}"
    install -d -m 0755 "${CLOCK_STATE_ROOT}"
    chown -R "${CLOCK_USER}:${CLOCK_GROUP}" "${CLOCK_INSTALL_ROOT}" "${CLOCK_STATE_ROOT}"
}

sync_project_files() {
    ensure_command rsync
    rsync -a --delete \
        "${PROJECT_ROOT}/" \
        "${CLOCK_INSTALL_ROOT}/project/"
    chown -R "${CLOCK_USER}:${CLOCK_GROUP}" "${CLOCK_INSTALL_ROOT}"
}

write_default_config() {
    if [[ ! -f "${CLOCK_CONFIG_ROOT}/clock.env" ]]; then
        cat > "${CLOCK_CONFIG_ROOT}/clock.env" <<'EOF'
CLOCK_TIMEZONE=Europe/London
CLOCK_WEB_PORT=8080
EOF
    fi
}

write_release_metadata() {
    local release_name="$1"
    cat > "${CLOCK_RELEASE_FILE}" <<EOF
CLOCK_RELEASE=${release_name}
CLOCK_UPDATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
}

read_current_release() {
    if [[ -f "${CLOCK_RELEASE_FILE}" ]]; then
        # shellcheck disable=SC1090
        source "${CLOCK_RELEASE_FILE}"
        printf '%s\n' "${CLOCK_RELEASE:-unknown}"
    else
        printf 'uninstalled\n'
    fi
}

install_base_packages() {
    apt_install \
        git \
        rsync \
        curl \
        jq \
        avahi-daemon
}

install_release_common() {
    local release_name="$1"
    require_root
    install_base_packages
    ensure_clock_user
    create_layout
    sync_project_files
    write_default_config
    write_release_metadata "${release_name}"
    log "Installed shared release assets for ${release_name}"
}

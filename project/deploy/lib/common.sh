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
CLOCK_MEDIA_ROOT="${CLOCK_MEDIA_ROOT:-${CLOCK_STATE_ROOT}/media}"
CLOCK_STORAGE_FILE="${CLOCK_STORAGE_FILE:-${CLOCK_STATE_ROOT}/storage.json}"
CLOCK_SYSTEMD_ROOT="${CLOCK_SYSTEMD_ROOT:-/etc/systemd/system}"
CLOCK_AUTOSTART_ROOT="${CLOCK_AUTOSTART_ROOT:-/etc/xdg/autostart}"
CLOCK_SUDOERS_ROOT="${CLOCK_SUDOERS_ROOT:-/etc/sudoers.d}"

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

apt_install_chromium() {
    if apt-cache show chromium >/dev/null 2>&1; then
        apt_install chromium
        return
    fi

    if apt-cache show chromium-browser >/dev/null 2>&1; then
        apt_install chromium-browser
        return
    fi

    echo "Neither chromium nor chromium-browser is available from configured apt sources." >&2
    exit 1
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

    if getent group video >/dev/null; then
        usermod -aG video "${CLOCK_USER}"
    fi
}

create_layout() {
    install -d -m 0755 "${CLOCK_INSTALL_ROOT}"
    install -d -m 0755 "${CLOCK_CONFIG_ROOT}"
    install -d -m 0755 "${CLOCK_STATE_ROOT}"
    install -d -m 0775 "${CLOCK_MEDIA_ROOT}"
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
    cat > "${CLOCK_CONFIG_ROOT}/clock.env" <<EOF
CLOCK_TIMEZONE=Europe/London
CLOCK_WEB_PORT=8080
CLOCK_SETUP_FILE=${CLOCK_STATE_ROOT}/settings.json
CLOCK_RELEASE_FILE=${CLOCK_STATE_ROOT}/release.json
CLOCK_UPDATE_FILE=${CLOCK_STATE_ROOT}/update-status.json
CLOCK_MODULES_FILE=${CLOCK_STATE_ROOT}/modules.json
CLOCK_MEDIA_STATE_FILE=${CLOCK_STATE_ROOT}/media-state.json
CLOCK_MEDIA_ROOT=${CLOCK_MEDIA_ROOT}
CLOCK_STORAGE_FILE=${CLOCK_STORAGE_FILE}
CLOCK_STORAGE_HELPER=${CLOCK_INSTALL_ROOT}/project/deploy/bin/apply-storage-config.sh
EOF
}

seed_runtime_state() {
    if [[ ! -f "${CLOCK_STATE_ROOT}/modules.json" ]]; then
        install -m 0644 "${CLOCK_INSTALL_ROOT}/project/web/data/modules.json" "${CLOCK_STATE_ROOT}/modules.json"
    fi

    if [[ ! -f "${CLOCK_STATE_ROOT}/update-status.json" ]]; then
        install -m 0644 "${CLOCK_INSTALL_ROOT}/project/web/data/update-status.json" "${CLOCK_STATE_ROOT}/update-status.json"
    fi

    if [[ ! -f "${CLOCK_STATE_ROOT}/media-state.json" ]]; then
        install -m 0644 "${CLOCK_INSTALL_ROOT}/project/web/data/media-state.json" "${CLOCK_STATE_ROOT}/media-state.json"
    fi

    if [[ ! -f "${CLOCK_STORAGE_FILE}" ]]; then
        install -m 0644 "${CLOCK_INSTALL_ROOT}/project/web/data/storage.json" "${CLOCK_STORAGE_FILE}"
    fi

    install -d -m 0775 "${CLOCK_MEDIA_ROOT}"
    chown -R "${CLOCK_USER}:${CLOCK_GROUP}" "${CLOCK_STATE_ROOT}"
}

write_release_metadata() {
    local release_name="$1"
    local updated_at
    updated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    cat > "${CLOCK_RELEASE_FILE}" <<EOF
CLOCK_RELEASE=${release_name}
CLOCK_UPDATED_AT=${updated_at}
EOF

    cat > "${CLOCK_STATE_ROOT}/release.json" <<EOF
{
  "release": "${release_name}",
  "updated_at": "${updated_at}"
}
EOF

    chown "${CLOCK_USER}:${CLOCK_GROUP}" "${CLOCK_RELEASE_FILE}" "${CLOCK_STATE_ROOT}/release.json"
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
        avahi-daemon \
        python3 \
        samba \
        cifs-utils \
        nvme-cli \
        usbutils
    apt_install_chromium
}

install_runtime_assets() {
    install -d -m 0755 "${CLOCK_SYSTEMD_ROOT}"
    install -d -m 0755 "${CLOCK_AUTOSTART_ROOT}"
    install -d -m 0755 "${CLOCK_SUDOERS_ROOT}"
    install -m 0644 "${CLOCK_INSTALL_ROOT}/project/deploy/systemd/clock-web.service" "${CLOCK_SYSTEMD_ROOT}/clock-web.service"
    install -m 0644 "${CLOCK_INSTALL_ROOT}/project/deploy/autostart/clock-bedside.desktop" "${CLOCK_AUTOSTART_ROOT}/clock-bedside.desktop"
    install -m 0440 "${CLOCK_INSTALL_ROOT}/project/deploy/sudoers/clock-power-control" "${CLOCK_SUDOERS_ROOT}/clock-power-control"
    install -m 0440 "${CLOCK_INSTALL_ROOT}/project/deploy/sudoers/clock-storage-manage" "${CLOCK_SUDOERS_ROOT}/clock-storage-manage"
    chmod 0755 "${CLOCK_INSTALL_ROOT}/project/deploy/bin/start-bedside.sh"
    chmod 0755 "${CLOCK_INSTALL_ROOT}/project/deploy/bin/apply-storage-config.sh"
}

configure_boot_mode() {
    if command -v raspi-config >/dev/null 2>&1; then
        raspi-config nonint do_boot_behaviour B4 || true
    fi
}

enable_runtime_services() {
    systemctl daemon-reload
    systemctl enable --now clock-web.service
}

configure_samba_share() {
    local samba_include="include = ${CLOCK_CONFIG_ROOT}/samba-clock.conf"
    cat > "${CLOCK_CONFIG_ROOT}/samba-clock.conf" <<EOF
[clock-media]
path = ${CLOCK_MEDIA_ROOT}
browseable = yes
read only = no
guest ok = yes
force user = ${CLOCK_USER}
create mask = 0664
directory mask = 0775
EOF

    if [[ -f /etc/samba/smb.conf ]] && ! grep -Fq "${samba_include}" /etc/samba/smb.conf; then
        printf '\n%s\n' "${samba_include}" >> /etc/samba/smb.conf
    fi

    systemctl enable --now smbd >/dev/null 2>&1 || true
    systemctl restart smbd >/dev/null 2>&1 || true
}

install_release_common() {
    local release_name="$1"
    require_root
    install_base_packages
    ensure_clock_user
    create_layout
    sync_project_files
    write_default_config
    seed_runtime_state
    write_release_metadata "${release_name}"
    log "Installed shared release assets for ${release_name}"
}

install_runtime_common() {
    install_runtime_assets
    configure_boot_mode
    configure_samba_share
    enable_runtime_services
    log "Installed bedside runtime service, Samba media share, storage helper, and desktop autostart assets"
}

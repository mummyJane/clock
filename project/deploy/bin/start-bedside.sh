#!/usr/bin/env bash

set -euo pipefail

if [[ -f /etc/clock/clock.env ]]; then
    # shellcheck disable=SC1091
    source /etc/clock/clock.env
fi

CLOCK_WEB_PORT="${CLOCK_WEB_PORT:-8080}"
CLOCK_BEDSIDE_URL="${CLOCK_BEDSIDE_URL:-http://127.0.0.1:${CLOCK_WEB_PORT}/bedside.html}"

for _ in $(seq 1 30); do
    if curl --silent --fail "${CLOCK_BEDSIDE_URL}" >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

if command -v chromium-browser >/dev/null 2>&1; then
    BROWSER_BIN="chromium-browser"
elif command -v chromium >/dev/null 2>&1; then
    BROWSER_BIN="chromium"
else
    echo "No Chromium browser binary found." >&2
    exit 1
fi

exec "${BROWSER_BIN}" \
    --kiosk \
    --incognito \
    --no-first-run \
    --password-store=basic \
    --disable-features=PasswordManagerOnboarding,PasswordsImport \
    --noerrdialogs \
    --disable-session-crashed-bubble \
    --disable-infobars \
    "${CLOCK_BEDSIDE_URL}"

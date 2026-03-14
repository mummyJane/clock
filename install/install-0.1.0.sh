#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../project/deploy/lib/common.sh"

main() {
    install_release_common "0.1.0"
    log "Release 0.1.0 baseline installed."
    log "Application services are added in later tasks."
    log "Use the setup web interface at http://<pi-ip>:8080/ once the server is running."
}

main "$@"

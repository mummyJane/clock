#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../project/deploy/lib/common.sh"

main() {
    install_release_common "0.2.0"
    install_runtime_common
    log "Release 0.2.0 installed."
    log "The bedside runtime will open automatically on reboot."
    log "Use the setup web interface at http://<pi-ip>:8080/ and the bedside page at http://<pi-ip>:8080/bedside.html."
}

main "$@"

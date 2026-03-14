#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/../project/deploy/lib/common.sh"

main() {
    local current_release
    current_release="$(read_current_release)"

    install_release_common "0.1.0"
    log "Updated system from ${current_release} to 0.1.0."
}

main "$@"

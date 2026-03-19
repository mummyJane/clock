#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
    echo "Usage: $0 <storage-json-path>" >&2
    exit 1
fi

exec /usr/bin/python3 /opt/clock/project/web/storage_support.py apply --config "$1"

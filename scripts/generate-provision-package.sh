#!/usr/bin/env bash
# Thin wrapper — the provisioning logic lives in generate-provision-package.mjs
# (Node, cross-platform, no jq). Kept as a .sh entry point for convenience.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/generate-provision-package.mjs" "$@"

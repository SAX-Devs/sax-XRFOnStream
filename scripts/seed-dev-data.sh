#!/usr/bin/env bash
# Thin wrapper — the seed logic lives in seed-dev-data.mjs (Node, cross-platform,
# aligned to the real equipment schema + migrations 00013/00014). Kept as a .sh
# entry point for convenience.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/seed-dev-data.mjs" "$@"

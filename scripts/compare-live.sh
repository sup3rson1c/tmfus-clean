#!/usr/bin/env bash
#
# compare-live.sh: prove the new site kept every page and form
#
# Reads the snapshot table in issue #8 / scripts/live-snapshot-2026-09-30.md,
# fetches the same URLs from https://tmfus.com (GET only, 1 request/sec),
# and prints per URL:
#   - old status vs new status
#   - old title vs new title
#   - whether a form that posted before still exists and where it posts now
#
# Exit code: non-zero if any URL that was 200 is now not 200.
#
# Usage:
#   ./scripts/compare-live.sh [BASE_URL] [SNAPSHOT_FILE]
#
# Defaults:
#   BASE_URL:       https://tmfus.com
#   SNAPSHOT_FILE:  scripts/live-snapshot-2026-09-30.md
#
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PYTHON="python3"
if ! command -v python3 >/dev/null 2>&1; then
  if command -v python >/dev/null 2>&1; then
    PYTHON="python"
  else
    echo "Error: python3 or python is required to run compare-live.sh" >&2
    exit 1
  fi
fi

exec "$PYTHON" "$ROOT_DIR/scripts/compare_live.py" "$@"

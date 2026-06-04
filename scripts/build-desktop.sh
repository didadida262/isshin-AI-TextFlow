#!/usr/bin/env bash
# Build desktop installers for macOS or Windows (run on the matching host OS).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

platform="${1:-}"

case "$platform" in
  mac | macos | darwin)
    echo "→ Building macOS app (.app) and disk image (.dmg)…"
    npm run desktop:build:mac
    echo "→ Artifacts: src-tauri/target/release/bundle/macos/ and src-tauri/target/release/bundle/dmg/"
    ;;
  win | windows)
    echo "→ Building Windows installers (.msi, .exe setup)…"
    npm run desktop:build:win
    echo "→ Artifacts: src-tauri/target/release/bundle/msi/ and src-tauri/target/release/bundle/nsis/"
    ;;
  *)
    echo "Usage: $0 <mac|win>" >&2
    echo "" >&2
    echo "  mac   — build on macOS (outputs .app + .dmg)" >&2
    echo "  win   — build on Windows (outputs .msi + NSIS .exe)" >&2
    exit 1
    ;;
esac

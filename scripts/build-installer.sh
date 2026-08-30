#!/usr/bin/env bash
# Build the EmuCenter installer for THIS machine's OS (macOS -> .dmg,
# Linux -> .AppImage). Run from anywhere: ./scripts/build-installer.sh
#
# Builds must run from a LOCAL-DISK copy of the repo — npm on an SMB/gvfs
# mount is impractically slow and native builds misbehave there. Sync the
# repo locally first (exclude node_modules/web-build/release/backend/config),
# then run this script in the local copy.
#
# The finished artifact is copied into the repo's installers/ dir if it
# exists, or into $INSTALLERS_DIR if that is set (point it at the NAS copy).
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

case "$ROOT" in
    */gvfs/*|*smb-share*)
        echo "ERROR: this looks like a network mount ($ROOT)." >&2
        echo "Copy the repo to local disk and build there (see header)." >&2
        exit 1;;
esac

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "ERROR: Node 20+ required (found: $(node -v 2>/dev/null || echo none))." >&2
    echo "Build machines keep one in ~/node-v20/bin — export PATH=~/node-v20/bin:\$PATH" >&2
    exit 1
fi

VERSION="$(node -p 'require("./package.json").version')"
echo "==> Building EmuCenter $VERSION for $(uname -s)"

echo "==> Cleaning previous build output"
rm -rf web-build release .expo

echo "==> Installing dependencies (root)"
npm ci
echo "==> Installing dependencies (backend) — a 'vigemclient' skip warning is EXPECTED off-Windows"
(cd backend && npm ci)

echo "==> Type check"
npx tsc --noEmit

echo "==> Building installer"
npm run dist

case "$(uname -s)" in
    Darwin) ARTIFACT="$(ls release/*.dmg 2>/dev/null | head -1)";;
    *)      ARTIFACT="$(ls release/*.AppImage 2>/dev/null | head -1)";;
esac
[ -n "${ARTIFACT:-}" ] || { echo "ERROR: no artifact found in release/" >&2; exit 1; }

if command -v md5sum >/dev/null; then SUM="$(md5sum "$ARTIFACT" | cut -d' ' -f1)";
else SUM="$(md5 -q "$ARTIFACT")"; fi
echo "==> Built: $ARTIFACT ($(du -h "$ARTIFACT" | cut -f1), md5 $SUM)"

DEST="${INSTALLERS_DIR:-$ROOT/installers}"
if [ -d "$DEST" ]; then
    cp "$ARTIFACT" "$DEST/"
    COPIED="$DEST/$(basename "$ARTIFACT")"
    if command -v md5sum >/dev/null; then SUM2="$(md5sum "$COPIED" | cut -d' ' -f1)";
    else SUM2="$(md5 -q "$COPIED")"; fi
    [ "$SUM" = "$SUM2" ] || { echo "ERROR: copy verification FAILED for $COPIED" >&2; exit 1; }
    echo "==> Delivered to $COPIED (md5 verified)"
    echo "    Reminder: delete the previous version's artifact from installers/."
else
    echo "==> installers/ not found here and \$INSTALLERS_DIR unset — artifact left in release/."
    echo "    To deliver: INSTALLERS_DIR=/path/to/nas/emuCenter-webApp/installers $0"
fi

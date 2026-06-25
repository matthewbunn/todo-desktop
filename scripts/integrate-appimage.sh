#!/usr/bin/env bash
# Integrate the To-Do AppImage into your application menu (proper launcher + icon)
# WITHOUT AppImageLauncher, while keeping the AppImage's built-in auto-updater.
#
# Why: a bare AppImage installs no menu entry, so the desktop shows a generic
# icon when it isn't running. This script installs a .desktop entry + icon that
# point at a stable copy of the AppImage. The auto-updater replaces that file in
# place, so updates keep working and the launcher keeps pointing at the right app.
#
# Usage:  ./integrate-appimage.sh /path/to/To-Do-1.1.6.AppImage
#
# If you have AppImageLauncher installed and it's rejecting the AppImage, remove
# it first:  sudo apt remove appimagelauncher
set -euo pipefail

SRC="${1:-}"
if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then
  echo "Usage: $0 /path/to/To-Do-<version>.AppImage" >&2
  exit 1
fi
SRC="$(readlink -f "$SRC")"

# 1) Keep the AppImage at a stable location so the launcher survives self-updates.
DEST_DIR="$HOME/Applications"
DEST="$DEST_DIR/To-Do.AppImage"
mkdir -p "$DEST_DIR"
if [ "$SRC" != "$DEST" ]; then cp -f "$SRC" "$DEST"; fi
chmod +x "$DEST"

# 2) Extract the embedded icon (no AppImageLauncher in the way).
WORK="$(mktemp -d)"; trap 'rm -rf "$WORK"' EXIT
if ! ( cd "$WORK" && "$DEST" --appimage-extract >/dev/null 2>&1 ); then
  echo "Could not extract the AppImage." >&2
  echo "If AppImageLauncher is installed it intercepts AppImages — remove it and retry:" >&2
  echo "    sudo apt remove appimagelauncher" >&2
  exit 1
fi

ICON=""
for s in 512x512 256x256 128x128 1024x1024; do
  c="$(find "$WORK/squashfs-root/usr/share/icons/hicolor/$s" -iname '*.png' 2>/dev/null | head -1 || true)"
  if [ -n "$c" ]; then ICON="$c"; break; fi
done
[ -z "$ICON" ] && ICON="$WORK/squashfs-root/.DirIcon"   # guaranteed fallback

ICON_DEST="$HOME/.local/share/icons/todo-desktop.png"
mkdir -p "$(dirname "$ICON_DEST")"
cp -f "$ICON" "$ICON_DEST"

# 3) Install the menu entry (absolute Icon path = no icon-theme guesswork).
APPS="$HOME/.local/share/applications"
mkdir -p "$APPS"
cat > "$APPS/todo-desktop.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=To-Do
Comment=Self-contained local-first to-do board
Exec=$DEST %U
Icon=$ICON_DEST
Terminal=false
Categories=Utility;
StartupWMClass=To-Do
EOF
chmod +x "$APPS/todo-desktop.desktop"

# 4) Refresh menu/icon caches (best-effort; harmless if a tool is absent).
update-desktop-database "$APPS" 2>/dev/null || true
gtk-update-icon-cache "$HOME/.local/share/icons" 2>/dev/null || true
for k in kbuildsycoca6 kbuildsycoca5; do command -v "$k" >/dev/null 2>&1 && "$k" >/dev/null 2>&1 || true; done

echo "Done."
echo "  • AppImage:     $DEST"
echo "  • Menu entry:   $APPS/todo-desktop.desktop"
echo "  • Icon:         $ICON_DEST"
echo "Launch 'To-Do' from your application menu and pin THAT (not the raw .AppImage)."
echo "Auto-updates keep working — the app updates $DEST in place."

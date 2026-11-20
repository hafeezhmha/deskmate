#!/bin/sh
# Adds deskmate to your app menu, and to your Plank dock if you use Plank.
# Safe to run again (e.g. after moving the folder).
set -e

DIR=$(cd "$(dirname "$0")/.." && pwd)
APPS="$HOME/.local/share/applications"
ICONS="$HOME/.local/share/icons/hicolor/256x256/apps"

mkdir -p "$APPS" "$ICONS"
# The launcher points at this file directly: some icon themes don't pick up
# new icons by name until they rescan, and docks then show a generic gear.
# The name includes a hash so docks reload it when the icon changes.
ICON="$ICONS/deskmate-$(md5sum "$DIR/assets/icon.png" | cut -c1-8).png"
rm -f "$ICONS"/deskmate*.png
cp "$DIR/assets/icon.png" "$ICON"

cat > "$APPS/deskmate.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=deskmate
Comment=Zaif codes when you type
Exec=$DIR/node_modules/electron/dist/electron $DIR
Icon=$ICON
Terminal=false
Categories=Development;Education;
StartupWMClass=deskmate
EOF
update-desktop-database "$APPS" 2>/dev/null || true
echo "added to app menu: $APPS/deskmate.desktop"

# Plank keeps one folder of launchers per dock, plus the icon order in dconf.
command -v dconf >/dev/null 2>&1 || exit 0
for dock in $(dconf list /net/launchpad/plank/docks/ 2>/dev/null | tr -d /); do
  launchers="$HOME/.config/plank/$dock/launchers"
  [ -d "$launchers" ] || continue
  printf '[PlankDockItemPreferences]\nLauncher=file://%s\n' "$APPS/deskmate.desktop" > "$launchers/deskmate.dockitem"
  key="/net/launchpad/plank/docks/$dock/dock-items"
  items=$(dconf read "$key")
  case "$items" in
    *deskmate.dockitem*) ;;
    "" | "@as []") dconf write "$key" "['deskmate.dockitem']" ;;
    *) dconf write "$key" "$(echo "$items" | sed "s/]\$/, 'deskmate.dockitem']/")" ;;
  esac
  echo "added to Plank dock: $dock"
done

#!/usr/bin/env bash
# Instala (o reemplaza) la entrada @reboot del túnel de MatiApp en el crontab
# del usuario. No requiere sudo.
set -euo pipefail

SCRIPT="$HOME/victoriasapp/deploy/start-tunnel.sh"
ENTRY="@reboot sleep 30 && $SCRIPT >> $HOME/.cloudflared/cron.log 2>&1"
TMP="$(mktemp)"

crontab -l 2>/dev/null | grep -v 'victoriasapp/deploy/start-tunnel.sh' >"$TMP" || true
printf '%s\n' "$ENTRY" >>"$TMP"
crontab "$TMP"
rm -f "$TMP"

echo "cron instalado:"
crontab -l | grep 'start-tunnel.sh'

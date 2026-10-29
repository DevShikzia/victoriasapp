#!/usr/bin/env bash
# Arranca el túnel de Cloudflare de MatiApp con reintento automático.
# Se invoca a mano y desde @reboot (ver deploy/README.md).
set -u

export PATH="$HOME/.local/bin:$PATH"
CONFIG="$HOME/victoriasapp/deploy/cloudflared-config.yml"
LOG="$HOME/.cloudflared/tunnel.log"

if pgrep -x cloudflared >/dev/null; then
  echo "cloudflared ya está en ejecución."
  exit 0
fi

mkdir -p "$HOME/.cloudflared"
setsid -f bash -c "while true; do cloudflared tunnel --config '$CONFIG' --no-autoupdate run matiapp >> '$LOG' 2>&1; sleep 10; done" </dev/null >/dev/null 2>&1
echo "túnel iniciado. Log: $LOG"

#!/usr/bin/env bash
# Detiene el túnel de Cloudflare de MatiApp.
set -u
pkill -x cloudflared 2>/dev/null || true
echo "cloudflared detenido."

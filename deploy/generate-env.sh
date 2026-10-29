#!/usr/bin/env bash
# Genera deploy/.env con secretos aleatorios. No se versiona.
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$DIR/.env"
ADMIN_FILE="$DIR/.admin-password"

if [ -f "$ENV_FILE" ]; then
  echo "Ya existe $ENV_FILE. No se sobrescribe."
  exit 1
fi

rand_hex() {
  openssl rand -hex "${1:-24}"
}

ADMIN_PASSWORD="$(rand_hex 16)"
WEB_PORT="${WEB_PORT:-8081}"
WEB_BIND="${WEB_BIND:-127.0.0.1}"
CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:${WEB_PORT}}"

umask 077
cat >"$ENV_FILE" <<EOF
# Generado por deploy/generate-env.sh. No versionar.
NODE_ENV=production
PORT=3000

MONGODB_URI=mongodb://matiapp_app:placeholder@mongo:27017/matiapp?authSource=matiapp

JWT_ACCESS_SECRET=$(rand_hex 32)
JWT_REFRESH_SECRET=$(rand_hex 32)
ACCESS_TOKEN_SEGUNDOS=900
REFRESH_TOKEN_SEGUNDOS=604800

# Con web y API en el mismo origen alcanza "lax". "none" solo hace falta
# cuando el PWA y la API viven en dominios distintos.
CORS_ORIGINS=${CORS_ORIGINS}
COOKIE_SAMESITE=lax

ADMIN_USUARIO=admin
ADMIN_NOMBRE=Administrador
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_FORZAR_RESET=false

MONGO_ROOT_USER=matiapp_root
MONGO_ROOT_PASSWORD=$(rand_hex 24)
MONGO_DB=matiapp
MONGO_APP_USER=matiapp_app
MONGO_APP_PASSWORD=$(rand_hex 24)

WEB_BIND=${WEB_BIND}
WEB_PORT=${WEB_PORT}
EOF

printf '%s' "$ADMIN_PASSWORD" >"$ADMIN_FILE"
chmod 600 "$ENV_FILE" "$ADMIN_FILE"

echo "Creado $ENV_FILE (600) y $ADMIN_FILE (600)."
echo "Admin: admin / la contraseña de $ADMIN_FILE"

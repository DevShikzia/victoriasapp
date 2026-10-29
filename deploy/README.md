# Despliegue de MatiApp en la notebook

Stack aislado de la app de correspondencia:

- MongoDB propio (`matiapp-mongo`), sin puerto en el host.
- API Node/Express/Socket.IO (`matiapp-api`), solo en la red interna.
- Nginx con el PWA y proxy `/api` + `/socket.io` (`matiapp-web`), publicado en
  `127.0.0.1:8081`.
- Cloudflare Tunnel para el acceso público con HTTPS.

## Primer despliegue

```bash
cd ~/victoriasapp
bash deploy/generate-env.sh
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml build
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d
```

Comandos del día a día:

```bash
cd ~/victoriasapp
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml ps
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml logs -f api
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d
```

Actualizar código:

```bash
cd ~/victoriasapp
git pull --ff-only
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml build
docker compose --env-file deploy/.env -f deploy/docker-compose.prod.yml up -d
```

## Cloudflare Tunnel

Con `cloudflared` instalado y el dominio en Cloudflare:

```bash
cloudflared tunnel login
cloudflared tunnel create matiapp
cloudflared tunnel route dns matiapp matiapp.TUDOMINIO.com
```

Servicio con `~/.config/cloudflared/config.yml`:

```yaml
tunnel: matiapp
credentials-file: /home/shikzia/.cloudflared/<UUID>.json
ingress:
  - hostname: matiapp.TUDOMINIO.com
    service: http://127.0.0.1:8081
  - service: http_status:404
```

En el servidor, `deploy/cloudflared-config.yml` es local (no se versiona porque
lleva el UUID real del túnel y el dominio). Se parte de
`deploy/cloudflared-config.example.yml` y se completa con `cloudflared tunnel
create` / `route dns`.

```bash
cloudflared tunnel run matiapp
```

En `deploy/.env` actualizar `CORS_ORIGINS=https://matiapp.TUDOMINIO.com` y
recrear la API (`up -d api`). Las cookies ya salen `Secure` porque
`NODE_ENV=production`.

## Notas

- `deploy/.env` y `deploy/.admin-password` tienen permisos `600` y no se versionan.
- No usar `docker compose ... down -v`: borra la base de MatiApp.
- La cámara del celular requiere HTTPS; el túnel lo provee.
- No se publica MongoDB ni la API; solo Nginx en loopback.

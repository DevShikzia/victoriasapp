# 12 — Git y despliegue

## Repositorio

- Remoto: `https://github.com/DevShikzia/victoriasapp.git`
- Rama principal: `main`

## Configuración inicial

```bash
echo "# victoriasapp" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/DevShikzia/victoriasapp.git
git push -u origin main
```

Si ya existe historial local, simplemente:

```bash
git remote add origin https://github.com/DevShikzia/victoriasapp.git
git branch -M main
git push -u origin main
```

## Archivos ignorados

Ver [`.gitignore`](../.gitignore). En resumen: `node_modules`, builds (`dist`, `www`), archivos de
entorno (`.env`), logs, y artefactos de IDE/OS.

## Ramas y flujo

```
main ────●───────────────●──────────►
          \             /
develop ───●───●───●───●──────────────►
               \   /
feat/escaneo ───●─●
```

1. Crear rama desde `develop`.
2. Commits con Conventional Commits.
3. Pull Request → revisión → merge a `develop`.
4. `develop` → `main` para releases.

## Variables de entorno

Nunca se comitea `.env`. Se provee un `.env.example` con la forma de cada variable:

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto de la API |
| `MONGODB_URI` | Cadena de conexión a Mongo |
| `JWT_ACCESS_SECRET` | Secreto del access token |
| `JWT_REFRESH_SECRET` | Secreto del refresh token |
| `CORS_ORIGINS` | Orígenes permitidos (separados por coma) |
| `NODE_ENV` | `development` \| `production` |

## Entornos

| Entorno | Frontend | API | Mongo |
| --- | --- | --- | --- |
| Local | `ng serve` | `tsx watch` | Docker |
| Producción | Build estático (HTTPS) | Node en un servidor/VPS | MongoDB |

### Local con Docker

```bash
docker compose up -d mongo     # levanta Mongo
npm run dev -w apps/api        # levanta la API
npm run start -w apps/web      # levanta el PWA
```

## HTTPS (obligatorio para la cámara)

El celular **sólo** accede a la cámara en un contexto seguro:

- `localhost` (desarrollo en la misma máquina), o
- Un sitio con **HTTPS** y certificado válido.

Opciones para producción:

1. **VPS + dominio + Let's Encrypt** (recomendado, simple).
2. Plataforma con HTTPS automático (Render, Railway, Fly.io, etc.).
3. Túnel (Cloudflare Tunnel) hacia un servidor propio.

El frontend se sirve como estáticos; la API detrás de un proxy (`nginx` o el del proveedor).

## Build de producción

```bash
npm run build            # build de todo
npm run build -w packages/shared
npm run build -w apps/api
npm run build -w apps/web
```

## Checklist de despliegue

- [ ] `.env` cargado en el servidor (no en el repo).
- [ ] Mongo accesible y con backup.
- [ ] HTTPS con certificado válido.
- [ ] CORS apuntando al dominio real.
- [ ] `NODE_ENV=production`.
- [ ] PWA servida por HTTPS y con el service worker activo.
- [ ] Verificado el acceso a cámara desde el celular.

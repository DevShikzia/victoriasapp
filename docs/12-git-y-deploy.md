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
| `JWT_ACCESS_SECRET` | Secreto del access token (mín. 32 caracteres) |
| `JWT_REFRESH_SECRET` | Secreto del refresh token (mín. 32 caracteres) |
| `ACCESS_TOKEN_SEGUNDOS` | Vida del access token en segundos (por defecto `900`) |
| `REFRESH_TOKEN_SEGUNDOS` | Vida del refresh token en segundos (por defecto `604800`) |
| `CORS_ORIGINS` | Orígenes permitidos (separados por coma) |
| `NODE_ENV` | `development` \| `test` \| `production` |
| `ADMIN_USUARIO` | Usuario administrador a crear (por defecto `admin`) |
| `ADMIN_NOMBRE` | Nombre del administrador |
| `ADMIN_PASSWORD` | Contraseña inicial del admin (si falta, no se crea) |
| `ADMIN_FORZAR_RESET` | `true` resetea la contraseña del admin existente |

Hay un **`.env.example`** listo para copiar en `apps/api/.env.example` (es el directorio desde el que
corre la API, así que `dotenv` lee `apps/api/.env`).

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

### Probar desde el celular (misma red Wi‑Fi)

El PWA y la API viajan por **el mismo origen**: el dev server de Angular hace de proxy hacia la API
(`apps/web/proxy.conf.json`), así que no hace falta tocar CORS ni la URL de la API al cambiar de
dispositivo (`CONFIG.apiBaseUrl` usa `window.location.origin`).

```bash
npm run dev:api        # API (escucha en la red)
npm run dev:web:lan    # PWA expuesto a la red (HTTP)
```

En el celular (misma red Wi‑Fi): `http://<IP-de-la-PC>:4200`.

> Si no entra, permití los puertos `4200` y `3000` en el firewall de Windows.

La cámara **no** funciona por HTTP: necesitás HTTPS (ver "HTTPS para desarrollo").

## HTTPS (obligatorio para la cámara)

El celular **sólo** accede a la cámara en un contexto seguro:

- `localhost` (desarrollo en la misma máquina), o
- Un sitio con **HTTPS** y certificado válido.

Opciones para producción:

1. **VPS + dominio + Let's Encrypt** (recomendado, simple).
2. Plataforma con HTTPS automático (Render, Railway, Fly.io, etc.).
3. Túnel (Cloudflare Tunnel) hacia un servidor propio.

### HTTPS para desarrollo (mkcert)

Para probar la **cámara** desde el celular en tu red, serví el PWA por HTTPS local con `mkcert`:

```bash
npm run certs          # genera apps/web/certs/ (requiere mkcert; Windows: winget install FiloSottile.mkcert)
npm run dev:web:https  # ng serve --ssl con ese certificado
```

`mkcert -install` crea una CA de confianza local; instalá `rootCA.pem` en el celular (Android:
Ajustes > Seguridad > Instalar certificado > CA). Después abrí `https://<IP-de-la-PC>:4200`. El proxy
sigue mandando la API a `http://localhost:3000`, así que sólo el PWA va por TLS.

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

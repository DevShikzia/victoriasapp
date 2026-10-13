# @victoriasapp/api

API REST y realtime de victoriasapp.

- **Stack:** Node.js + TypeScript + Express + Mongoose (MongoDB) + Socket.IO.
- **Reglas:** TypeScript estricto, sin `any` (ver [convenciones](../../docs/11-convenciones-de-codigo.md)).

## Estructura

```
src/
├─ config/        # Variables de entorno y constantes
├─ models/        # Esquemas Mongoose
├─ schemas/       # Validación Zod
├─ services/      # Lógica de negocio
├─ controllers/   # Capa HTTP
├─ routes/        # Definición de rutas
├─ middleware/    # Auth, errores, rate limit
├─ realtime/      # Socket.IO
├─ utils/
└─ server.ts      # Entrada
```

## Desarrollo

```bash
# 1) Levantar Mongo
docker compose up -d mongo

# 2) Copiar variables de entorno
cp .env.example .env

# 3) Levantar con recarga automática
npm run dev -w @victoriasapp/api
```

La API queda en `http://localhost:3000` y el health check en `/api/health`.

## Endpoints

Ver [docs/05-api-rest.md](../../docs/05-api-rest.md).

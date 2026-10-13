# 05 — API REST

Base: `/api`. Todas las respuestas son JSON. Autenticación por **Bearer JWT** (ver
[seguridad](./06-seguridad.md)).

## Convenciones

- Versionado por header opcional `Accept-Version`; por ahora v1 implícita.
- Errores con formato uniforme:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El DNI es obligatorio",
    "detalles": [{ "campo": "dni", "mensaje": "Requerido" }]
  }
}
```

- Respuestas exitosas: `{ "ok": true, "data": ... }`.

## Autenticación

### `POST /api/auth/login`

```json
{ "usuario": "jperez", "password": "..." }
```

Respuesta: `accessToken` (corto, en el body) y `refreshToken` (cookie `httpOnly`).

### `POST /api/auth/refresh`

Renueva el `accessToken` usando la cookie de refresh.

### `POST /api/auth/logout`

Revoca el refresh token actual.

### `GET /api/auth/me`

Devuelve el usuario autenticado.

## Visitas

### `GET /api/visits`

Parámetros: `desde`, `hasta`, `tipo`, `lote`, `dni`, `patente`, `abiertas` (boolean),
`q` (texto libre), `page`, `limit`.

### `GET /api/visits/:id`

### `POST /api/visits`

Crea un registro (normalmente se hace por `/sync`, pero existe para uso online directo).

### `PATCH /api/visits/:id`

Actualiza campos (por ejemplo, marcar salida: `{ "salidaEn": "2026-10-13T18:40:00Z" }`).

### `POST /api/visits/:id/salida`

Atajo para marcar egreso.

### `GET /api/visits/abiertas`

Lista de visitantes actualmente dentro (sin `salidaEn`).

## Sincronización

### `POST /api/sync`

Recibe un lote de cambios creados offline. Es **idempotente** por `uuid`.

```json
{
  "visitas": [
    {
      "uuid": "b1c2...",
      "tipo": "ingreso",
      "apellido": "PEREZ",
      "nombre": "JUAN",
      "dni": "30123456",
      "patente": "AB123CD",
      "loteNumero": "42",
      "entradaEn": "2026-10-13T12:00:00Z",
      "creadoOffline": true
    }
  ]
}
```

Respuesta:

```json
{
  "ok": true,
  "data": {
    "aplicados": ["b1c2..."],
    "duplicados": [],
    "errores": []
  }
}
```

Reglas:

- Si el `uuid` ya existe → no se duplica, se devuelve en `duplicados`.
- Conflictos: gana la versión con `updatedAt` más reciente (last-write-wins documentado).
- La respuesta sirve para que el cliente marque los pendientes como sincronizados.

## Directorio

### `GET /api/propietarios`

Búsqueda: `q` (nombre o apellido), `lote`, `page`, `limit`.

### `GET /api/propietarios/:id`

### `POST /api/propietarios` (admin/supervisor)

### `PATCH /api/propietarios/:id`

### `DELETE /api/propietarios/:id`

### `GET /api/lotes`, `POST /api/lotes`, `PATCH /api/lotes/:id`

### `GET /api/vehiculos`

Búsqueda por `patente`.

### `GET /api/familiares`

## Usuarios (admin)

### `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id`

## Salud

### `GET /api/health`

Devuelve estado del servicio y de la conexión a Mongo.

## Tiempo real (Socket.IO)

Namespace `/realtime`. El cliente se autentica con el `accessToken`.

| Evento | Dirección | Payload |
| --- | --- | --- |
| `visit:created` | servidor → clientes | Visita creada |
| `visit:updated` | servidor → clientes | Visita actualizada |
| `visit:exit` | servidor → clientes | Se marcó salida |

## Códigos de error

| Código | HTTP | Significado |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Datos inválidos |
| `UNAUTHORIZED` | 401 | Falta token o es inválido |
| `FORBIDDEN` | 403 | Sin permisos para la acción |
| `NOT_FOUND` | 404 | Recurso inexistente |
| `CONFLICT` | 409 | Duplicado (ej. `uuid`, patente) |
| `RATE_LIMITED` | 429 | Demasiados intentos |
| `INTERNAL` | 500 | Error no esperado |

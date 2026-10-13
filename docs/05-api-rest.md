# 05 — API REST

Base: `/api`. Todas las respuestas son JSON. Autenticación por **Bearer JWT** (ver
[seguridad](./06-seguridad.md)).

> **Estado (Fase 4):** implementado autenticación (`/api/auth/*`), RBAC, `/api/sync` idempotente,
> `/api/visits` (`GET`, `GET /abiertas`, `POST /:id/salida`) y `/api/users` (ABM, sólo admin).
> Sumado en Fase 4: el **directorio** (`/api/directorio` + ABM por entidad, ver más abajo) y el
> canal de **tiempo real** (Socket.IO, namespace `/realtime`).

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

Parámetros: `desde`, `hasta`, `lote`, `dni`, `patente`, `abiertas` (boolean),
`estado` (`dentro` | `fuera`), `q` (texto libre sobre apellido, nombre, DNI, patente, lote y
propietario; se trata como literal, no como regex) y `limit` (por defecto 200, máximo 500).
Los resultados se ordenan por `entradaEn` descendente.

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

Cada entidad del directorio (`barrio`, `lote`, `propietario`, `familiar`, `vehiculo`) tiene un CRUD
completo bajo su prefijo. Todas las rutas exigen autenticación; **crear/editar/borrar** requieren rol
`admin` o `supervisor`. El **borrado es lógico para la sync**: se elimina el documento y se deja una
"lápida" en la colección `eliminados` para que el pull incremental propague la baja.

| Entidad | Prefijo | Búsqueda (`query`) |
| --- | --- | --- |
| Barrio | `/api/barrios` | `q` (nombre) |
| Lote | `/api/lotes` | `q` (número), `barrioId` |
| Propietario | `/api/propietarios` | `q` (nombre o apellido), `lote`, `barrioId` |
| Familiar | `/api/familiares` | `q` (nombre), `propietarioId` |
| Vehículo | `/api/vehiculos` | `patente`, `propietarioId` |

En todos: `GET /` (lista), `POST /`, `GET /:id`, `PATCH /:id`, `DELETE /:id`. Paginación `page`
(default 1) y `limit` (por defecto 200, máximo 500).

### `GET /api/directorio?desde=<ISO>`

**Pull incremental** para la caché offline del PWA. Devuelve las **proyecciones locales** (nombres
desnormalizados, listas para guardar sin join) de todo lo que cambió después de `desde`, más las
bajas:

```json
{
  "ok": true,
  "data": {
    "desde": "2026-10-13T12:00:00.000Z",
    "lotes": [],
    "propietarios": [],
    "familiares": [],
    "vehiculos": [],
    "eliminados": [{ "uuid": "…", "entidad": "propietario", "eliminadoEn": "…" }]
  }
}
```

- Sin `desde` devuelve el directorio completo (primer pull).
- El cliente guarda el `desde` devuelto y lo manda en el próximo pull.
- Aplicar el resultado es **idempotente** (`bulkPut` por `uuid` + bajas).

### `POST /api/directorio/importar` (admin/supervisor)

Importa un CSV: crea barrio, lotes, propietarios, familiares y vehículos. Ver formato en
[`09-directorio-barrio.md`](./09-directorio-barrio.md).

```json
{ "barrio": "Los Álamos", "csv": "lote,propietario,telefono,patente\n42,Juan Perez,11-5555-5555,AB123CD" }
```

```json
{
  "ok": true,
  "data": { "creados": 1, "actualizados": 0, "lotes": 1, "vehiculos": 1, "errores": [] }
}
```

### `GET /api/barrios`, `GET /api/lotes`, `GET /api/propietarios`, `GET /api/familiares`, `GET /api/vehiculos`

Listado con filtros de búsqueda (ver tabla). Ejemplos: `GET /api/propietarios?q=perez`,
`GET /api/vehiculos?patente=AB123CD`, `GET /api/familiares?propietarioId=…`.

## Usuarios (admin)

Todas las rutas requieren rol `admin`. `UsuarioPublico` = `{ id, usuario, nombre, rol, garitaId }`;
el listado agrega `activo` (`UsuarioAdmin`).

| Método y ruta | Para qué |
| --- | --- |
| `GET /api/users` | Lista **todos** los usuarios (activos e inactivos), ordenados por `usuario`. Cada uno es `UsuarioAdmin` (incluye `activo`). |
| `POST /api/users` | Alta: `usuario` (`[a-zA-Z0-9._-]{3,60}`), `nombre`, `password` (mínimo 8), `rol` (`admin`/`supervisor`/`guardia`) y `garitaId` opcional. |
| `PATCH /api/users/:id` | Edita `nombre`, `rol`, `activo`, `garitaId` y, opcionalmente, `password` (al cambiarla se **revocan las sesiones**). El `usuario` no se puede cambiar. |
| `DELETE /api/users/:id` | **Baja lógica**: deja `activo: false` y revoca las sesiones. Se reactiva con `PATCH { activo: true }`. |

La pantalla del PWA es `/usuarios` (ver `docs/08-ui-ux.md`).

## Salud

### `GET /api/health`

Devuelve estado del servicio y de la conexión a Mongo.

## Tiempo real (Socket.IO)

Namespace `/realtime`. El cliente se autentica con el `accessToken` en el handshake
(`auth: { token }`). Si el token es inválido, el servidor rechaza la conexión.

| Evento | Dirección | Payload |
| --- | --- | --- |
| `conectado` | servidor → cliente | `{ usuario, nombre, rol }` (confirma la autenticación) |
| `visita:creada` | servidor → clientes | `{ visita: VisitaDto }` |
| `visita:actualizada` | servidor → clientes | `{ visita: VisitaDto }` (incluye el egreso) |
| `directorio:actualizado` | servidor → clientes | `{ entidad, uuid, operacion: 'crear' \| 'actualizar' \| 'eliminar' }` |

El panel en vivo (`/panel` en el PWA) usa `visita:creada` y `visita:actualizada` para mostrar las
visitas abiertas de todos los puestos; `directorio:actualizado` sirve para refrescar el directorio.

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

# 04 — Modelo de datos

Todas las colecciones usan TypeScript estricto (sin `any`). Los esquemas Mongoose viven en
`apps/api/src/models`; los tipos compartidos, en `packages/shared`.

## Convenciones

- Cada documento tiene `createdAt` y `updatedAt` (timestamps de Mongoose).
- Los registros creados offline llevan un `uuid` generado en el cliente (idempotencia).
- Las fechas se guardan como `Date` (Mongo), nunca como string, salvo fechas "de calendario"
  (nacimiento) que se guardan como `YYYY-MM-DD`.

## Colecciones

### `users` — Usuarios (guardias, supervisores, admins)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | ObjectId | |
| `nombre` | string | Nombre completo |
| `usuario` | string | Único, usado para login |
| `passwordHash` | string | bcrypt / argon2id |
| `rol` | enum | `admin` \| `supervisor` \| `guardia` |
| `garitaId` | ObjectId \| null | Puesto asignado |
| `barrioId` | ObjectId \| null | Barrio activo; se elige una sola vez al primer ingreso |
| `activo` | boolean | |
| `ultimoAcceso` | Date \| null | |
| `refreshTokenHash` | string \| null | Para revocar sesiones |

Índices: `usuario` (único).

### `garitas` — Puestos de acceso

| Campo | Tipo | Notas |
| --- | --- | --- |
| `nombre` | string | Ej. "Garita Norte" |
| `activa` | boolean | |

### `barrios` — Barrio cerrado

| Campo | Tipo | Notas |
| --- | --- | --- |
| `nombre` | string | |
| `direccion` | string \| null | |
| `activo` | boolean | |

### `lotes` — Lotes / parcelas

| Campo | Tipo | Notas |
| --- | --- | --- |
| `barrioId` | ObjectId | Ref `barrios` |
| `numero` | string | Número de lote |
| `propietarioId` | ObjectId \| null | Titular principal (espejo ordenado de `Propietario.loteId`) |
| `calle` | string \| null | |
| `notas` | string \| null | |

Índices: `{ barrioId, numero }` (único), `numero`.

> Un lote puede tener **varios propietarios**. La fuente de verdad es `Propietario.loteId`; el
> `propietarioId` del lote se recalcula automáticamente al crear/editar/borrar titulares o al
> importar el CSV, dejando primero al **señor**, después a la **señora** y luego por apellido/nombre.

### `propietarios` — Titulares (señor / señora)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `barrioId` | ObjectId | Ref `barrios` |
| `loteId` | ObjectId \| null | Ref `lotes` |
| `nombre` | string | Nombre completo |
| `apellido` | string | Para búsqueda |
| `tratamiento` | enum \| null | `senor` \| `senora`; define el orden dentro del lote |
| `telefono` | string \| null | |
| `email` | string \| null | |
| `descripcion` | string \| null | Notas libres |
| `activo` | boolean | |

Índices: texto sobre `nombre`, `apellido`; `loteId`.

> En un mismo lote, el **señor** se muestra antes que la **señora**; si hay un solo titular, se
> muestra solo. `tratamiento` es nullable por datos históricos.

### `familiares` — Familia (hijos, etc.)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `propietarioId` | ObjectId | Ref `propietarios` |
| `loteId` | ObjectId | Ref `lotes` |
| `nombre` | string | |
| `parentesco` | string \| null | Ej. "hijo", "cónyuge" |
| `descripcion` | string \| null | |
| `activo` | boolean | |

Índices: texto sobre `nombre`; `propietarioId`.

### `vehiculos` — Vehículos del barrio

| Campo | Tipo | Notas |
| --- | --- | --- |
| `patente` | string \| null | Opcional; normalizada (mayúsculas, sin espacios) |
| `marca` | string \| null | |
| `modelo` | string \| null | |
| `color` | string \| null | |
| `loteId` | ObjectId \| null | Ref `lotes`; el vehículo se asocia a un lote |
| `propietarioIds` | ObjectId[] | Propietarios del lote que usan el vehículo |
| `familiarIds` | ObjectId[] | Familiares del lote que usan el vehículo |
| `descripcion` | string \| null | |

Índices: `patente` (único parcial, sólo si existe), `loteId`.

> El formulario elige primero el lote y luego permite marcar uno o varios **usuarios** (propietarios
> y familiares de ese lote). `propietarioId` y `familiarId` singulares quedan sólo como espejo de
> compatibilidad para documentos viejos; la API nueva usa las listas.

> Las cinco entidades del directorio (`barrios`, `lotes`, `propietarios`, `familiares`, `vehiculos`)
> llevan además un campo **`uuid`** (único) para poder crearlas/editarlas offline de forma idempotente,
> y `activo` (boolean). Ver `apps/api/src/models/directorio.modelos.ts`.

### `eliminados` — Lápidas de borrado (sync)

| Campo | Tipo | Notas |
| --- | --- | --- |
| `uuid` | string | Documento borrado |
| `entidad` | string | `barrio` \| `lote` \| `propietario` \| `familiar` \| `vehiculo` |
| `eliminadoEn` | Date | Cuándo se borró |

Índices: `eliminadoEn`. El borrado del directorio es lógico **para la sync**: se elimina el documento y
se deja esta fila, para que el pull incremental indique a los clientes que limpien su caché.

### `visitas` — Registros de ingreso/egreso

| Campo | Tipo | Notas |
| --- | --- | --- |
| `uuid` | string | Generado en el cliente. Único (idempotencia) |
| `barrioId` | ObjectId | |
| `garitaId` | ObjectId | Puesto que registra |
| `guardiaId` | ObjectId | Ref `users` |
| `tipo` | enum | `ingreso` \| `egreso` |
| **Persona** | | |
| `apellido` | string | Autocompletado |
| `nombre` | string | Autocompletado |
| `dni` | string | Autocompletado |
| `fechaNacimiento` | string \| null | `YYYY-MM-DD` |
| `sexo` | enum \| null | `M` \| `F` \| `X` |
| `formatoDocumento` | enum | `pdf417-viejo` \| `pdf417-intermedio` \| `qr` \| `mrz` \| `manual` |
| `documentoRaw` | string \| null | Payload crudo (auditoría) |
| **Vehículo / destino** | | |
| `patente` | string \| null | |
| `vehiculoId` | ObjectId \| null | Si coincide con un vehículo del barrio |
| `loteId` | ObjectId \| null | |
| `loteNumero` | string \| null | Copia desnormalizada |
| `propietarioId` | ObjectId \| null | |
| `propietarioNombre` | string \| null | Copia desnormalizada |
| `motivo` | string \| null | |
| `acompanantes` | number | Default 0 |
| **Tiempos** | | |
| `entradaEn` | Date | |
| `salidaEn` | Date \| null | |
| **Sync** | | |
| `syncRev` | number | Se incrementa en cada cambio del servidor |
| `creadoOffline` | boolean | |

Índices: `uuid` (único), `{ barrioId, entradaEn }`, `dni`, `patente`, `loteNumero`.

### `auditLogs` — Auditoría

| Campo | Tipo | Notas |
| --- | --- | --- |
| `userId` | ObjectId \| null | Quién |
| `accion` | string | `login`, `visit.create`, `owner.update`, … |
| `entidad` | string \| null | Colección afectada |
| `entidadId` | string \| null | |
| `ip` | string \| null | |
| `userAgent` | string \| null | |
| `detalle` | Record<string, unknown> \| null | |

Índices: `{ userId, createdAt }`, `accion`.

## Tipos compartidos

Los tipos de dominio se definen en `packages/shared/src/types` y se importan en la API y en el PWA.
Interfaces de ejemplo:

```ts
export type Sexo = 'M' | 'F' | 'X';

export type DniFormato =
  | 'pdf417-viejo'
  | 'pdf417-intermedio'
  | 'qr'
  | 'mrz'
  | 'manual';

export type RolUsuario = 'admin' | 'supervisor' | 'guardia';

export type TipoVisita = 'ingreso' | 'egreso';
```

> Reglas de tipado: ver [convenciones de código](./11-convenciones-de-codigo.md). Prohibido `any`.

# 07 — Offline y sincronización

La red en la garita es intermitente. El principio es simple: **el celular es la fuente de verdad
mientras no hay red**, y todo se reconcilia con Mongo cuando vuelve la conexión. Nunca se pierde un
registro ni se duplica.

## Almacenamiento local (IndexedDB)

Se usa IndexedDB (vía `Dexie` o `idb`). Tablas locales:

| Tabla | Contenido |
| --- | --- |
| `visitas` | Registros creados/editados en el dispositivo |
| `outbox` | Cola de operaciones pendientes de enviar |
| `propietarios` | Caché del directorio (búsqueda offline) |
| `lotes` | Caché de lotes |
| `vehiculos` | Caché de vehículos |
| `familiares` | Caché de familiares |
| `domesticas` | Caché de perfiles de domésticas (búsqueda offline) |
| `registrosDomesticas` | Entradas/salidas de domésticas creadas en el dispositivo |
| `sesion` | Usuario y tokens |
| `meta` | Última sincronización, versión de esquema |

## Patrón outbox

Cada cambio local (crear visita, marcar salida, editar) genera una **operación** en `outbox`:

```ts
interface OutboxItem {
  readonly id: string;          // id local
  readonly entidad: 'visita' | 'registroDomestica' | 'propietario' | 'vehiculo' | 'lote' | 'familiar';
  readonly operacion: 'create' | 'update' | 'delete';
  readonly uuid: string;        // uuid de la entidad
  readonly payload: unknown;    // datos a enviar (tipado en el modelo)
  readonly creadoEn: string;    // ISO
  readonly intentos: number;
  readonly ultimoError: string | null;
}
```

El registro se guarda **primero** en la tabla de entidad y **también** en `outbox`, en la misma
transacción, para que no se pierda nada.

## Flujo de sincronización

1. **Disparadores:** al guardar algo, al recuperar conexión (`online`), cada N minutos, o manual.
2. Se agrupa el `outbox` y se envía a `POST /api/sync`.
3. La API hace **upsert idempotente por `uuid`**.
4. La respuesta indica qué se aplicó; esos ítems se borran del `outbox`.
5. Los ítems con error quedan con `intentos++` y se reintentan con *backoff* exponencial.
6. Se hace **pull** de novedades (directorio y visitas cambiadas) para refrescar la caché local.

```
[Crear visita] → IndexedDB (visitas + outbox)
      │
      │ (hay red)
      ▼
POST /api/sync ──► Mongo (upsert por uuid)
      │
      ▼
{ aplicados, duplicados, errores } ──► limpiar outbox
```

## Idempotencia

- El `uuid` lo genera el **cliente** (`crypto.randomUUID()`).
- Reintentar el mismo `uuid` no crea otro documento.
- Así, un fallo de red a mitad de camino no duplica registros.

## Resolución de conflictos

- Estrategia: **last-write-wins** por `updatedAt`.
- La API incrementa `syncRev` en cada cambio — sirve para detectar quién ganó.
- Si un supervisor edita en la computadora algo que el guardia también editó offline, gana la
  edición más reciente. Se documenta esta regla en la UI (aviso de "registro actualizado").

## Caché del directorio

- El directorio (propietarios, lotes, vehículos, familiares) se **descarga** y se cachea para poder
  buscar **sin red**.
- Sólo se descargan los cambios desde la última sincronización (`updatedAt > ultimaSync`), más las
  bajas (`eliminados`) para propagar los borrados.
- El ABM offline (encolar altas/ediciones del directorio en el `outbox`) está **pendiente**: hoy el
  ABM del directorio es online (admin/supervisor) y el PWA sólo lo cachea para consultar.

## Detección de conectividad

- `navigator.onLine` + eventos `online`/`offline`.
- Además, un *ping* a `/api/health` para confirmar conectividad real (no sólo interfaz de red).

## Estados visibles para el guardia

- **Sin conexión:** indicador visible; todo sigue funcionando.
- **N pendientes:** cantidad de registros por sincronizar.
- **Sincronizado:** confirmación al subir.

## Pruebas

- Crear registros offline y verificar que llegan al reconectar.
- Simular corte de red en medio del envío y comprobar que no se duplica.
- Sincronizar desde dos dispositivos a la vez con el mismo `uuid`.

## Implementado (Fases 2–4)

La parte local está en el PWA:

- `apps/web/src/app/core/db/base-local.ts` — la base Dexie con todas las tablas.
- `apps/web/src/app/core/db/datos.service.ts` — guardar visita / marcar salida / buscar en el
  directorio. Cada cambio escribe en la entidad **y** en `outbox` dentro de una transacción.
  También `aplicarDirectorio(pull)`: hace `bulkPut` de las proyecciones locales y procesa las bajas.
- Búsqueda **difusa** local (`buscarLotes` / `buscarPropietarios` / `buscarVehiculos`) apoyada en
  `ordenarPorCoincidencia` de `packages/shared`: sin acentos, por prefijo de palabra y tolerante a
  errores de tipeo.
- `apps/web/src/app/features/visita/` — formulario de nueva visita + escáner de DNI incrustado.
- `apps/web/src/app/features/visitas/` — listado con estado de sync y marcado de salida.
- `apps/web/src/app/core/sync/sincronizador.service.ts` — sube el `outbox` (`POST /api/sync`) **y**
  baja el directorio (`GET /api/directorio?desde=`) usando `meta`/`directorio.ultimaSync`. Ambas
  operaciones exigen **barrio activo** y sólo traen datos de ese barrio.
- Al cambiar de cuenta o de barrio, `SesionService` borra lotes, propietarios, familiares, vehículos
  y el `desde` de la última sync. Las visitas locales quedan para no perder registros offline.
- `apps/web/src/app/core/tiempo-real/tiempo-real.service.ts` + `features/panel/` — panel en vivo
  por Socket.IO; descarta eventos de visitas de otros barrios.
- `core/busqueda/propietarios.ts` + `features/propietarios/` — listado offline de propietarios con
  búsqueda y orden por lote/alfabético.
- `apps/web/src/app/features/domesticas/` — perfiles de domésticas (ABM online para admin/supervisor)
  y registro de entrada/descripción/salida **offline**: el registro se guarda en
  `registrosDomesticas` + `outbox` y se sube por `/api/sync`. El perfil se cachea con el pull del
  directorio. Una doméstica no puede tener dos entradas abiertas: se valida en el cliente y en el
  servidor. El historial se arma con los registros locales y se puede filtrar por fecha, lote,
  doméstica, estado y texto.

La **subida del outbox** y el **pull incremental del directorio** ya están (Fases 3 y 4). Pendiente:
la **edición offline del directorio** (hoy el ABM es online, admin/supervisor) y el pull de visitas
cambiadas desde otros puestos (hoy el panel las recibe por tiempo real).

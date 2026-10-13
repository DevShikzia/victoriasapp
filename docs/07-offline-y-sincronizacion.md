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
| `sesion` | Usuario y tokens |
| `meta` | Última sincronización, versión de esquema |

## Patrón outbox

Cada cambio local (crear visita, marcar salida, editar) genera una **operación** en `outbox`:

```ts
interface OutboxItem {
  readonly id: string;          // id local
  readonly entidad: 'visita' | 'propietario' | 'vehiculo' | 'lote' | 'familiar';
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
- Sólo se descargan los cambios desde la última sincronización (`updatedAt > ultimaSync`).
- El ABM offline se encola en el `outbox` como cualquier otra entidad.

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

# 09 — Directorio del barrio

El directorio es una pieza central: permite saber **a qué lote va** un visitante y **de quién es un
auto**, incluso sin internet. Los datos se actualizan permanentemente y deben ser fáciles de buscar.

## Jerarquía

```
Barrio
 └─ Lote (nº)
     └─ Propietario (titular, normalmente señor y señora)
         ├─ Vehículo(s)
         └─ Familiar(es) (hijos, etc.)
              └─ Vehículo(s)
```

Un **lote** tiene uno o más **propietarios** (por ejemplo, "Juan Pérez" y "Ana Gómez"). Cada
propietario puede tener **vehículos** y **familiares**, y cada familiar puede tener sus propios
**vehículos**.

## Campos

- **Propietario:** nombre, apellido, teléfono, email, descripción libre.
- **Familiar:** nombre, parentesco, descripción.
- **Vehículo:** patente, marca, modelo, color, descripción, a quién pertenece (propietario o familiar).
- **Lote:** número, calle, notas.

## Búsquedas

| Buscar por | Resultado |
| --- | --- |
| **Nombre** (propietario o familiar) | Lote + vehículos + contacto |
| **Lote** | Titulares + familia + vehículos |
| **Patente** | De quién es, lote, descripción |

La búsqueda **offline** en el PWA (sobre el directorio cacheado) es **difusa**: insensible a acentos
y mayúsculas, por prefijo de palabra y tolerante a errores de tipeo. La búsqueda de la **API**
(`?q=`) es texto libre insensible a mayúsculas con coincidencia directa.

### Buscador global (`/buscar`)

La pantalla de inicio es un **único campo** que consulta en paralelo propietarios, familiares,
vehículos y lotes sobre IndexedDB. No hay que elegir pestañas ni apretar “Buscar”: los resultados
aparecen ~200 ms después de dejar de escribir.

- `DatosService.buscarGlobal()` corre las cuatro búsquedas con `Promise.all` y devuelve los grupos
  ordenados por relevancia (`ordenarPorCoincidencia`).
- `DatosService.buscarFamiliares()` es nueva y sigue el mismo patrón difuso que propietarios,
  vehículos y lotes.
- La **ficha** cruza los datos por **nombre de propietario normalizado** y **número de lote** (las
  proyecciones locales no guardan ids de referencia) y muestra titulares, familiares y vehículos
  relacionados. Es sólo informativa: no navega ni registra visitas.
- Ejemplos: `ricardo` devuelve todas las personas con ese nombre y su lote; `34` devuelve patentes
  que lo contienen y el lote `34`; `alamos` encuentra la calle “Los Álamos”.

## Uso durante un ingreso

1. El guardia escanea el DNI → datos de la persona.
2. Si el visitante **no sabe el lote**, el guardia escribe el **nombre del propietario** → la app trae
   el lote y lo completa.
3. Si viene **en auto**, carga la **patente** → si es un vehículo del barrio, la app indica de quién es.
4. Se guarda la visita con lote y propietario (copiados de forma desnormalizada para que el registro
   histórico no dependa de cambios posteriores en el directorio).

## Alta rápida desde la garita

Si el propietario no existe, el guardia (o el supervisor) puede **cargarlo al vuelo**:
- Nombre, lote, teléfono, patente.
- Queda en el `outbox` y se sincroniza igual que una visita.
- Luego se completa la información (familia, vehículos) desde la administración.

> **Estado (Fase 4):** el ABM del directorio funciona hoy **online** (admin/supervisor) y el PWA
> cachea el directorio por **pull incremental** para buscar **sin red**. La **alta rápida desde la
> garita offline** (cargar el propietario nuevo y encolarlo en el `outbox`) queda pendiente.

## Actualización permanente

- El directorio se puede editar en cualquier momento (admin/supervisor).
- Los cambios se sincronizan a todos los dispositivos (pull incremental por `updatedAt`).
- Para mantener el histórico correcto, las visitas guardan **copias** de lote y propietario al momento
  del registro.

### Administración desde el PWA (`/directorio`)

La pantalla de administración (`apps/web/src/app/features/directorio/`) permite el ABM **online**
contra la API, sólo para `admin`/`supervisor`:

- Pestañas por entidad (barrios, lotes, propietarios, familiares, vehículos) con buscador.
- Alta, edición y borrado (con confirmación). Los desplegables de referencias (`barrioId`, `loteId`,
  `propietarioId`, …) salen de las listas cargadas al entrar.
- Importación de CSV: subiendo un archivo o pegando el contenido.
- Después de cada cambio, dispara un sync para bajar el directorio actualizado a IndexedDB.

El módulo `DirectorioAdminService` (`core/directorio/directorio-admin.service.ts`) mapea cada entidad
a su ruta de la API (`barrio` → `/api/barrios`, etc.) y el PWA valida del lado del servidor (esquemas
`zod` compartidos). La edición **offline** del directorio (outbox) todavía no está implementada.

## Importación inicial

Si el barrio ya tiene la lista en Excel/CSV, se provee un **importador** que crea barrio, lotes,
propietarios, familiares y vehículos. Formato sugerido del CSV:

```csv
lote,propietario,telefono,patente,familiar,parentesco,descripcion
42,Juan Perez,11-5555-5555,AB123CD,,
42,Ana Gomez,11-6666-6666,AC456EF,Maria Perez,hija,
```

Columnas vacías se ignoran. Las patentes se normalizan (mayúsculas, sin espacios). El parser
(`parsearCsvDirectorio` en `@victoriasapp/shared`) acepta `,`, `;` o tabulaciones, campos entre
comillas y acentos, y lo reutilizan la API y el PWA.

### Implementación (`POST /api/directorio/importar`, admin/supervisor)

- Recibe `{ barrio, csv }` y devuelve `{ creados, actualizados, lotes, vehiculos, errores }`.
- Claves naturales: barrio por nombre, lote por barrio+número, propietario por barrio+nombre+apellido,
  vehículo por patente, familiar por propietario+nombre.

## Sincronización con el PWA

- `GET /api/directorio?desde=<ISO>` devuelve los cambios desde la última fecha (proyecciones locales
  desnormalizadas) más las **bajas** (`eliminados`). Ver [`05-api-rest.md`](./05-api-rest.md).
- El PWA guarda el `desde` en `meta` (clave `directorio.ultimaSync`) y lo manda en el próximo pull.
- Aplicar el resultado es **idempotente** (`bulkPut` por `uuid` + borrado de las bajas).
- Los cambios publican `directorio:actualizado` por Socket.IO para que los paneles se refresquen.

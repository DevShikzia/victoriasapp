# 15 — Buscador global y rediseño mobile-first

Plan de trabajo de la **Fase 5**. El objetivo es que un guardia, desde el celular,
pueda encontrar en segundos a un propietario, un familiar, un vehículo o un lote
escribiendo en **un solo buscador**, y que toda la app se sienta pensada para el
teléfono.

> Estado: **implementado** (Fase 5). Ver [`10-roadmap.md`](./10-roadmap.md).

## Problema

- El directorio ya se cachea offline en IndexedDB, pero la búsqueda está repartida
  en tres campos separados del formulario de nueva visita (lote, propietario y
  patente). Para responder *"¿quién es Ricardo y en qué lote vive?"* hay que
  navegar y probar.
- La navegación actual son seis enlaces en una barra superior con `flex-wrap`:
  en un celular quedan apretados e incómodos.
- Cada pantalla define sus propios colores, tamaños y tablas, así que la
  experiencia cambia de una a otra.

## Objetivo de UX

1. Al entrar (después del login) el guardia cae en **Buscar**.
2. Escribe y, sin apretar nada, a los ~200 ms ve resultados agrupados:
   **Personas**, **Familiares**, **Vehículos** y **Lotes**.
3. Cada resultado muestra el contexto que importa: *a qué lote pertenece*, quién
   es el propietario, teléfono, marca/modelo del auto.
4. Al tocar un resultado se abre una **ficha informativa** (sin navegar) con los
   datos completos y las personas/vehículos relacionados.
5. Todo funciona **sin conexión** con el directorio cacheado.

Ejemplos de búsqueda:

| Consulta | Resultado esperado |
| --- | --- |
| `ricardo` | Todos los Ricardo (propietarios y familiares) con su lote. |
| `34` | Patentes que contienen `34` y lotes `34`. |
| `ab123` | Vehículo `AB123CD`, con dueño y lote. |
| `gomze` | `GOMEZ` (tolera errores de tipeo). |
| `alamos` | Lote de la calle `Los Álamos` (sin tilde). |

## Arquitectura

### Datos (offline)

Las proyecciones locales ya traen los nombres desnormalizados, así que **no hace
falta tocar la API**:

```ts
interface PropietarioLocal {
  readonly nombre: string;
  readonly apellido: string;
  readonly telefono: string | null;
  readonly loteNumero: string | null;
  // …
}

interface FamiliarLocal {
  readonly nombre: string;
  readonly parentesco: string | null;
  readonly propietarioNombre: string; // "PEREZ, ANA"
  readonly loteNumero: string | null;
  // …
}

interface VehiculoLocal {
  readonly patente: string;
  readonly marca: string | null;
  readonly modelo: string | null;
  readonly propietarioNombre: string | null;
  readonly loteNumero: string | null;
  // …
}
```

- `DatosService.buscarFamiliares()` — nuevo; mismo patrón difuso que
  `buscarPropietarios` / `buscarVehiculos`.
- `DatosService.buscarGlobal()` — corre las cuatro búsquedas en paralelo y
  devuelve los grupos ya ordenados por relevancia.
- `DatosService.familiaresRelacionados()` / `vehiculosRelacionados()` /
  `propietariosDelLote()` — arman la ficha cruzando por **nombre de propietario**
  y **número de lote** (las proyecciones no guardan ids de referencia).
- `core/busqueda/buscador.service.ts` — orquesta la búsqueda y arma el modelo de
  la ficha (`DetalleFicha`).
- `core/busqueda/resaltado.ts` — parte el texto en segmentos para resaltar las
  coincidencias, mapeando índices sobre el texto normalizado (sin tildes).

El motor difuso es el de [`packages/shared/src/directorio/busqueda.ts`](../packages/shared/src/directorio/busqueda.ts):
tolera tildes, mayúsculas, prefijos, subsecuencias y errores de Levenshtein.

### Pantalla `/buscar`

- Ruta protegida; pasa a ser la **home** (`''` y `**` redirigen a `buscar`).
- Input único con `autofocus`, `type="search"`, **debounce de 200 ms** y
  `font-size: 16px` (evita el zoom automático de iOS).
- Resultados agrupados con íconos y contexto; el término buscado se resalta.
- Estado vacío con ejemplos tocables; estado sin resultados.
- **Ficha** como *bottom sheet* en móvil y panel lateral en escritorio.
  Es informativa: no navega ni registra visitas (decisión de producto).

## Navegación mobile-first

- **Bottom bar** (sólo móvil, `max-width: 767px`):
  `Buscar · Visitas · Nueva · Panel · Más`.
- **Más** abre una hoja con `Captura`, `Directorio` (admin/supervisor),
  `Usuarios` (admin), `Sincronizar` y `Salir`.
- En escritorio (`≥ 768px`) se mantiene la barra superior con todos los enlaces.
- Altura táctil mínima de 44 px y `env(safe-area-inset-bottom)` para iPhones.

## Sistema de diseño

Tokens en `apps/web/src/styles.scss`:

| Grupo | Tokens |
| --- | --- |
| Color | `--acento`, `--acento-claro`, `--acento-suave`, `--fondo`, `--superficie`, `--borde`, `--texto`, `--texto-suave`, `--alerta`, `--peligro` |
| Espaciado | `--esp-1` … `--esp-6` |
| Radios | `--radio-sm`, `--radio`, `--radio-lg`, `--radio-pill` |
| Sombras | `--sombra-1`, `--sombra-2`, `--sombra-3` |
| Layout | `--tap` (44 px), `--barra-alto`, `--tabbar-alto` |

Clases base compartidas: `.pantalla`, `.boton` (+ `--acento`, `--suave`,
`--peligro`), `.tarjeta`, `.campo`. Reglas globales: inputs a 16 px, foco
visible, `box-sizing: border-box`.

Breakpoints:

| Nombre | Ancho | Uso |
| --- | --- | --- |
| Móvil | `< 768px` | Bottom bar, listas/cards, una columna. |
| Escritorio | `≥ 768px` | Nav superior, tablas, grillas de 2–4 columnas. |

## Incrementos

| # | Alcance | Estado |
| --- | --- | --- |
| 1 | Buscador global (datos + pantalla + ficha) | ✅ |
| 2 | Shell mobile-first (bottom bar + menú Más) | ✅ |
| 3 | Tokens y estilos base | ✅ |
| 4 | Rediseño de login, visitas, nueva visita y captura | ✅ |
| 5 | Rediseño de panel, directorio y usuarios (tablas → cards) | ✅ |

## Pruebas

- `datos.service.spec.ts`: `buscarFamiliares` y `buscarGlobal` (incluye `34`
  encontrando patente y lote).
- `resaltado.spec.ts`: segmentos con tildes, mayúsculas, varios términos y sin
  coincidencia.
- `buscar.spec.ts`: render del input, búsqueda con debounce y apertura de ficha.
- Se mantiene el resto de la suite (web, api y shared) en verde.

## Fuera de alcance

- Buscar dentro del historial de visitas (se evalúa más adelante).
- Edición del directorio desde el celular (sigue siendo online-only).
- Cambios en la API: el buscador es 100 % local.

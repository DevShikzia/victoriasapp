# 08 — UI / UX

La app se usa en dos contextos: **celular del guardia** (rápido, con una mano, a veces con guantes)
y **computadora de monitoreo** (vista de panel). El diseño es **mobile-first**: primero se resuelve
la pantalla chica y después se aprovecha el ancho en escritorio. Ver
[`15-buscador-global-y-rediseno-mobile.md`](./15-buscador-global-y-rediseno-mobile.md).

## Principios

- **Menos toques posibles.** Escanear y guardar debe ser casi automático.
- **Una sola búsqueda.** Nombre, patente y lote se buscan juntos, sin elegir pestañas.
- **Todo editable.** Los datos autocompletados se pueden corregir.
- **Nunca bloquea.** Si no lee el código, se completa a mano.
- **Estado de red siempre visible** (online / offline / pendientes por sincronizar).
- **Botones grandes**, alto contraste, pensado para uso rápido y con poca luz.

## Navegación

| Contexto | Navegación |
| --- | --- |
| Celular (`< 768px`) | **Bottom bar** fija: `Buscar · Visitas · Nueva · Panel · Más`. |
| Escritorio (`≥ 768px`) | Barra superior con todos los enlaces + sesión. |

- **Buscar** es la pantalla de inicio (después del login).
- **Nueva** es la acción principal y se destaca con un botón circular.
- **Más** abre una hoja con `Captura`, `Directorio` (admin/supervisor), `Usuarios` (admin),
  `Sincronizar` y `Salir`.
- La barra superior muestra la marca, el estado de conexión y el botón de sincronizar (con un punto
  cuando hay pendientes). En escritorio suma el usuario y el rol.
- En `/login` no se muestra ninguna navegación.

## Sistema de diseño

Los tokens viven en `apps/web/src/styles.scss` y los componentes deben usarlos en vez de colores o
tamaños sueltos:

| Grupo | Tokens |
| --- | --- |
| Color | `--acento`, `--acento-claro`, `--acento-suave`, `--fondo`, `--superficie`, `--borde`, `--texto`, `--texto-suave`, `--alerta`, `--peligro`, `--info` |
| Espaciado | `--esp-1` … `--esp-6` |
| Radios | `--radio-sm`, `--radio`, `--radio-lg`, `--radio-pill` |
| Sombras | `--sombra-1`, `--sombra-2`, `--sombra-3` |
| Layout | `--tap` (44 px), `--barra-alto`, `--tabbar-alto` |

Clases base compartidas:

- `.pantalla`: ancho máximo y padding horizontal.
- `.boton` (+ `--acento`, `--suave`, `--peligro`, `--bloque`): altura táctil mínima de 44 px.
- `.tarjeta`: superficie con borde, radio y sombra.
- `.campo`: label + input/select/textarea con foco visible.

Reglas globales: `box-sizing: border-box`, inputs a **16 px** (evita el zoom de iOS), foco visible y
`env(safe-area-inset-bottom)` para la barra inferior en iPhones.

### Breakpoints

| Nombre | Ancho | Uso |
| --- | --- | --- |
| Móvil | `< 768px` | Bottom bar, listas/cards, una columna. |
| Escritorio | `≥ 768px` | Nav superior, tablas, grillas de 2–4 columnas. |

En las pantallas de administración las **tablas se convierten en tarjetas** en el celular: cada
`<td>` lleva `data-label` y se muestra como `etiqueta → valor`. En escritorio vuelven a ser tablas.

## Pantallas — Celular del guardia

### 1. Login

- Tarjeta centrada con marca, usuario y contraseña.
- Mensajes de error claros y botón grande.
- La sesión queda recordada para poder usar la app offline después.

### 2. Buscar (inicio)

- **Un solo campo** con autofocus: “Nombre, patente o lote”.
- La búsqueda se dispara **sola** a los ~200 ms de dejar de escribir; no hay botón "Buscar".
- Resultados agrupados: **Personas**, **Familiares**, **Vehículos** y **Lotes**.
- Cada fila muestra el contexto: lote, propietario, teléfono, marca/modelo.
- El término buscado se resalta (tolera tildes y mayúsculas).
- Estado inicial con ejemplos tocables (`ricardo`, `34`, `ab123`, `alamos`).
- Estado sin resultados con sugerencia de revisar la ortografía.
- Al tocar un resultado se abre una **ficha informativa** (bottom sheet en el celular, panel lateral
  en escritorio): datos completos + propietarios, familiares y vehículos relacionados. No navega ni
  registra visitas.

### 3. Nueva visita

- Selector **Ingreso / Egreso** tipo segmento.
- Botón grande **Escanear DNI** (escáner incrustado) + chip con el origen de la lectura.
- Formulario en tarjetas: **Persona** (apellido, nombre, DNI, nacimiento, sexo) y **Destino**
  (patente, lote, propietario, motivo, acompañantes).
- Autocompletado difuso de patente, lote y propietario sobre la caché local.
- Botón **Guardar** fijo sobre la barra inferior mientras se completa el formulario.

### 4. Visitas

- Métricas: abiertas, pendientes de sincronizar y total en el dispositivo.
- Tarjetas con nombre, DNI, patente, lote, propietario, motivo y horarios.
- Borde verde en las visitas abiertas y acción **Marcar salida**.
- Estado de sincronización visible (`pendiente`, `sincronizada`, `error`).
- Los datos de ejemplo quedan dentro de un desplegable para no ensuciar la pantalla.

### 5. Panel

- Pestañas **En vivo / Histórico** e indicador de tiempo real.
- **En vivo:** métricas, visitas abiertas de todos los puestos (Socket.IO) y export CSV.
- **Histórico:** búsqueda por texto, rango de fechas, estado y lote; export CSV.
- En el celular las tablas se leen como tarjetas; en escritorio como tabla.

### 6. Modo captura

- Cámara, foto y pegado manual de un payload.
- Muestra el `raw`, los datos interpretados y los errores del parser.
- Herramienta de diagnóstico para validar DNIs reales.

### 7. Administración

- **Directorio** (`/directorio`, admin/supervisor): pestañas por entidad, buscador, alta/edición/
  borrado online e importación CSV (archivo o pegado).
- **Usuarios** (`/usuarios`, admin): listado con estado activo/inactivo, alta, edición, baja lógica y
  reactivación.

> **Estado:** el rediseño mobile-first está implementado en las 7 pantallas + login. Sólo queda la
> **edición offline** del directorio (outbox), ver [`14-pendientes.md`](./14-pendientes.md).

## Estados y feedback

| Estado | UI |
| --- | --- |
| Escaneando | Marco + instrucción |
| Leyendo | Spinner breve |
| Leído | Confirmación sonora + formulario |
| No leído (5s) | Sugerir Foto / manual |
| Buscando | “Buscando…” bajo el campo |
| Sin resultados | Tarjeta con sugerencia |
| Guardando | Botón en carga |
| Guardado offline | “Guardado localmente, N pendientes” |
| Sincronizado | Check verde |
| Error de validación | Mensaje por campo |

## Accesibilidad

- Contraste alto y tipografía legible.
- Objetivos táctiles ≥ 44 px.
- Foco visible en todos los controles.
- La ficha se anuncia como `role="dialog"` y se cierra con el botón, el velo o `Escape`.
- Textos en español claro, sin jerga técnica.

## Wireframe (buscador)

```
┌────────────────────────────┐
│ Victorias · El Pare   ● En línea  ⟳ │
├────────────────────────────┤
│ Buscar                     │
│ ┌────────────────────────┐ │
│ │ ⌕  ricardo          ✕  │ │
│ └────────────────────────┘ │
│ 4 resultados               │
│ PERSONAS (2)               │
│ ┌────────────────────────┐ │
│ │ 👤 RICARDO PEREZ    ›  │ │
│ │ Lote 42 · 11-5555-5555 │ │
│ └────────────────────────┘ │
│ FAMILIARES (1)             │
│ VEHÍCULOS (1)              │
│ LOTES (0)                  │
├────────────────────────────┤
│  ⌕      ☰      ＋     ▦    ⋯ │
│ Buscar Visitas Nueva Panel Más │
└────────────────────────────┘
```

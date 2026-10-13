# 08 — UI / UX

La app se usa en dos contextos: **celular del guardia** (rápido, con una mano, a veces con guantes)
y **computadora de monitoreo** (vista de panel). El diseño prioriza velocidad y tolerancia a errores.

## Principios

- **Menos toques posibles.** Escanear y guardar debe ser casi automático.
- **Todo editable.** Los datos autocompletados se pueden corregir.
- **Nunca bloquea.** Si no lee el código, se completa a mano.
- **Estado de red siempre visible** (online / offline / pendientes por sincronizar).
- **Botones grandes**, alto contraste, pensado para uso rápido y con poca luz.

## Pantallas — Celular del guardia

### 1. Login

- Usuario, contraseña, botón "Ingresar".
- Recordar sesión en el dispositivo (para uso offline posterior).
- Mensajes de error claros.

### 2. Inicio

- Botón grande **INGRESO** y botón **EGRESO**.
- Acceso a **Buscar** (directorio) y **Visitas abiertas**.
- Indicador de conexión y cantidad de pendientes.

### 3. Escaneo

- Vista de cámara con marco guía.
- Instrucción: "Enfocá el código del DNI".
- Botón **Foto** (alta resolución) si el video no lee.
- Botón **Cargar a mano**.
- Al leer: feedback sonoro/háptico y pasa al formulario.

### 4. Formulario de visita

- **Autocompletado:** apellido, nombre, DNI, fecha de nacimiento, sexo (editables).
- **Patente:** campo de texto (mayúsculas). Si coincide con un vehículo del barrio, muestra de quién es.
- **Lote / destino:** campo con autocompletado por número.
- **Propietario:** buscador por nombre; al elegir, trae el lote.
- **Motivo** y **Acompañantes**.
- Botón **Guardar** (grande).
- Resultado: ingreso guardado local + estado de sincronización.

### 5. Egreso

- Lista de **visitas abiertas** (dentro del barrio) con búsqueda rápida.
- Tocar una para marcar salida, o volver a escanear.

### 6. Buscar en el directorio

- Pestañas: **Propietario**, **Lote**, **Patente**.
- Resultados con datos y vehículos asociados.

## Pantallas — Computadora de monitoreo

### Panel en vivo

- Tabla de ingresos en tiempo real (Socket.IO).
- Filtros: rango de fechas, lote, garita, estado (dentro/fuera).
- Búsqueda por DNI, nombre o patente.
- Resaltado de nuevos ingresos.

> **Estado (Fase 4):** implementado en el PWA como ruta **`/panel`** (`features/panel/`). Muestra las
> visitas abiertas de todos los puestos (fusiona lo local del dispositivo con lo que llega por
> `visita:creada`/`visita:actualizada`), indica el estado de la conexión y exporta **CSV** de las
> visitas abiertas. Faltan los filtros y el histórico con rango de fechas.

### Reportes (supervisor/admin)

- Exportación a CSV/Excel por rango de fechas.
- Conteos por lote, por garita, por hora.

### Administración (admin)

- ABM de usuarios.
- ABM de barrio, lotes, propietarios, familiares y vehículos.

## Estados y feedback

| Estado | UI |
| --- | --- |
| Escaneando | Marco + instrucción |
| Leyendo | Spinner breve |
| Leído | Confirmación sonora + formulario |
| No leído (5s) | Sugerir Foto / manual |
| Guardando | Botón en carga |
| Guardado offline | "Guardado localmente, N pendientes" |
| Sincronizado | Check verde |
| Error de validación | Mensaje por campo |

## Accesibilidad

- Contraste alto, tipografía grande.
- Objetivos táctiles ≥ 44 px.
- Textos en español claro, sin jerga técnica.

## Wireframe (formulario de visita)

```
┌────────────────────────────┐
│  ←  Ingreso                │
├────────────────────────────┤
│  DNI leído ✅ (QR)          │
│  Apellido:  [PEREZ      ]   │
│  Nombre:    [JUAN CARLOS]   │
│  DNI:       [30123456   ]   │
│  Nac.:      [1985-03-15 ]   │
├────────────────────────────┤
│  Patente:   [AB123CD    ]   │
│  Lote:      [42         ]   │
│  Propietario:[PEREZ, ANA ] 🔍│
│  Motivo:    [visita     ]   │
│  Acompaña:  [ 1         ]   │
├────────────────────────────┤
│        [ GUARDAR ]          │
└────────────────────────────┘
```

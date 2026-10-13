# 10 — Roadmap

Construcción por fases. Cada fase es usable/verificable por sí misma. El orden prioriza desbloquear
el problema real (el escaneo) cuanto antes.

## Fase 0 — Base del proyecto y Modo captura

- [x] Estructura del monorepo (`apps/web`, `apps/api`, `packages/shared`).
- [x] Configuración de TypeScript estricto, ESLint (sin `any`) y Prettier.
- [x] Documentación (este repo `docs/`).
- [x] Scaffolding de la API (Express + Mongoose + health check).
- [x] **Modo captura:** pantalla que muestra el payload crudo de un escaneo
      (cámara + modo foto + pegado manual), con interpretación del parser.
- [ ] Leer DNIs reales (viejo y nuevo) y fijar el parser. ← **pendiente de muestras reales**

**Entregable:** podemos ver exactamente qué trae cada código y queda documentado.

> Estado: el PWA (`apps/web`) ya tiene la pantalla **Modo captura** funcionando con
> `barcode-detector` (ZXing-WASM, con el `.wasm` servido localmente para offline) y
> el parser de `@victoriasapp/shared`. Falta cargar DNIs reales para cerrar el formato
> del QR del DNI electrónico.

## Fase 1 — Escáner + parser

- [x] Escaneo con `BarcodeDetector` + polyfill zxing-wasm.
- [x] Modo foto para PDF417.
- [x] `parseDni` completo (PDF417 viejo/intermedio, QR, MRZ).
- [x] Normalización (`NXX→Ñ`, fechas, sexo).
- [ ] Tests del parser con casos reales. ← **pendiente de muestras reales** (hoy hay tests con casos sintéticos)

**Entregable:** escaneamos un DNI y vemos los datos extraídos en pantalla.

> Estado: implementado en `apps/web` (pantalla **Modo captura** + escáner incrustado en el formulario) y
> `packages/shared/src/dni/`. Falta sólo el caso real del QR del DNI electrónico.

## Fase 2 — Registro de visita (offline)

- [x] Formulario de visita (autocompletado + patente + lote + motivo).
- [x] Persistencia en IndexedDB.
- [x] Cola `outbox`.
- [ ] Export a CSV local.

**Entregable:** el guardia registra ingresos sin internet.

> Estado: funcionando. `DatosService` (Dexie) guarda la visita y encola la operación en `outbox` en una
> sola transacción. La pantalla **Nueva visita** permite escanear el DNI o cargar a mano, autocompleta
> dueño/lote desde la patente o el lote, y la pantalla **Visitas** lista todo con su estado de sync y
> permite marcar la salida. El directorio cacheado se puede poblar con "Cargar datos de ejemplo" para
> probar sin API. Falta el export a CSV.

## Fase 3 — API + Mongo + sync + login

- [x] Endpoints de visitas y `/sync` idempotente.
- [x] Autenticación JWT (access + refresh), RBAC.
- [x] Alta del administrador por variables de entorno.
- [x] Sincronización desde el PWA.
- [~] Directorio de la API (queda para la Fase 4; `/api/visits` y `/api/users` ya existen).
- [~] Endurecimiento de seguridad (helmet, CORS, rate limit y validación Zod listos; faltan logs/retención).

**Entregable:** los registros llegan a Mongo y hay login.

> Estado: implementado. `apps/api` tiene `POST /api/auth/login|refresh|logout`, `GET /api/auth/me`
> (access token corto + refresh en cookie `httpOnly` con rotación), **RBAC** (`admin`/`supervisor`/`guardia`),
> `POST /api/sync` idempotente por `uuid`, `GET /api/visits`, `GET /api/visits/abiertas`,
> `POST /api/visits/:id/salida` y ABM de usuarios (sólo `admin`). El administrador se crea desde el
> entorno (`ADMIN_PASSWORD`, ver [seguridad](./06-seguridad.md)). El PWA sumó **pantalla de login**,
> guard de rutas, interceptor con `Bearer` + refresh automático y un **sincronizador** que vacía el
> outbox al recuperar conexión. Tests de integración con Mongo en memoria.

## Fase 4 — Directorio + panel en vivo

- [ ] ABM de barrio, lotes, propietarios, familiares y vehículos.
- [ ] Búsquedas (nombre / lote / patente) offline.
- [ ] Panel en la computadora con Socket.IO (tiempo real).
- [ ] Reportes y export desde el panel.
- [ ] Importador CSV del directorio.

**Entregable:** varios puestos comparten datos y el monitoreo es en vivo.

## Fase 5 — Pulido

- [ ] OCR de MRZ como respaldo (Tesseract.js).
- [ ] UX final, mensajes, accesibilidad.
- [ ] Pruebas de campo con guardias.
- [ ] Política de retención de datos.

**Entregable:** sistema listo para uso diario.

## Backlog (ideas futuras)

- App instalable (APK) con Capacitor.
- Lectura de patente por OCR.
- Notificaciones al propietario cuando llega una visita.
- Integración con barreras físicas.
- Mapa del barrio con lotes.

## Definición de "terminado" por fase

- Código tipado (sin `any`), lint en verde.
- Tests que cubren lo nuevo.
- Documentación actualizada.
- Probado en un celular real.

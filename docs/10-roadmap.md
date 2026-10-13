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

- [ ] Escaneo con `BarcodeDetector` + polyfill zxing-wasm.
- [ ] Modo foto para PDF417.
- [ ] `parseDni` completo (PDF417 viejo/intermedio, QR, MRZ).
- [ ] Normalización (`NXX→Ñ`, fechas, sexo).
- [ ] Tests del parser con casos reales.

**Entregable:** escaneamos un DNI y vemos los datos extraídos en pantalla.

## Fase 2 — Registro de visita (offline)

- [ ] Formulario de visita (autocompletado + patente + lote + motivo).
- [ ] Persistencia en IndexedDB.
- [ ] Cola `outbox`.
- [ ] Export a CSV local.

**Entregable:** el guardia registra ingresos sin internet.

## Fase 3 — API + Mongo + sync + login

- [ ] Endpoints de visitas y `/sync` idempotente.
- [ ] Autenticación JWT (access + refresh), RBAC.
- [ ] Directorio de la API.
- [ ] Sincronización desde el PWA.
- [ ] Endurecimiento de seguridad.

**Entregable:** los registros llegan a Mongo y hay login.

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

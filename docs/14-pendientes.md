# 14 — Pendientes

Lista viva de cosas a resolver. Se tachan cuando están hechas (o se mueven al
[roadmap](./10-roadmap.md)).

## 🔴 Bloqueantes de precisión

- [ ] **Cargar DNIs reales para cerrar el parser.**
      El formato del **QR del DNI electrónico nuevo** no está documentado oficialmente y el payload
      puede variar. Necesito **2–3 DNIs reales** (uno viejo con PDF417 en el reverso y uno nuevo con QR)
      escaneados con el **Modo captura** (`/captura` en el PWA) y pasarme el `raw` que aparece.
      Con eso:
      1. Ajusto `parseDni` (`packages/shared/src/dni/parse-dni.ts`) para el QR.
      2. Dejo **tests con casos reales** en `packages/shared`.
      3. Actualizo [`02-formatos-dni.md`](./02-formatos-dni.md) con el formato exacto.
      > Responsable de conseguir las muestras: usuario. Estado: **pendiente**.

- [ ] **Verificar el PDF417 del DNI viejo** con foto de alta resolución (Capa 3) en un celular real,
      porque en video en vivo suele leerse mal.

## 🟡 Deseables (no bloquean)

- [ ] **Export a CSV local** de las visitas (Fase 2, último ítem).
- [ ] **Lista de propietarios / lotes real del barrio** (Excel o carga por la app) para poblar el
      directorio. Mientras tanto, hay datos de ejemplo para probar (ver \"Datos de ejemplo\" abajo).
- [ ] Nombre definitivo del producto (hoy \"Victorias · El Pare\").

## 🟢 Hechas

- [x] Monorepo (`apps/web`, `apps/api`, `packages/shared`) + TS estricto + ESLint sin `any`.
- [x] Documentación (`docs/00`–`docs/13`).
- [x] API scaffolding (Express + health check).
- [x] PWA Angular con **Modo captura** (cámara, modo foto, pegado manual) y WASM offline.
- [x] **Fase 2 — registro de visita offline:** formulario con escáner de DNI incrustado,
      persistencia en IndexedDB (Dexie), cola `outbox` transaccional, autocompletado de dueño/lote
      por patente o lote, listado de visitas con estado de sync y marcado de salida.
- [x] Tests: parser + validación de visita (`shared`, 12) y flujo offline (`web`, 5).

---

## Datos de ejemplo

Para probar sin depender de la API, el PWA puede cargar un **directorio de ejemplo**
(propietarios, lotes y vehículos ficticios) desde la pantalla de Visitas. Estos datos son sólo para
desarrollo y se borran con "Limpiar datos".

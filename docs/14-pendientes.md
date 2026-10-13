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

- [ ] **Edición offline del directorio** (alta rápida desde la garita): encolar en el `outbox` y
      resolver conflictos al sincronizar. En esta fase el ABM es **online** (admin/supervisor).
- [x] **Export a CSV** desde el panel (`/panel`): visitas abiertas e **histórico completo** con
      filtros de texto, rango de fechas, estado (dentro/fuera) y lote.
- [ ] **Lista de propietarios / lotes real del barrio** (Excel o carga por la app) para poblar el
      directorio. Mientras tanto, hay datos de ejemplo para probar (ver "Datos de ejemplo" abajo).
- [ ] Probar el **panel en vivo con varios dispositivos** reales conectados (el canal está testeado a
      nivel API).
- [ ] Nombre definitivo del producto (hoy "Victorias · El Pare").

## 🟢 Hechas

- [x] Monorepo (`apps/web`, `apps/api`, `packages/shared`) + TS estricto + ESLint sin `any`.
- [x] Documentación (`docs/00`–`docs/13`).
- [x] API scaffolding (Express + health check).
- [x] PWA Angular con **Modo captura** (cámara, modo foto, pegado manual) y WASM offline.
- [x] **Fase 2 — registro de visita offline:** formulario con escáner de DNI incrustado,
      persistencia en IndexedDB (Dexie), cola `outbox` transaccional, autocompletado de dueño/lote
      por patente o lote, listado de visitas con estado de sync y marcado de salida.
- [x] **Fase 3 — API + login + sync:** JWT (access corto + refresh en cookie `httpOnly` con rotación),
      RBAC (`admin`/`supervisor`/`guardia`), **alta del administrador por variables de entorno**,
      `POST /api/sync` idempotente por `uuid`, endpoints de visitas y ABM de usuarios (admin).
      En el PWA: pantalla de **login**, guard de rutas, interceptor con `Bearer` + refresh automático
      y **sincronizador** que vacía el outbox al volver la red.
- [x] **Fase 4 (API + PWA) — directorio + tiempo real:** ABM de barrio/lotes/propietarios/familiares/
      vehículos, **pull incremental** `GET /api/directorio?desde=` con bajas (tombstones),
      **importador CSV**, canal **Socket.IO** (`/realtime`) con eventos `visita:creada`,
      `visita:actualizada` y `directorio:actualizado`. En el PWA: el sincronizador baja el directorio
      a IndexedDB, el **panel** (`/panel`) muestra las visitas abiertas de todos los puestos y el
      **histórico** filtrable (texto, fechas, estado, lote) con export CSV; la pantalla
      **`/directorio`** (sólo `admin`/`supervisor`) hace el ABM online del directorio (pestañas por
      entidad, buscador, alta/edición/borrado e importación CSV).
- [x] **Búsqueda difusa offline** en el directorio cacheado: autocompletado de lote, propietario y
      patente tolerante a tildes, prefijos y errores de tipeo.
- [x] Tests: parser + esquemas + CSV/nombre + búsqueda difusa (`shared`, 49), integración de la API
      con Mongo en memoria (`api`, 25) y flujo offline/sync + pull del directorio + ABM del
      directorio + histórico + búsqueda difusa en el PWA (`web`, 21).

---

## Datos de ejemplo

Para probar sin depender de la API, el PWA puede cargar un **directorio de ejemplo**
(propietarios, lotes y vehículos ficticios) desde la pantalla de Visitas. Estos datos son sólo para
desarrollo y se borran con "Limpiar datos".

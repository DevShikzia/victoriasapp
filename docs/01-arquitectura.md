# 01 — Arquitectura

## Vista general

```
┌──────────────────────────────┐            ┌──────────────────────────────┐
│  Celular del guardia         │            │  Computadora de monitoreo    │
│  Angular PWA (offline-first) │            │  Angular PWA (vista panel)   │
│                              │            │                              │
│  • Escáner (QR/PDF417/MRZ)   │            │  • Lista de ingresos en vivo │
│  • Formulario de visita      │            │  • Búsqueda y filtros        │
│  • IndexedDB (datos locales) │            │  • ABM de directorio/admin   │
└───────────┬──────────────────┘            └───────────┬──────────────────┘
            │                                           │
            │  HTTPS REST (sync)                        │  WebSocket (Socket.IO)
            │  ← cuando hay red →                       │  ← en vivo →
            ▼                                           ▼
      ┌───────────────────────────────────────────────────────┐
      │              API — Node.js + TypeScript               │
      │              Express + Mongoose + Socket.IO           │
      │  • Auth (JWT)   • Visitas   • Directorio   • Sync      │
      └───────────────────────────┬───────────────────────────┘
                                  │
                                  ▼
                         ┌─────────────────┐
                         │    MongoDB      │
                         └─────────────────┘
```

## Componentes

### 1. PWA (`apps/web`)

Aplicación Angular con service worker. Es el cliente que corre en el celular del guardia y también
la vista de panel en la computadora. Responsabilidades:

- Escaneo de códigos con la cámara.
- Parseo del DNI con el paquete `shared`.
- Formulario de registro y búsqueda en el directorio.
- Persistencia local en IndexedDB (funciona sin red).
- Cola de sincronización (outbox) y cliente Socket.IO para el panel.

### 2. API (`apps/api`)

Servidor Node + TypeScript. Responsabilidades:

- Autenticación y autorización (JWT + roles).
- CRUD de visitas, directorio y usuarios.
- Endpoint de sincronización idempotente por `uuid`.
- Emisión de eventos en tiempo real por Socket.IO.
- Validación de entrada con esquemas compartidos.

### 3. Paquete `shared` (`packages/shared`)

Código reutilizado por front y back, sin dependencias de entorno:

- Tipos e interfaces del dominio.
- Esquemas de validación (Zod).
- Parser de DNI (`parseDni`).
- Utilidades de normalización (fechas, sexo, `NXX→Ñ`).

### 4. MongoDB

Base de datos central. Colecciones principales descritas en
[modelo de datos](./04-modelo-de-datos.md).

## Flujo de datos (ingreso de un visitante)

1. El guardia abre la PWA y toca **Ingreso**.
2. La cámara lee el código del DNI. La PWA lo parsea con `shared`.
3. Se autocompletan los datos y el guardia completa el resto.
4. Al guardar, el registro entra en **IndexedDB** y en la **cola de sincronización**.
5. El service worker / la app intenta sincronizar:
   - Hay red → `POST /api/sync` envía los pendientes.
   - No hay red → queda en cola y se reintenta automáticamente.
6. La API hace *upsert* idempotente y guarda en Mongo.
7. La API emite `visit:created` por Socket.IO y el panel se actualiza en vivo.

## Decisiones de diseño

| Decisión | Motivo |
| --- | --- |
| Offline-first con IndexedDB | La red en la garita no es confiable; no se puede perder un registro. |
| Sync por `uuid` generado en el cliente | Idempotencia: reintentar no duplica registros. |
| Parser en `packages/shared` | Mismas reglas en pruebas y en ambos lados. |
| Socket.IO para el panel | Actualización inmediata sin polling. |
| Monorepo con workspaces npm | Un solo repo, tipos compartidos, builds consistentes. |

## Entornos

| Entorno | Frontend | API | Base de datos |
| --- | --- | --- | --- |
| Local | `ng serve` (localhost) | `npm run dev` (tsx watch) | Docker Mongo |
| Producción | Build estático servido por HTTPS | Proceso Node detrás de proxy | MongoDB gestionado |

Detalle de despliegue en [git y deploy](./12-git-y-deploy.md).

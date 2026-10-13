# 06 — Seguridad

Objetivo: un login sólido, validado en front **y** back, con token, y sin superficies fáciles de
atacar. El DNI es un dato sensible (Ley 25.326), así que se protege el acceso y se guarda lo mínimo.

## Contraseñas

- Hash con **bcrypt** (cost ≥ 12) o **argon2id**.
- Nunca se guarda ni se loguea la contraseña en texto plano.
- Requisitos mínimos: 8+ caracteres, sin ser trivial. Se valida en front y back con el mismo esquema.
- `passwordHash` y `refreshTokenHash` **jamás** se devuelven en las respuestas.

## Autenticación (JWT)

Modelo de dos tokens:

| Token | Vida | Dónde vive | Uso |
| --- | --- | --- | --- |
| **Access** | 15 min | En memoria del cliente | Autorizar cada request (`Authorization: Bearer`). |
| **Refresh** | 7–30 días | Cookie `httpOnly`, `Secure`, `SameSite=Strict` | Renovar el access token. |

- El refresh token se guarda **hasheado** en el servidor (`refreshTokenHash`) para poder revocarlo.
- `logout` invalida el refresh token.
- Rotación de refresh token en cada renovación (detecta reutilización).

## Offline y sesión

Como la app es offline-first, el guardia inicia sesión **una vez con red**. Después:

- La app sigue operando offline con el último access token y una **sesión local cacheada**.
- Al volver la red, se renueva el token y se sincroniza.
- Los registros creados offline se asocian al usuario de la sesión local.
- Un access token vencido **no borra** los registros pendientes: quedan en el outbox.

## Autorización (RBAC)

| Acción | guardia | supervisor | admin |
| --- | --- | --- | --- |
| Registrar ingreso/egreso | ✅ | ✅ | ✅ |
| Buscar directorio | ✅ | ✅ | ✅ |
| Corregir visitas | ❌ | ✅ | ✅ |
| ABM directorio | ❌ | ✅ | ✅ |
| ABM usuarios | ❌ | ❌ | ✅ |

Enforcement en el backend por middleware; el front sólo oculta opciones (la verdad está en el back).

## Validación

- **Front:** Reactive Forms con validadores.
- **Back:** cada endpoint valida el body/query con un esquema **Zod** definido en `packages/shared`.
- Rechazar propiedades no esperadas (`.strict()` cuando corresponda).
- Trim y normalización (mayúsculas en patente, etc.) antes de validar.

## Endurecimiento del backend

- `helmet` (headers de seguridad).
- **CORS** con lista blanca de orígenes (no `*`).
- **Rate limiting** en `/api/auth/*` y global (por IP).
- Sanitización contra **NoSQL injection** (no concatenar objetos del body en queries; validar tipos).
- Límite de tamaño de body (`express.json({ limit: '100kb' })`).
- Logs sin datos sensibles (ocultar DNI/patente en logs de producción).
- Sin stack traces en producción.
- Secretos (JWT, cadena de Mongo) por **variables de entorno**, nunca en el repo.
- HTTPS obligatorio (requerido además para la cámara del PWA).

## Auditoría

- Cada login y cada cambio relevante escribe en `auditLogs` (quién, qué, cuándo, IP).
- Los cambios de visitas guardan `userId`.

## Privacidad y retención

- Guardar sólo lo necesario para el control de acceso.
- El `documentoRaw` (payload del código) es opcional y puede desactivarse; sirve para auditoría.
- Política de retención configurable (por ejemplo, purgar visitas de más de N meses).
- Acceso restringido por rol.

## Amenazas consideradas

| Amenaza | Mitigación |
| --- | --- |
| Fuerza bruta al login | Rate limit + bloqueo temporal |
| Robo de token | Access corto + refresh httpOnly + rotación |
| XSS en el PWA | Angular escapa por defecto; evitar `innerHTML` con datos del usuario |
| NoSQL injection | Validación Zod + no pasar objetos crudos a Mongoose |
| Filtración de datos por rol | RBAC en el backend |
| Sniffing | HTTPS obligatorio |

## Checklist antes de producción

- [ ] Secretos en variables de entorno.
- [ ] CORS restringido al dominio real.
- [ ] Rate limiting activo.
- [ ] HTTPS con certificado válido.
- [ ] bcrypt/argon2 con cost adecuado.
- [ ] Logs sin datos sensibles.
- [ ] Revisión de permisos por rol.

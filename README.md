# victoriasapp

Sistema de control de accesos para barrios cerrados. Permite a los guardias escanear el DNI
de los visitantes (QR, PDF417 y MRZ) para autocompletar los datos y registrar el ingreso/egreso
sin tener que anotar todo a mano.

- **Frontend:** Angular (PWA, offline-first)
- **Backend:** Node.js + TypeScript + Express + Mongoose (MongoDB)
- **Tiempo real:** Socket.IO
- **Paquete compartido:** tipos, validaciones y parser de DNI

## El problema

En la garita, al llegar un visitante, el guardia pide el DNI. Los lectores comerciales fallan
en dos formatos de DNI argentino:

1. El **DNI tarjeta viejo**, que trae un código **PDF417** grande en el reverso.
2. El **DNI electrónico nuevo**, que trae un **código QR** en el frente (y una zona MRZ).

Como el escaneo falla, el guardia termina anotando **todo en papel**: nombre, apellido, DNI,
patente y lote de destino. Esta app resuelve ese problema leyendo esos códigos y autocompletando
el formulario.

## Documentación

Toda la documentación vive en [`docs/`](./docs). Empezá por el índice: [`docs/README.md`](./docs/README.md).

| Documento | Tema |
| --- | --- |
| [00 - Visión general](./docs/00-vision-general.md) | Problema, objetivo, alcance, roles |
| [01 - Arquitectura](./docs/01-arquitectura.md) | Componentes y flujo de datos |
| [02 - Formatos de DNI](./docs/02-formatos-dni.md) | PDF417, QR, MRZ, parser |
| [03 - Escaneo](./docs/03-escaneo.md) | Librerías y capas de lectura |
| [04 - Modelo de datos](./docs/04-modelo-de-datos.md) | Colecciones y esquemas |
| [05 - API REST](./docs/05-api-rest.md) | Endpoints y contratos |
| [06 - Seguridad](./docs/06-seguridad.md) | Login, JWT, validación |
| [07 - Offline y sincronización](./docs/07-offline-y-sincronizacion.md) | IndexedDB, outbox, sync |
| [08 - UI/UX](./docs/08-ui-ux.md) | Pantallas y flujos |
| [09 - Directorio del barrio](./docs/09-directorio-barrio.md) | Propietarios, lotes, vehículos |
| [10 - Roadmap](./docs/10-roadmap.md) | Fases de construcción |
| [11 - Convenciones de código](./docs/11-convenciones-de-codigo.md) | TypeScript estricto, sin `any` |
| [12 - Git y deploy](./docs/12-git-y-deploy.md) | Ramas, commits, despliegue |
| [13 - Testing](./docs/13-testing.md) | Estrategia de pruebas |

## Estructura del repositorio

```
victoriasapp/
├─ apps/
│  ├─ web/        # Angular PWA (escáner + formulario + panel)
│  └─ api/        # Node + TypeScript + Express + Mongoose
├─ packages/
│  └─ shared/     # Tipos, validaciones y parser de DNI (front y back)
├─ docs/          # Documentación funcional y técnica
├─ docker-compose.yml
└─ package.json   # Workspaces (npm)
```

## Estado

🚧 En construcción. Ver el [roadmap](./docs/10-roadmap.md).

## Puesta en marcha (desarrollo)

```bash
# Requisitos: Node LTS (ver .nvmrc), Docker (para Mongo), Angular CLI
npm install

# Levantar Mongo + API
docker compose up -d mongo
npm run dev -w apps/api

# Levantar el PWA
npm run start -w apps/web
```

> La PWA necesita **HTTPS** para acceder a la cámara desde el celular (salvo en `localhost`).
> Ver [deploy](./docs/12-git-y-deploy.md).

## Privacidad

El DNI es un dato sensible (Ley 25.326). El sistema guarda únicamente lo necesario para el
control de acceso, con acceso autenticado y política de retención. Ver
[seguridad](./docs/06-seguridad.md).

## Licencia

Privado. Todos los derechos reservados.

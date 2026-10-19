# Documentación — victoriasapp

Índice de la documentación del proyecto. Los documentos están numerados en el orden recomendado
de lectura.

## Funcional

| # | Documento | Descripción |
| --- | --- | --- |
| 00 | [Visión general](./00-vision-general.md) | Problema, objetivo, alcance, roles y casos de uso. |
| 08 | [UI/UX](./08-ui-ux.md) | Pantallas, flujos y estados de la interfaz. |
| 09 | [Directorio del barrio](./09-directorio-barrio.md) | Barrio, lotes, propietarios, familia y vehículos. |
| 10 | [Roadmap](./10-roadmap.md) | Fases de construcción y checklist. |
| 15 | [Buscador global y rediseño mobile-first](./15-buscador-global-y-rediseno-mobile.md) | Búsqueda única offline, navegación móvil y sistema de diseño. |

## Técnico

| # | Documento | Descripción |
| --- | --- | --- |
| 01 | [Arquitectura](./01-arquitectura.md) | Componentes, stack y flujo de datos. |
| 02 | [Formatos de DNI](./02-formatos-dni.md) | PDF417, QR, MRZ y reglas del parser. |
| 03 | [Escaneo](./03-escaneo.md) | Capas de lectura y librerías. |
| 04 | [Modelo de datos](./04-modelo-de-datos.md) | Colecciones, esquemas e índices. |
| 05 | [API REST](./05-api-rest.md) | Endpoints, contratos y errores. |
| 06 | [Seguridad](./06-seguridad.md) | Autenticación, autorización y endurecimiento. |
| 07 | [Offline y sincronización](./07-offline-y-sincronizacion.md) | IndexedDB, outbox y resolución de conflictos. |

## Proceso

| # | Documento | Descripción |
| --- | --- | --- |
| 11 | [Convenciones de código](./11-convenciones-de-codigo.md) | Reglas TypeScript, lint y estilo. |
| 12 | [Git y deploy](./12-git-y-deploy.md) | Ramas, commits, entornos y despliegue. |
| 13 | [Testing](./13-testing.md) | Estrategia de pruebas. |
| 14 | [Pendientes](./14-pendientes.md) | TODO vivo: qué falta y qué está bloqueado. |

## Glosario

- **DNI:** Documento Nacional de Identidad argentino.
- **PDF417:** código de barras 2D apilado, usado en el DNI tarjeta.
- **MRZ:** *Machine Readable Zone*, zona de lectura mecánica (estándar ICAO 9303).
- **PWA:** *Progressive Web App*.
- **Outbox:** cola local de cambios pendientes de sincronizar.
- **Lote:** unidad de terreno/parcela dentro del barrio cerrado.

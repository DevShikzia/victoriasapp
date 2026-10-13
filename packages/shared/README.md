# @victoriasapp/shared

Paquete compartido entre el frontend (PWA Angular) y el backend (API). Contiene:

- **Tipos del dominio** (`src/types`).
- **Esquemas de validación Zod** (`src/schemas`) — mismos en front y back.
- **Parser de DNI** (`src/dni`) y utilidades de normalización.

## Reglas

- TypeScript **estricto**, sin `any` (ver [convenciones](../../docs/11-convenciones-de-codigo.md)).
- Sin dependencias de entorno (no usa DOM ni Node). Sólo lógica pura.
- Cada cambio de comportamiento debe venir con tests.

## Uso

```ts
import { parseDni, type DniData } from '@victoriasapp/shared';

const resultado = parseDni(payloadCrudo);
if (resultado.ok && resultado.data) {
  console.log(resultado.data.apellido);
}
```

## Build

```bash
npm run build -w @victoriasapp/shared
```

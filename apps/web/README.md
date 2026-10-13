# @victoriasapp/web

PWA Angular del proyecto: escáner de DNI, formulario de visitas y panel de monitoreo.

> **Estado:** esta carpeta se generará con Angular CLI (`ng new`) durante la Fase 0/1
> para que la configuración de Angular quede 100% estándar. Ver
> [roadmap](../../docs/10-roadmap.md).

## Reglas

- TypeScript **estricto**, sin `any` (ver [convenciones](../../docs/11-convenciones-de-codigo.md)).
- Componentes standalone, `OnPush`.
- Lógica de parseo siempre desde `@victoriasapp/shared` (nunca duplicada).

## Generación prevista

```bash
# dentro de apps/
npx @angular/cli@latest new web --style=scss --routing --ssr=false --standalone
```

Luego se agregan:

- `@angular/pwa` (service worker + manifest).
- Cliente de escaneo (`barcode-detector` / `zxing-wasm`).
- IndexedDB (`dexie` o `idb`).
- `socket.io-client`.

## Pantallas

Ver [docs/08-ui-ux.md](../../docs/08-ui-ux.md).

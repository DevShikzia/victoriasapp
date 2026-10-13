# @victoriasapp/web — PWA del guardia

Cliente Angular 20 (PWA, standalone) del sistema de control de acceso. Por ahora contiene el
**Modo captura** (herramienta de diagnóstico del escaneo de DNI). Ver
[`docs/03-escaneo.md`](../../docs/03-escaneo.md) y [`docs/08-ui-ux.md`](../../docs/08-ui-ux.md).

## Requisitos

- Node.js 22 (ver `.nvmrc` en la raíz).
- Dependencias instaladas **desde la raíz** del monorepo (`npm install`), no desde esta carpeta.

## Comandos

Desde la raíz del repo (recomendado):

```bash
npm run dev:web          # ng serve en http://localhost:4200
npm run build -w @victoriasapp/web
```

O dentro de `apps/web`:

```bash
npm start                # ng serve
npm run build            # build de producción (dist/web)
npm run typecheck        # tsc --noEmit
```

`prestart` y `prebuild` copian el WASM de ZXing a `public/zxing/` automáticamente.

## Notas

- **Cámara:** requiere contexto seguro. Funciona en `localhost`; en un celular hay que servir la app
  por **HTTPS**.
- **WASM offline:** `scripts/copy-zxing-wasm.mjs` copia `zxing_reader.wasm` a `public/zxing/`
  (ignorado en git). Se sirve desde el propio origen y se precachea con el service worker.
- **Parser:** la lógica de DNI vive en `@victoriasapp/shared`, no acá.
- **Sin `any`:** TypeScript estricto + ESLint (reglas en `eslint.config.mjs` de la raíz).

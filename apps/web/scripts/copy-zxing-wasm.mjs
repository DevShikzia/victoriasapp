/**
 * Copia el WASM de ZXing a `public/zxing` para que el PWA lo sirva desde su
 * propio origen y el escaneo funcione sin internet (requisito offline-first).
 *
 * Se ejecuta en `postinstall` / `prebuild` / `prestart` (ver package.json).
 * El archivo copiado NO se versiona (está en .gitignore).
 */
import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const aqui = dirname(fileURLToPath(import.meta.url));
const destinoDir = join(aqui, '..', 'public', 'zxing');
const destino = join(destinoDir, 'zxing_reader.wasm');

const origen = require.resolve('zxing-wasm/reader/zxing_reader.wasm');

mkdirSync(destinoDir, { recursive: true });
copyFileSync(origen, destino);

const kb = Math.round(statSync(destino).size / 1024);
console.log(`[zxing] wasm copiado a public/zxing/zxing_reader.wasm (${kb} KiB)`);

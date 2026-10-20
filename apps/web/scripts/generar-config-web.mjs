import { writeFileSync } from 'node:fs';

const destino = new URL('../public/config.js', import.meta.url);
const valor = (process.env.MATIAPP_API_URL ?? '').trim().replace(/\/+$/, '');

if (valor !== '') {
  let url;
  try {
    url = new URL(valor);
  } catch {
    console.error(`[config] MATIAPP_API_URL no es una URL válida: "${valor}"`);
    process.exit(1);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    console.error('[config] MATIAPP_API_URL debe empezar con https:// (o http:// en local).');
    process.exit(1);
  }
}

if (process.env.NETLIFY === 'true' && valor === '') {
  console.error(
    '[config] Falta MATIAPP_API_URL en Netlify. Configurala con la URL pública de la API.',
  );
  process.exit(1);
}

const contenido = `globalThis.__MATIAPP_CONFIG__ = ${JSON.stringify({ apiBaseUrl: valor })};\n`;
writeFileSync(destino, contenido, 'utf8');
console.warn(`[config] apiBaseUrl: ${valor === '' ? 'mismo origen' : valor}`);

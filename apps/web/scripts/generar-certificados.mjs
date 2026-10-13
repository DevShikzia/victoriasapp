/**
 * Genera un certificado TLS local (con mkcert) que incluye las IPs de la PC en
 * la red, para poder abrir el PWA desde el celular por HTTPS. La cámara del
 * navegador exige un contexto seguro (HTTPS o localhost).
 *
 * Uso: `npm run certs -w @victoriasapp/web` (o `npm run certs` desde la raíz).
 * Después: `npm run dev:web:https` (o `npm run start:https -w @victoriasapp/web`).
 *
 * Ver docs/12-git-y-deploy.md.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const carpeta = resolve(aqui, '..', 'certs');
const cert = resolve(carpeta, 'cert.pem');
const key = resolve(carpeta, 'key.pem');

/** IPs IPv4 no internas de la máquina. */
function ipsLocales() {
  const ips = new Set();
  for (const datos of Object.values(networkInterfaces())) {
    for (const dato of datos ?? []) {
      if (dato.family === 'IPv4' && !dato.internal) {
        ips.add(dato.address);
      }
    }
  }
  return [...ips];
}

function correr(comando, args) {
  execFileSync(comando, args, { stdio: 'inherit' });
}

function existeMkcert() {
  try {
    execFileSync('mkcert', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!existeMkcert()) {
  console.error('[certs] No se encontró `mkcert` en el PATH.');
  console.error('  Instalalo y volvé a intentar, por ejemplo:');
  console.error('    winget install FiloSottile.mkcert');
  console.error('    choco install mkcert');
  process.exit(1);
}

const ips = ipsLocales();
if (ips.length === 0) {
  console.error('[certs] No se encontró ninguna IP de red local (¿estás conectado a una red?).');
  process.exit(1);
}

const nombres = ['localhost', '127.0.0.1', ...ips];
console.log(`[certs] Generando certificado para: ${nombres.join(', ')}`);

correr('mkcert', ['-install']);
mkdirSync(carpeta, { recursive: true });
correr('mkcert', ['-cert-file', cert, '-key-file', key, ...nombres]);

let raiz = '';
try {
  raiz = execFileSync('mkcert', ['-CAROOT'], { encoding: 'utf8' }).trim();
} catch {
  raiz = '';
}

console.log('\n[certs] Listo.');
console.log(`  cert: ${cert}`);
console.log(`  key:  ${key}`);
console.log('\nPara que el celular confíe en el certificado, instalá la CA raíz de mkcert:');
if (raiz !== '') {
  console.log(`  ${resolve(raiz, 'rootCA.pem')}`);
}
console.log(
  '  - Android: Ajustes > Seguridad > Cifrado y credenciales > Instalar certificado > CA.',
);
console.log('  - iOS: compartí el .pem, perfil > Instalar, y luego Ajustes > General >');
console.log('    Información > Ajustes de certificados > habilitar la CA de mkcert.');
console.log('\nLuego levantá el PWA por HTTPS:');
console.log('  npm run dev:web:https        # desde la raíz');
console.log('  y abrí https://<IP-de-la-PC>:4200 en el celular.');

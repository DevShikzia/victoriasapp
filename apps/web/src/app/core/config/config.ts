/**
 * Configuración del front.
 *
 * `apiBaseUrl` puede venir de `public/config.js` (lo escribe el build de
 * despliegue) o, si está vacío, usa el mismo origen que sirve el PWA:
 *
 * - En desarrollo, el dev server de Angular hace de proxy hacia la API
 *   (`apps/web/proxy.conf.json`), así el celular habla siempre con el mismo
 *   host y no hay que configurar CORS ni recompilar al cambiar de IP.
 * - En producción con Netlify + Render, `config.js` contiene la URL absoluta
 *   de la API (por ejemplo, `https://matiapp-api.onrender.com`).
 */
interface ConfiguracionGlobal {
  readonly apiBaseUrl?: unknown;
}

interface VentanaConConfig {
  readonly __MATIAPP_CONFIG__?: ConfiguracionGlobal;
}

function resolverApiBaseUrl(): string {
  const configuracion = (globalThis as VentanaConConfig).__MATIAPP_CONFIG__;
  if (typeof configuracion?.apiBaseUrl === 'string' && configuracion.apiBaseUrl.trim() !== '') {
    return configuracion.apiBaseUrl.trim().replace(/\/+$/, '');
  }
  return window.location.origin;
}

export const CONFIG = {
  apiBaseUrl: resolverApiBaseUrl(),
} as const;

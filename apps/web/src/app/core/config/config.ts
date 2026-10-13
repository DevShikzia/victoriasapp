/**
 * Configuración del front.
 *
 * `apiBaseUrl` es **el mismo origen** que sirve el PWA:
 *
 * - En desarrollo, el dev server de Angular hace de proxy hacia la API
 *   (`apps/web/proxy.conf.json`), así el celular habla siempre con el mismo
 *   host y no hay que configurar CORS ni recompilar al cambiar de IP.
 * - En producción conviene servir el PWA y la API detrás del mismo dominio
 *   (con un reverse proxy) para que la cookie de refresh viaje como *same-site*.
 *
 * Usar `window.location.origin` (y no una URL fija) permite abrir la app desde
 * la PC (`localhost`) o desde otro dispositivo de la red sin tocar el código.
 */
export const CONFIG = {
  apiBaseUrl: window.location.origin,
} as const;

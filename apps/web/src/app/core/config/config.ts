/**
 * Configuración del front.
 *
 * `apiBaseUrl` apunta a la API. En producción conviene servir el PWA y la API
 * detrás del mismo dominio (por ejemplo con un reverse proxy) para que la
 * cookie de refresh viaje como *same-site*.
 */
export const CONFIG = {
  apiBaseUrl: 'http://localhost:3000',
} as const;

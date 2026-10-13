/**
 * Aumenta el tipo de `Request` de Express con el usuario autenticado.
 * Vive en un `.d.ts` para poder declarar el namespace global.
 */
import type { UsuarioPublico } from '@victoriasapp/shared';

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioPublico;
    }
  }
}

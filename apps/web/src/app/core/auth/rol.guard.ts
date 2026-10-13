import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import type { RolUsuario } from '@victoriasapp/shared';

import { SesionService } from './sesion.service';

/**
 * Deja pasar sólo a los roles indicados. Si no hay sesión o el rol no alcanza,
 * redirige a `/visitas` (la pantalla base para cualquier usuario).
 */
export function requiereRol(...roles: readonly RolUsuario[]): CanActivateFn {
  return async () => {
    const sesion = inject(SesionService);
    const router = inject(Router);

    if (!sesion.listo()) {
      await sesion.inicializar();
    }
    const usuario = sesion.usuario();
    if (usuario !== null && roles.includes(usuario.rol)) {
      return true;
    }
    return router.createUrlTree(['/visitas']);
  };
}

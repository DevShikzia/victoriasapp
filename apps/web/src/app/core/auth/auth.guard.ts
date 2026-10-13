import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { SesionService } from './sesion.service';

/** Deja pasar sólo con sesión iniciada; si no, redirige a `/login`. */
export const authGuard: CanActivateFn = async () => {
  const sesion = inject(SesionService);
  const router = inject(Router);

  if (!sesion.listo()) {
    await sesion.inicializar();
  }
  if (sesion.autenticado()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

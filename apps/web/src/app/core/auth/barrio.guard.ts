import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';

import { SesionService } from './sesion.service';

/**
 * Exige que la cuenta tenga un barrio activo. Si todavía no lo eligió, manda a
 * la pantalla de selección. Se usa después de `authGuard`.
 */
export const barrioGuard: CanActivateFn = async () => {
  const sesion = inject(SesionService);
  const router = inject(Router);

  if (!sesion.listo()) {
    await sesion.inicializar();
  }
  if (!sesion.autenticado()) {
    return router.createUrlTree(['/login']);
  }
  if (sesion.barrioId() === null) {
    return router.createUrlTree(['/barrio']);
  }
  return true;
};

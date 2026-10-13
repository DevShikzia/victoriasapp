import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { CONFIG } from '../config/config';
import { SesionService } from './sesion.service';

/**
 * Agrega el `Authorization: Bearer` a las llamadas a la API y, ante un 401,
 * intenta renovar el access token una vez y reintenta la petición.
 */
export const authInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  const esApi = peticion.url.startsWith(CONFIG.apiBaseUrl);
  const esAuth = peticion.url.includes('/api/auth/');

  if (!esApi) {
    return siguiente(peticion);
  }

  const token = sesion.token();
  const conToken = peticion.clone({
    withCredentials: true,
    setHeaders: token === null ? {} : { Authorization: `Bearer ${token}` },
  });

  return siguiente(conToken).pipe(
    catchError((error: unknown) => {
      if (esAuth || !(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }
      return from(sesion.renovar()).pipe(
        switchMap((renovado) => {
          if (!renovado) {
            void router.navigate(['/login']);
            return throwError(() => error);
          }
          const nuevoToken = sesion.token();
          const reintento = peticion.clone({
            withCredentials: true,
            setHeaders: nuevoToken === null ? {} : { Authorization: `Bearer ${nuevoToken}` },
          });
          return siguiente(reintento);
        }),
      );
    }),
  );
};

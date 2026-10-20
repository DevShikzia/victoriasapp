import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';

import { CONFIG } from '../config/config';
import { SesionService } from './sesion.service';

/**
 * Detecta la respuesta de la API cuando la cuenta todavía no tiene barrio.
 * El cliente no debe reintentar la petición: primero hay que elegirlo.
 */
function faltaBarrio(error: HttpErrorResponse): boolean {
  if (error.status !== 400) {
    return false;
  }
  const cuerpo: unknown = error.error;
  if (typeof cuerpo !== 'object' || cuerpo === null) {
    return false;
  }
  const detalle = (cuerpo as { readonly error?: { readonly code?: unknown } }).error;
  return detalle?.code === 'BARRIO_REQUERIDO';
}

/**
 * Agrega el `Authorization: Bearer` a las llamadas a la API y, ante un 401,
 * intenta renovar el access token una vez y reintenta la petición.
 */
export const authInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const sesion = inject(SesionService);
  const router = inject(Router);
  const esApi = peticion.url.startsWith(CONFIG.apiBaseUrl);
  // Login, refresh y logout no se reintentan: el refresh se está haciendo o la
  // sesión se está cerrando. El resto de `/api/auth/*` (barrios, me) sí puede
  // renovar el access token si venció.
  const esAuthSinRenovar =
    peticion.url.endsWith('/api/auth/login') ||
    peticion.url.endsWith('/api/auth/refresh') ||
    peticion.url.endsWith('/api/auth/logout');

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
      if (!esAuthSinRenovar && error instanceof HttpErrorResponse && faltaBarrio(error)) {
        // Si el token quedó viejo pero la cuenta ya tiene barrio, una renovación
        // lo corrige. Si no tiene barrio, se va directo a elegirlo.
        if (sesion.barrioId() === null) {
          void router.navigate(['/barrio']);
          return throwError(() => error);
        }
        return from(sesion.renovar()).pipe(
          switchMap((renovado) => {
            if (!renovado) {
              void router.navigate(['/login']);
              return throwError(() => error);
            }
            if (sesion.barrioId() === null) {
              void router.navigate(['/barrio']);
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
      }
      if (esAuthSinRenovar || !(error instanceof HttpErrorResponse) || error.status !== 401) {
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

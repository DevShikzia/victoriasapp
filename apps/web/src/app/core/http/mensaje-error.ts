import { HttpErrorResponse } from '@angular/common/http';

interface CuerpoError {
  readonly error?: { readonly message?: unknown };
}

/** Traduce un error HTTP a un mensaje mostrable al usuario. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const cuerpo: unknown = error.error;
    if (typeof cuerpo === 'object' && cuerpo !== null) {
      const detalle = (cuerpo as CuerpoError).error;
      if (detalle !== undefined && typeof detalle.message === 'string' && detalle.message !== '') {
        return detalle.message;
      }
    }
    if (error.status === 0) {
      return 'No hay conexión con el servidor.';
    }
    return `Error ${String(error.status)}`;
  }
  return 'Ocurrió un error inesperado.';
}

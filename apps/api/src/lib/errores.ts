/** Códigos de error de la API (ver docs/05-api-rest.md). */
export const CODIGOS_ERROR = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL',
] as const;

export type CodigoError = (typeof CODIGOS_ERROR)[number];

export interface DetalleError {
  readonly campo: string;
  readonly mensaje: string;
}

/** Error esperado con estado HTTP y código de negocio. */
export class ErrorHttp extends Error {
  readonly estado: number;
  readonly codigo: CodigoError;
  readonly detalles: readonly DetalleError[] | undefined;

  constructor(
    estado: number,
    codigo: CodigoError,
    mensaje: string,
    detalles?: readonly DetalleError[],
  ) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export function errorValidacion(mensaje: string, detalles?: readonly DetalleError[]): ErrorHttp {
  return new ErrorHttp(400, 'VALIDATION_ERROR', mensaje, detalles);
}

export function errorNoAutorizado(mensaje = 'No autenticado'): ErrorHttp {
  return new ErrorHttp(401, 'UNAUTHORIZED', mensaje);
}

export function errorProhibido(mensaje = 'Sin permisos para esta acción'): ErrorHttp {
  return new ErrorHttp(403, 'FORBIDDEN', mensaje);
}

export function errorNoEncontrado(mensaje = 'Recurso no encontrado'): ErrorHttp {
  return new ErrorHttp(404, 'NOT_FOUND', mensaje);
}

export function errorConflicto(mensaje: string): ErrorHttp {
  return new ErrorHttp(409, 'CONFLICT', mensaje);
}

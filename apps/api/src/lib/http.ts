import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import { Types } from 'mongoose';
import type { output, ZodTypeAny } from 'zod';

import type { Env } from '../config/env.js';
import { ErrorHttp, errorValidacion, type CodigoError, type DetalleError } from './errores.js';

/** Respuesta exitosa uniforme. */
export function respuestaOk(res: Response, data: unknown, estado = 200): void {
  res.status(estado).json({ ok: true, data });
}

/** Respuesta de error uniforme. */
export function respuestaError(
  res: Response,
  estado: number,
  codigo: CodigoError,
  message: string,
  detalles?: readonly DetalleError[],
): void {
  const error: Record<string, unknown> = { code: codigo, message };
  if (detalles !== undefined && detalles.length > 0) {
    error.detalles = detalles;
  }
  res.status(estado).json({ ok: false, error });
}

/** Valida `valor` contra un esquema Zod; lanza `VALIDATION_ERROR` si falla. */
export function validar<T extends ZodTypeAny>(
  esquema: T,
  valor: unknown,
  mensaje = 'Datos inválidos',
): output<T> {
  const resultado = esquema.safeParse(valor);
  if (!resultado.success) {
    const detalles = resultado.error.issues.map((issue) => ({
      campo: issue.path.join('.') === '' ? '(raíz)' : issue.path.join('.'),
      mensaje: issue.message,
    }));
    throw errorValidacion(mensaje, detalles);
  }
  return resultado.data as output<T>;
}

/** Envuelve un handler async para que los errores lleguen a Express. */
export function asincrono(
  manejador: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    void manejador(req, res, next).catch(next);
  };
}

/** Lee un parámetro de ruta validando que sea un ObjectId. */
export function paramId(req: Request, nombre = 'id'): string {
  const valor = req.params[nombre];
  if (valor === undefined || !Types.ObjectId.isValid(valor)) {
    throw errorValidacion('Identificador inválido', [
      { campo: nombre, mensaje: 'No es un identificador válido' },
    ]);
  }
  return valor;
}

/** Middleware para rutas inexistentes. */
export function noEncontrado(): RequestHandler {
  return (req, _res, next) => {
    next(new ErrorHttp(404, 'NOT_FOUND', `Ruta no encontrada: ${req.method} ${req.path}`));
  };
}

/** Manejador de errores central. */
export function manejadorErrores(env: Env): ErrorRequestHandler {
  return (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (error instanceof ErrorHttp) {
      respuestaError(res, error.estado, error.codigo, error.message, error.detalles);
      return;
    }
    if (env.NODE_ENV !== 'production') {
      console.error('[api] error no controlado:', error);
    }
    respuestaError(res, 500, 'INTERNAL', 'Error interno del servidor');
  };
}

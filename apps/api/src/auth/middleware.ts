import type { Request, RequestHandler } from 'express';
import type { RolUsuario, UsuarioPublico } from '@victoriasapp/shared';

import { errorNoAutorizado, errorProhibido } from '../lib/errores.js';
import { verificarAccess, type ConfigTokens } from './tokens.js';

/** Middleware que exige un access token válido y deja el usuario en `req.usuario`. */
export function crearAutenticar(config: ConfigTokens): RequestHandler {
  return (req, _res, next) => {
    const cabecera = req.header('authorization');
    if (!cabecera?.startsWith('Bearer ')) {
      next(errorNoAutorizado());
      return;
    }
    const token = cabecera.slice('Bearer '.length).trim();
    try {
      const payload = verificarAccess(config, token);
      req.usuario = {
        id: payload.id,
        usuario: payload.usuario,
        nombre: payload.nombre,
        rol: payload.rol,
        garitaId: payload.garitaId,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Devuelve el usuario autenticado o lanza 401. */
export function usuarioDe(req: Request): UsuarioPublico {
  if (req.usuario === undefined) {
    throw errorNoAutorizado();
  }
  return req.usuario;
}

/** Middleware que exige uno de los roles indicados. */
export function requerirRol(...roles: readonly RolUsuario[]): RequestHandler {
  return (req, _res, next) => {
    if (req.usuario === undefined) {
      next(errorNoAutorizado());
      return;
    }
    if (!roles.includes(req.usuario.rol)) {
      next(errorProhibido());
      return;
    }
    next();
  };
}

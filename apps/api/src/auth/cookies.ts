import type { CookieOptions, Request, Response } from 'express';

import type { Env } from '../config/env.js';

/** Nombre de la cookie que transporta el refresh token. */
export const COOKIE_REFRESH = 'victoriasapp_refresh';

/**
 * La cookie de refresh sólo se manda a los endpoints de auth y nunca es
 * accesible por JavaScript (httpOnly). En producción, además, `Secure`.
 */
function opciones(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production' || env.COOKIE_SAMESITE === 'none',
    sameSite: env.COOKIE_SAMESITE,
    path: '/api/auth',
    maxAge: env.REFRESH_TOKEN_SEGUNDOS * 1000,
  };
}

export function ponerCookieRefresh(res: Response, token: string, env: Env): void {
  res.cookie(COOKIE_REFRESH, token, opciones(env));
}

export function limpiarCookieRefresh(res: Response, env: Env): void {
  const sinMaxAge = opciones(env);
  delete sinMaxAge.maxAge;
  res.clearCookie(COOKIE_REFRESH, sinMaxAge);
}

/** Lee una cookie de la cabecera `Cookie` sin dependencias extra. */
export function leerCookie(req: Request, nombre: string): string | null {
  const cabecera = req.headers.cookie;
  if (cabecera === undefined) {
    return null;
  }
  for (const parte of cabecera.split(';')) {
    const indice = parte.indexOf('=');
    if (indice === -1) {
      continue;
    }
    const clave = parte.slice(0, indice).trim();
    if (clave === nombre) {
      return decodeURIComponent(parte.slice(indice + 1).trim());
    }
  }
  return null;
}

export function leerCookieRefresh(req: Request): string | null {
  return leerCookie(req, COOKIE_REFRESH);
}

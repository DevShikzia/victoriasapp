import { createHash } from 'node:crypto';

import type { RolUsuario } from '@victoriasapp/shared';
import jwt from 'jsonwebtoken';

import type { Env } from '../config/env.js';
import { errorNoAutorizado } from '../lib/errores.js';

export interface ConfigTokens {
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly accessSegundos: number;
  readonly refreshSegundos: number;
}

export interface DatosAccess {
  readonly id: string;
  readonly usuario: string;
  readonly nombre: string;
  readonly rol: RolUsuario;
  readonly garitaId: string | null;
}

export interface PayloadAccess extends DatosAccess {
  readonly tipo: 'access';
}

export interface PayloadRefresh {
  readonly sub: string;
  readonly tipo: 'refresh';
}

/** Arma la configuración de tokens a partir del entorno. */
export function configTokens(env: Env): ConfigTokens {
  return {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessSegundos: env.ACCESS_TOKEN_SEGUNDOS,
    refreshSegundos: env.REFRESH_TOKEN_SEGUNDOS,
  };
}

/** Firma el access token (vida corta). */
export function firmarAccess(
  config: ConfigTokens,
  datos: DatosAccess,
): { token: string; expiraEn: number } {
  const token = jwt.sign(
    {
      usuario: datos.usuario,
      nombre: datos.nombre,
      rol: datos.rol,
      garitaId: datos.garitaId,
      tipo: 'access',
    },
    config.accessSecret,
    { subject: datos.id, expiresIn: config.accessSegundos },
  );
  return { token, expiraEn: Date.now() + config.accessSegundos * 1000 };
}

/** Firma el refresh token (vida larga, va en cookie httpOnly). */
export function firmarRefresh(config: ConfigTokens, id: string): string {
  return jwt.sign({ tipo: 'refresh' }, config.refreshSecret, {
    subject: id,
    expiresIn: config.refreshSegundos,
  });
}

/** Hash determinístico del refresh token para guardarlo sin exponerlo. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function comoRegistro(valor: unknown): Record<string, unknown> | null {
  if (typeof valor !== 'object' || valor === null) {
    return null;
  }
  return valor as Record<string, unknown>;
}

/** Verifica el access token; lanza 401 si es inválido o venció. */
export function verificarAccess(config: ConfigTokens, token: string): PayloadAccess {
  let decodificado: unknown;
  try {
    decodificado = jwt.verify(token, config.accessSecret);
  } catch {
    throw errorNoAutorizado('Token inválido o vencido');
  }
  const registro = comoRegistro(decodificado);
  const sub = registro?.sub;
  const usuario = registro?.usuario;
  const nombre = registro?.nombre;
  const rol = registro?.rol;
  const garitaId = registro?.garitaId;
  if (
    registro?.tipo !== 'access' ||
    typeof sub !== 'string' ||
    typeof usuario !== 'string' ||
    typeof nombre !== 'string' ||
    typeof rol !== 'string' ||
    !(garitaId === null || typeof garitaId === 'string')
  ) {
    throw errorNoAutorizado('Token inválido');
  }
  return {
    tipo: 'access',
    id: sub,
    usuario,
    nombre,
    rol: rol as PayloadAccess['rol'],
    garitaId,
  };
}

/** Verifica el refresh token; lanza 401 si es inválido o venció. */
export function verificarRefresh(config: ConfigTokens, token: string): PayloadRefresh {
  let decodificado: unknown;
  try {
    decodificado = jwt.verify(token, config.refreshSecret);
  } catch {
    throw errorNoAutorizado('Sesión inválida o vencida');
  }
  const registro = comoRegistro(decodificado);
  const sub = registro?.sub;
  if (registro?.tipo !== 'refresh' || typeof sub !== 'string') {
    throw errorNoAutorizado('Sesión inválida');
  }
  return { tipo: 'refresh', sub };
}

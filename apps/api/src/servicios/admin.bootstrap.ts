import type { UsuarioPublico } from '@victoriasapp/shared';

import { hashearPassword } from '../auth/password.js';
import type { Env } from '../config/env.js';
import { UsuarioModel } from '../models/usuario.model.js';
import { registrarAuditoria } from './auditoria.service.js';
import { aUsuarioPublico } from './usuarios.service.js';

export interface ResultadoBootstrapAdmin {
  readonly creado: boolean;
  readonly actualizado: boolean;
  readonly usuario: UsuarioPublico | null;
}

/**
 * Garantiza que exista un administrador a partir de las variables de entorno.
 *
 * Comportamiento (ver docs/06-seguridad.md):
 * - Sin `ADMIN_PASSWORD` → no hace nada.
 * - Con `ADMIN_PASSWORD` y usuario inexistente → lo crea como `admin`.
 * - Con `ADMIN_FORZAR_RESET=true` y usuario existente → resetea su contraseña
 *   y lo reactiva (recuperación de acceso).
 *
 * Es idempotente: correrlo varias veces no rompe nada ni duplica usuarios.
 */
export async function asegurarAdminDesdeEnv(env: Env): Promise<ResultadoBootstrapAdmin> {
  const password = env.ADMIN_PASSWORD;
  if (password === undefined || password === '') {
    return { creado: false, actualizado: false, usuario: null };
  }

  const usuario = env.ADMIN_USUARIO.toLowerCase();
  const existente = await UsuarioModel.findOne({ usuario });

  if (existente === null) {
    const passwordHash = await hashearPassword(password);
    const creado = await UsuarioModel.create({
      usuario,
      nombre: env.ADMIN_NOMBRE,
      passwordHash,
      rol: 'admin',
      activo: true,
    });
    await registrarAuditoria({
      accion: 'admin.bootstrap',
      entidad: 'usuarios',
      entidadId: creado._id.toString(),
      detalle: { usuario },
    });
    return { creado: true, actualizado: false, usuario: aUsuarioPublico(creado) };
  }

  if (env.ADMIN_FORZAR_RESET) {
    existente.passwordHash = await hashearPassword(password);
    existente.activo = true;
    existente.rol = 'admin';
    existente.refreshTokenHash = null;
    await existente.save();
    await registrarAuditoria({
      accion: 'admin.reset',
      entidad: 'usuarios',
      entidadId: existente._id.toString(),
      detalle: { usuario },
    });
    return { creado: false, actualizado: true, usuario: aUsuarioPublico(existente) };
  }

  return { creado: false, actualizado: false, usuario: aUsuarioPublico(existente) };
}

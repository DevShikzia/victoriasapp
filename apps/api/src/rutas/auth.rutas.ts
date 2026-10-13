import { esquemaLogin, type RespuestaLogin } from '@victoriasapp/shared';
import { Router } from 'express';

import { limpiarCookieRefresh, leerCookieRefresh, ponerCookieRefresh } from '../auth/cookies.js';
import { crearAutenticar, usuarioDe } from '../auth/middleware.js';
import type { DatosAccess } from '../auth/tokens.js';
import {
  configTokens,
  firmarAccess,
  firmarRefresh,
  hashToken,
  verificarRefresh,
} from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import { errorNoAutorizado } from '../lib/errores.js';
import { asincrono, respuestaOk, validar } from '../lib/http.js';
import { UsuarioModel } from '../models/usuario.model.js';
import { registrarAuditoria } from '../servicios/auditoria.service.js';
import { aUsuarioPublico, type UsuarioDoc } from '../servicios/usuarios.service.js';
import { verificarPassword } from '../auth/password.js';

function datosAccess(doc: UsuarioDoc): DatosAccess {
  return {
    id: doc._id.toString(),
    usuario: doc.usuario,
    nombre: doc.nombre,
    rol: doc.rol,
    garitaId: doc.garitaId === null ? null : doc.garitaId.toString(),
  };
}

function armarLogin(config: ReturnType<typeof configTokens>, doc: UsuarioDoc): RespuestaLogin {
  const acceso = firmarAccess(config, datosAccess(doc));
  return { accessToken: acceso.token, expiraEn: acceso.expiraEn, usuario: aUsuarioPublico(doc) };
}

/**
 * Rutas de autenticación (`/api/auth`).
 * Access token corto (en el body) + refresh token largo (cookie httpOnly).
 */
export function crearRutasAuth(env: Env): Router {
  const router = Router();
  const config = configTokens(env);
  const autenticar = crearAutenticar(config);

  router.post(
    '/login',
    asincrono(async (req, res) => {
      const { usuario, password } = validar(esquemaLogin, req.body, 'Credenciales inválidas');
      const doc = await UsuarioModel.findOne({ usuario: usuario.toLowerCase() }).select(
        '+passwordHash',
      );

      if (!doc?.activo) {
        throw errorNoAutorizado('Usuario o contraseña incorrectos');
      }

      const valida = await verificarPassword(password, doc.passwordHash);
      if (!valida) {
        await registrarAuditoria({
          accion: 'login.fallido',
          entidad: 'usuarios',
          entidadId: doc._id.toString(),
          ip: req.ip ?? null,
          userAgent: req.header('user-agent') ?? null,
        });
        throw errorNoAutorizado('Usuario o contraseña incorrectos');
      }

      const respuesta = armarLogin(config, doc);
      const refresh = firmarRefresh(config, doc._id.toString());
      doc.refreshTokenHash = hashToken(refresh);
      doc.ultimoAcceso = new Date();
      await doc.save();

      ponerCookieRefresh(res, refresh, env);
      await registrarAuditoria({
        accion: 'login',
        userId: doc._id,
        ip: req.ip ?? null,
        userAgent: req.header('user-agent') ?? null,
      });
      respuestaOk(res, respuesta);
    }),
  );

  router.post(
    '/refresh',
    asincrono(async (req, res) => {
      const token = leerCookieRefresh(req);
      if (token === null) {
        throw errorNoAutorizado('No hay sesión para renovar');
      }

      const payload = verificarRefresh(config, token);
      const doc = await UsuarioModel.findById(payload.sub).select('+refreshTokenHash');
      if (doc === null || !doc.activo || doc.refreshTokenHash === null) {
        throw errorNoAutorizado('Sesión inválida');
      }

      // Rotación: si el token no coincide con el guardado, se asume reutilización
      // y se revoca la sesión por completo.
      if (doc.refreshTokenHash !== hashToken(token)) {
        doc.refreshTokenHash = null;
        await doc.save();
        throw errorNoAutorizado('Sesión revocada');
      }

      const respuesta = armarLogin(config, doc);
      const nuevo = firmarRefresh(config, doc._id.toString());
      doc.refreshTokenHash = hashToken(nuevo);
      await doc.save();

      ponerCookieRefresh(res, nuevo, env);
      respuestaOk(res, respuesta);
    }),
  );

  router.post(
    '/logout',
    asincrono(async (req, res) => {
      const token = leerCookieRefresh(req);
      if (token !== null) {
        try {
          const payload = verificarRefresh(config, token);
          const doc = await UsuarioModel.findById(payload.sub).select('+refreshTokenHash');
          if (doc !== null) {
            doc.refreshTokenHash = null;
            await doc.save();
          }
        } catch {
          // Token inválido o vencido: igual limpiamos la cookie.
        }
      }
      limpiarCookieRefresh(res, env);
      respuestaOk(res, { cerrado: true });
    }),
  );

  router.get('/me', autenticar, (req, res) => {
    respuestaOk(res, usuarioDe(req));
  });

  return router;
}

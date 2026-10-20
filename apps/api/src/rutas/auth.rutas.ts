import {
  esquemaElegirBarrio,
  esquemaLogin,
  type ElegirBarrio,
  type RespuestaLogin,
} from '@victoriasapp/shared';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { Types, type HydratedDocument } from 'mongoose';

import { limpiarCookieRefresh, leerCookieRefresh, ponerCookieRefresh } from '../auth/cookies.js';
import { crearAutenticar, usuarioDe } from '../auth/middleware.js';
import { verificarPassword } from '../auth/password.js';
import type { DatosAccess } from '../auth/tokens.js';
import {
  configTokens,
  firmarAccess,
  firmarRefresh,
  hashToken,
  verificarRefresh,
} from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import {
  errorConflicto,
  errorNoAutorizado,
  errorNoEncontrado,
  errorValidacion,
} from '../lib/errores.js';
import { asincrono, respuestaOk, validar } from '../lib/http.js';
import { BarrioModel, type Barrio } from '../models/directorio.modelos.js';
import { UsuarioModel } from '../models/usuario.model.js';
import { registrarAuditoria } from '../servicios/auditoria.service.js';
import { aBarrioDto } from '../servicios/directorio.service.js';
import { aUsuarioPublico, type UsuarioDoc } from '../servicios/usuarios.service.js';

function datosAccess(doc: UsuarioDoc, barrioNombre: string | null): DatosAccess {
  return {
    id: doc._id.toString(),
    usuario: doc.usuario,
    nombre: doc.nombre,
    rol: doc.rol,
    garitaId: doc.garitaId === null ? null : doc.garitaId.toString(),
    barrioId: doc.barrioId === null ? null : doc.barrioId.toString(),
    barrioNombre,
  };
}

function armarLogin(
  config: ReturnType<typeof configTokens>,
  doc: UsuarioDoc,
  barrioNombre: string | null,
): RespuestaLogin {
  const acceso = firmarAccess(config, datosAccess(doc, barrioNombre));
  return {
    accessToken: acceso.token,
    expiraEn: acceso.expiraEn,
    usuario: aUsuarioPublico(doc, barrioNombre),
  };
}

/** Nombre del barrio activo del usuario, o `null` si todavía no eligió uno. */
async function nombreDeBarrio(doc: UsuarioDoc): Promise<string | null> {
  if (doc.barrioId === null) {
    return null;
  }
  const barrio = await BarrioModel.findById(doc.barrioId).select('nombre');
  return barrio?.nombre ?? null;
}

/** Escapa metacaracteres para buscar un nombre de barrio como texto literal. */
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Resuelve el barrio elegido: uno existente por id o uno nuevo por nombre. */
async function resolverBarrio(datos: ElegirBarrio): Promise<HydratedDocument<Barrio>> {
  if (datos.barrioId !== undefined && datos.barrioId !== null) {
    if (!Types.ObjectId.isValid(datos.barrioId)) {
      throw errorValidacion('Barrio inválido');
    }
    const existente = await BarrioModel.findOne({ _id: datos.barrioId, activo: true });
    if (existente === null) {
      throw errorNoEncontrado('Barrio no encontrado');
    }
    return existente;
  }

  const nombre = (datos.nombre ?? '').trim();
  const existente = await BarrioModel.findOne({
    nombre: new RegExp(`^${escaparRegex(nombre)}$`, 'i'),
  });
  if (existente !== null) {
    return existente;
  }
  return await BarrioModel.create({
    uuid: randomUUID(),
    nombre,
    direccion: datos.direccion ?? null,
    activo: true,
  });
}

/**
 * Rutas de autenticación (`/api/auth`).
 * Access token corto (en el body) + refresh token largo (cookie httpOnly).
 *
 * Al primer ingreso la cuenta no tiene barrio: el cliente debe elegirlo o
 * crearlo con `PUT /api/auth/barrio`. A partir de ahí todas las consultas de
 * directorio, visitas y el panel quedan acotadas a ese barrio.
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

      const barrioNombre = await nombreDeBarrio(doc);
      const respuesta = armarLogin(config, doc, barrioNombre);
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

      const barrioNombre = await nombreDeBarrio(doc);
      const respuesta = armarLogin(config, doc, barrioNombre);
      const nuevo = firmarRefresh(config, doc._id.toString());
      doc.refreshTokenHash = hashToken(nuevo);
      await doc.save();

      ponerCookieRefresh(res, nuevo, env);
      respuestaOk(res, respuesta);
    }),
  );

  /**
   * Barrios disponibles para el primer ingreso. Devuelve todos los activos,
   * incluso si la cuenta todavía no tiene barrio (a diferencia del ABM, que
   * sólo muestra el barrio activo).
   */
  router.get(
    '/barrios',
    autenticar,
    asincrono(async (_req, res) => {
      const barrios = await BarrioModel.find({ activo: true }).sort({ nombre: 1 });
      respuestaOk(res, barrios.map(aBarrioDto));
    }),
  );

  /**
   * Elige el barrio de la cuenta (una sola vez). Acepta `barrioId` para usar uno
   * existente o `nombre` para crearlo. Rota el refresh token y devuelve un
   * access token nuevo que ya lleva el barrio.
   */
  router.put(
    '/barrio',
    autenticar,
    asincrono(async (req, res) => {
      const datos = validar(esquemaElegirBarrio, req.body, 'Barrio inválido');
      const actual = usuarioDe(req);
      const doc = await UsuarioModel.findById(actual.id);
      if (!doc?.activo) {
        throw errorNoAutorizado();
      }

      if (doc.barrioId !== null) {
        // Idempotente si reintenta con el mismo barrio; si no, la cuenta queda
        // bloqueada al barrio elegido.
        if (
          datos.barrioId !== undefined &&
          datos.barrioId !== null &&
          datos.barrioId === doc.barrioId.toString()
        ) {
          const barrio = await BarrioModel.findById(doc.barrioId);
          respuestaOk(res, armarLogin(config, doc, barrio?.nombre ?? null));
          return;
        }
        throw errorConflicto('Esta cuenta ya tiene un barrio asignado');
      }

      const barrio = await resolverBarrio(datos);

      const refresh = firmarRefresh(config, doc._id.toString());
      doc.barrioId = barrio._id;
      doc.refreshTokenHash = hashToken(refresh);
      await doc.save();

      ponerCookieRefresh(res, refresh, env);
      await registrarAuditoria({
        accion: 'barrio.elegido',
        userId: doc._id,
        entidad: 'barrios',
        entidadId: barrio._id.toString(),
        detalle: { nombre: barrio.nombre },
        ip: req.ip ?? null,
        userAgent: req.header('user-agent') ?? null,
      });
      respuestaOk(res, armarLogin(config, doc, barrio.nombre));
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

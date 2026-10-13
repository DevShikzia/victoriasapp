import { esquemaActualizarUsuario, esquemaCrearUsuario } from '@victoriasapp/shared';
import { Router } from 'express';
import { Types } from 'mongoose';

import { crearAutenticar } from '../auth/middleware.js';
import { hashearPassword } from '../auth/password.js';
import { configTokens } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import { errorConflicto, errorNoEncontrado } from '../lib/errores.js';
import { asincrono, paramId, respuestaOk, validar } from '../lib/http.js';
import { UsuarioModel } from '../models/usuario.model.js';
import { aUsuarioPublico } from '../servicios/usuarios.service.js';
import { requerirRol } from '../auth/middleware.js';

/** Rutas de gestión de usuarios (`/api/users`). Sólo `admin`. */
export function crearRutasUsuarios(env: Env): Router {
  const router = Router();
  const autenticar = crearAutenticar(configTokens(env));
  const soloAdmin = [autenticar, requerirRol('admin')];

  router.get(
    '/',
    ...soloAdmin,
    asincrono(async (_req, res) => {
      const docs = await UsuarioModel.find().sort({ usuario: 1 });
      respuestaOk(
        res,
        docs.map((doc) => aUsuarioPublico(doc)),
      );
    }),
  );

  router.post(
    '/',
    ...soloAdmin,
    asincrono(async (req, res) => {
      const datos = validar(esquemaCrearUsuario, req.body);
      const usuario = datos.usuario.toLowerCase();
      const existe = await UsuarioModel.findOne({ usuario });
      if (existe !== null) {
        throw errorConflicto('Ese usuario ya existe');
      }
      const passwordHash = await hashearPassword(datos.password);
      const creado = await UsuarioModel.create({
        usuario,
        nombre: datos.nombre,
        passwordHash,
        rol: datos.rol,
        garitaId: datos.garitaId === null ? null : new Types.ObjectId(datos.garitaId),
        activo: true,
      });
      respuestaOk(res, aUsuarioPublico(creado), 201);
    }),
  );

  router.patch(
    '/:id',
    ...soloAdmin,
    asincrono(async (req, res) => {
      const id = paramId(req);
      const datos = validar(esquemaActualizarUsuario, req.body);
      const doc = await UsuarioModel.findById(id).select('+passwordHash');
      if (doc === null) {
        throw errorNoEncontrado('Usuario no encontrado');
      }
      if (datos.nombre !== undefined) {
        doc.nombre = datos.nombre;
      }
      if (datos.rol !== undefined) {
        doc.rol = datos.rol;
      }
      if (datos.activo !== undefined) {
        doc.activo = datos.activo;
      }
      if (datos.garitaId !== undefined) {
        doc.garitaId = datos.garitaId === null ? null : new Types.ObjectId(datos.garitaId);
      }
      if (datos.password !== undefined) {
        doc.passwordHash = await hashearPassword(datos.password);
        // Al cambiar la contraseña se invalidan las sesiones abiertas.
        doc.refreshTokenHash = null;
      }
      await doc.save();
      respuestaOk(res, aUsuarioPublico(doc));
    }),
  );

  router.delete(
    '/:id',
    ...soloAdmin,
    asincrono(async (req, res) => {
      const id = paramId(req);
      const doc = await UsuarioModel.findById(id);
      if (doc === null) {
        throw errorNoEncontrado('Usuario no encontrado');
      }
      doc.activo = false;
      doc.refreshTokenHash = null;
      await doc.save();
      respuestaOk(res, { desactivado: true });
    }),
  );

  return router;
}

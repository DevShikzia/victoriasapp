import type { EntidadDirectorio } from '@victoriasapp/shared';
import { Router, type Request } from 'express';
import type { FilterQuery, HydratedDocument, Model } from 'mongoose';
import type { output, ZodTypeAny } from 'zod';

import { crearAutenticar } from '../auth/middleware.js';
import { requerirRol } from '../auth/middleware.js';
import { configTokens } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import { errorNoEncontrado } from '../lib/errores.js';
import { asincrono, paramId, respuestaOk, validar } from '../lib/http.js';
import { EliminadoModel } from '../models/directorio.modelos.js';
import { publicar } from '../tiempo-real/bus.js';

/** Configuración de una entidad para el CRUD genérico. */
export interface ConfigCrud<
  T extends { uuid: string },
  C extends ZodTypeAny,
  A extends ZodTypeAny,
> {
  readonly entidad: EntidadDirectorio;
  readonly modelo: Model<T>;
  readonly crear: C;
  readonly actualizar: A;
  readonly aDto: (doc: HydratedDocument<T>) => unknown;
  /** Arma el documento nuevo (incluye `uuid`). */
  readonly construir: (datos: output<C>) => Partial<T>;
  /** Aplica un patch sobre el documento existente. */
  readonly aplicar: (doc: HydratedDocument<T>, datos: output<A>) => void;
  readonly filtroBusqueda?: (
    req: Request,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  readonly orden?: Record<string, 1 | -1>;
}

function numeroQuery(valor: unknown, porDefecto: number, maximo: number): number {
  const texto = typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
  if (texto === null) {
    return porDefecto;
  }
  const numero = Number.parseInt(texto, 10);
  if (Number.isNaN(numero) || numero <= 0) {
    return porDefecto;
  }
  return Math.min(numero, maximo);
}

/**
 * Crea el router CRUD (listar, crear, ver, editar, borrar) de una entidad del
 * directorio. El borrado es lógico para la sincronización: además de borrar el
 * documento, deja una "lápida" en `eliminados` y publica el evento de tiempo real.
 */
export function crearRutasCrud<
  T extends { uuid: string },
  C extends ZodTypeAny,
  A extends ZodTypeAny,
>(env: Env, config: ConfigCrud<T, C, A>): Router {
  const router = Router();
  const autenticar = crearAutenticar(configTokens(env));
  const escribir = requerirRol('admin', 'supervisor');

  router.get(
    '/',
    autenticar,
    asincrono(async (req, res) => {
      const filtro: FilterQuery<T> =
        config.filtroBusqueda === undefined ? {} : await config.filtroBusqueda(req);
      const pagina = numeroQuery(req.query.page, 1, 1000);
      const limite = numeroQuery(req.query.limit, 200, 500);
      const docs = await config.modelo
        .find(filtro)
        .sort(config.orden ?? { createdAt: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite);
      respuestaOk(
        res,
        docs.map((doc) => config.aDto(doc)),
      );
    }),
  );

  router.post(
    '/',
    autenticar,
    escribir,
    asincrono(async (req, res) => {
      const datos = validar(config.crear, req.body);
      const doc = await config.modelo.create(config.construir(datos));
      publicar('directorio:actualizado', {
        entidad: config.entidad,
        uuid: doc.uuid,
        operacion: 'crear',
      });
      respuestaOk(res, config.aDto(doc), 201);
    }),
  );

  router.get(
    '/:id',
    autenticar,
    asincrono(async (req, res) => {
      const id = paramId(req);
      const doc = await config.modelo.findById(id);
      if (doc === null) {
        throw errorNoEncontrado(`${config.entidad} no encontrado`);
      }
      respuestaOk(res, config.aDto(doc));
    }),
  );

  router.patch(
    '/:id',
    autenticar,
    escribir,
    asincrono(async (req, res) => {
      const id = paramId(req);
      const datos = validar(config.actualizar, req.body);
      const doc = await config.modelo.findById(id);
      if (doc === null) {
        throw errorNoEncontrado(`${config.entidad} no encontrado`);
      }
      config.aplicar(doc, datos);
      await doc.save();
      publicar('directorio:actualizado', {
        entidad: config.entidad,
        uuid: doc.uuid,
        operacion: 'actualizar',
      });
      respuestaOk(res, config.aDto(doc));
    }),
  );

  router.delete(
    '/:id',
    autenticar,
    escribir,
    asincrono(async (req, res) => {
      const id = paramId(req);
      const doc = await config.modelo.findById(id);
      if (doc === null) {
        throw errorNoEncontrado(`${config.entidad} no encontrado`);
      }
      const uuid = doc.uuid;
      await config.modelo.deleteOne({ _id: doc._id });
      await EliminadoModel.create({ uuid, entidad: config.entidad, eliminadoEn: new Date() });
      publicar('directorio:actualizado', {
        entidad: config.entidad,
        uuid,
        operacion: 'eliminar',
      });
      respuestaOk(res, { eliminado: true });
    }),
  );

  return router;
}

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
  readonly construir: (datos: output<C>, req: Request) => Partial<T> | Promise<Partial<T>>;
  /** Aplica un patch sobre el documento existente. */
  readonly aplicar: (
    doc: HydratedDocument<T>,
    datos: output<A>,
    req: Request,
  ) => void | Promise<void>;
  readonly filtroBusqueda?: (
    req: Request,
  ) => Promise<Record<string, unknown>> | Record<string, unknown>;
  /**
   * Condición extra que acota listado, lectura, edición y borrado (por ejemplo,
   * el barrio activo). Se combina con `filtroBusqueda` mediante `$and`.
   */
  readonly alcance?: (req: Request) => Promise<FilterQuery<T>> | FilterQuery<T>;
  readonly orden?: Record<string, 1 | -1>;
}

/** Combina condiciones no vacías; `{}` si no hay ninguna. */
function combinarFiltros<T>(condiciones: readonly FilterQuery<T>[]): FilterQuery<T> {
  const activas = condiciones.filter((condicion) => Object.keys(condicion).length > 0);
  if (activas.length === 0) {
    return {};
  }
  if (activas.length === 1) {
    return activas[0] ?? {};
  }
  return { $and: activas };
}

/** Filtro de listado: alcance + búsqueda. */
async function filtroListado<
  T extends { uuid: string },
  C extends ZodTypeAny,
  A extends ZodTypeAny,
>(req: Request, config: ConfigCrud<T, C, A>): Promise<FilterQuery<T>> {
  const condiciones: FilterQuery<T>[] = [];
  if (config.alcance !== undefined) {
    condiciones.push(await config.alcance(req));
  }
  if (config.filtroBusqueda !== undefined) {
    condiciones.push(await config.filtroBusqueda(req));
  }
  return combinarFiltros(condiciones);
}

/** Busca un documento por id respetando el alcance configurado. */
async function buscarPorId<T extends { uuid: string }, C extends ZodTypeAny, A extends ZodTypeAny>(
  req: Request,
  id: string,
  config: ConfigCrud<T, C, A>,
): Promise<HydratedDocument<T> | null> {
  const condiciones: FilterQuery<T>[] = [{ _id: id }];
  if (config.alcance !== undefined) {
    condiciones.push(await config.alcance(req));
  }
  return await config.modelo.findOne(combinarFiltros(condiciones));
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
      const filtro = await filtroListado(req, config);
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
      const doc = await config.modelo.create(await config.construir(datos, req));
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
      const doc = await buscarPorId(req, id, config);
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
      const doc = await buscarPorId(req, id, config);
      if (doc === null) {
        throw errorNoEncontrado(`${config.entidad} no encontrado`);
      }
      await config.aplicar(doc, datos, req);
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
      const doc = await buscarPorId(req, id, config);
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

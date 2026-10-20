import { randomUUID } from 'node:crypto';

import {
  esquemaActualizarBarrio,
  esquemaActualizarFamiliar,
  esquemaActualizarLote,
  esquemaActualizarPropietario,
  esquemaActualizarVehiculo,
  esquemaCrearBarrio,
  esquemaCrearFamiliar,
  esquemaCrearLote,
  esquemaCrearPropietario,
  esquemaCrearVehiculo,
  esquemaImportarDirectorio,
  normalizarPatente,
} from '@victoriasapp/shared';
import { Router, type Request } from 'express';
import { Types, type FilterQuery, type HydratedDocument } from 'mongoose';

import { crearAutenticar, requerirRol, usuarioDe } from '../auth/middleware.js';
import { configTokens } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import { errorBarrioRequerido, errorValidacion } from '../lib/errores.js';
import { asincrono, respuestaOk, validar } from '../lib/http.js';
import {
  BarrioModel,
  FamiliarModel,
  LoteModel,
  PropietarioModel,
  VehiculoModel,
  type Familiar,
  type Lote,
  type Propietario,
  type Vehiculo,
} from '../models/directorio.modelos.js';
import {
  aBarrioDto,
  aFamiliarDto,
  aLoteDto,
  aPropietarioDto,
  aVehiculoDto,
  importarDirectorio,
  pullDirectorio,
} from '../servicios/directorio.service.js';
import { publicar } from '../tiempo-real/bus.js';
import { crearRutasCrud } from './crud.js';

function textoQuery(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Convierte una referencia de texto en ObjectId; `null` si viene vacía. */
function ref(valor: string | null): Types.ObjectId | null {
  if (valor === null) {
    return null;
  }
  if (!Types.ObjectId.isValid(valor)) {
    throw errorValidacion('Referencia inválida', [
      { campo: 'id', mensaje: `"${valor}" no es un id válido` },
    ]);
  }
  return new Types.ObjectId(valor);
}

/**
 * Barrio activo de la cuenta. Toda operación del directorio exige que la cuenta
 * ya lo haya elegido en el primer ingreso.
 */
function barrioActual(req: Request): Types.ObjectId {
  const id = usuarioDe(req).barrioId;
  if (id === null || !Types.ObjectId.isValid(id)) {
    throw errorBarrioRequerido();
  }
  return new Types.ObjectId(id);
}

async function idsDeLotes(barrioId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const docs = await LoteModel.find({ barrioId }).select('_id').lean();
  return docs.map((doc) => doc._id);
}

async function idsDePropietarios(
  barrioId: Types.ObjectId,
  loteIds: readonly Types.ObjectId[],
): Promise<Types.ObjectId[]> {
  const docs = await PropietarioModel.find({
    $or: [{ barrioId }, { loteId: { $in: loteIds } }],
  })
    .select('_id')
    .lean();
  return docs.map((doc) => doc._id);
}

async function idsDeFamiliares(
  loteIds: readonly Types.ObjectId[],
  propietarioIds: readonly Types.ObjectId[],
): Promise<Types.ObjectId[]> {
  const docs = await FamiliarModel.find({
    $or: [{ loteId: { $in: loteIds } }, { propietarioId: { $in: propietarioIds } }],
  })
    .select('_id')
    .lean();
  return docs.map((doc) => doc._id);
}

/** Alcance del barrio para cada entidad. */
async function alcancePropietarios(req: Request): Promise<FilterQuery<Propietario>> {
  const barrioId = barrioActual(req);
  const loteIds = await idsDeLotes(barrioId);
  return { $or: [{ barrioId }, { loteId: { $in: loteIds } }] };
}

async function alcanceFamiliares(req: Request): Promise<FilterQuery<Familiar>> {
  const barrioId = barrioActual(req);
  const loteIds = await idsDeLotes(barrioId);
  const propietarioIds = await idsDePropietarios(barrioId, loteIds);
  return {
    $or: [{ loteId: { $in: loteIds } }, { propietarioId: { $in: propietarioIds } }],
  };
}

async function alcanceVehiculos(req: Request): Promise<FilterQuery<Vehiculo>> {
  const barrioId = barrioActual(req);
  const loteIds = await idsDeLotes(barrioId);
  const propietarioIds = await idsDePropietarios(barrioId, loteIds);
  const familiarIds = await idsDeFamiliares(loteIds, propietarioIds);
  return {
    $or: [
      { loteId: { $in: loteIds } },
      { propietarioId: { $in: propietarioIds } },
      { familiarId: { $in: familiarIds } },
    ],
  };
}

/** Lote del barrio activo; `null` si no se indicó ninguno. */
async function loteDelBarrio(valor: string | null, req: Request): Promise<Types.ObjectId | null> {
  const id = ref(valor);
  if (id === null) {
    return null;
  }
  const doc = await LoteModel.findOne({ _id: id, barrioId: barrioActual(req) });
  if (doc === null) {
    throw errorValidacion('El lote no pertenece al barrio activo');
  }
  return doc._id;
}

/** Propietario del barrio activo; `null` si no se indicó ninguno. */
async function propietarioDelBarrio(
  valor: string | null,
  req: Request,
): Promise<HydratedDocument<Propietario> | null> {
  const id = ref(valor);
  if (id === null) {
    return null;
  }
  const doc = await PropietarioModel.findOne({
    _id: id,
    ...(await alcancePropietarios(req)),
  });
  if (doc === null) {
    throw errorValidacion('El propietario no pertenece al barrio activo');
  }
  return doc;
}

/** Familiar del barrio activo; `null` si no se indicó ninguno. */
async function familiarDelBarrio(
  valor: string | null,
  req: Request,
): Promise<HydratedDocument<Familiar> | null> {
  const id = ref(valor);
  if (id === null) {
    return null;
  }
  const doc = await FamiliarModel.findOne({
    _id: id,
    ...(await alcanceFamiliares(req)),
  });
  if (doc === null) {
    throw errorValidacion('El familiar no pertenece al barrio activo');
  }
  return doc;
}

/** `GET /api/directorio` (pull incremental) y `POST /api/directorio/importar`. */
export function crearRutasDirectorio(env: Env): Router {
  const router = Router();
  const autenticar = crearAutenticar(configTokens(env));
  const escribir = requerirRol('admin', 'supervisor');

  router.get(
    '/',
    autenticar,
    asincrono(async (req, res) => {
      const desde = textoQuery(req.query.desde);
      let fecha: Date | null = null;
      if (desde !== null) {
        const parseada = new Date(desde);
        if (Number.isNaN(parseada.getTime())) {
          throw errorValidacion('El parámetro "desde" no es una fecha válida');
        }
        fecha = parseada;
      }
      respuestaOk(res, await pullDirectorio(fecha, barrioActual(req)));
    }),
  );

  router.post(
    '/importar',
    autenticar,
    escribir,
    asincrono(async (req, res) => {
      const datos = validar(esquemaImportarDirectorio, req.body);
      const barrioId = barrioActual(req);
      const barrio = await BarrioModel.findById(barrioId);
      const resultado = await importarDirectorio(barrioId, datos.csv);
      publicar('directorio:actualizado', {
        entidad: 'barrio',
        uuid: barrio?.uuid ?? barrioId.toString(),
        operacion: 'actualizar',
      });
      respuestaOk(res, resultado);
    }),
  );

  return router;
}

/** `GET/POST/PATCH/DELETE /api/barrios` (sólo el barrio activo). */
export function crearRutasBarrios(env: Env): Router {
  return crearRutasCrud(env, {
    entidad: 'barrio',
    modelo: BarrioModel,
    crear: esquemaCrearBarrio,
    actualizar: esquemaActualizarBarrio,
    aDto: aBarrioDto,
    orden: { nombre: 1 },
    alcance: (req) => ({ _id: barrioActual(req) }),
    construir: () => {
      throw errorValidacion('El barrio se elige al iniciar sesión');
    },
    aplicar: (doc, d) => {
      if (d.nombre !== undefined) {
        doc.nombre = d.nombre;
      }
      if (d.direccion !== undefined) {
        doc.direccion = d.direccion;
      }
      if (d.activo !== undefined) {
        doc.activo = d.activo;
      }
    },
    filtroBusqueda: (req) => {
      const q = textoQuery(req.query.q);
      return q === null ? {} : { nombre: new RegExp(escaparRegex(q), 'i') };
    },
  });
}

/** `GET/POST/PATCH/DELETE /api/lotes`. */
export function crearRutasLotes(env: Env): Router {
  return crearRutasCrud(env, {
    entidad: 'lote',
    modelo: LoteModel,
    crear: esquemaCrearLote,
    actualizar: esquemaActualizarLote,
    aDto: aLoteDto,
    orden: { numero: 1 },
    alcance: (req) => ({ barrioId: barrioActual(req) }),
    construir: async (d, req) => ({
      uuid: d.uuid ?? randomUUID(),
      barrioId: barrioActual(req),
      numero: d.numero,
      calle: d.calle,
      notas: d.notas,
      propietarioId:
        d.propietarioId === null
          ? null
          : ((await propietarioDelBarrio(d.propietarioId, req))?._id ?? null),
    }),
    aplicar: async (doc, d, req) => {
      // El barrio no se cambia: siempre es el activo de la cuenta.
      doc.barrioId = barrioActual(req);
      if (d.numero !== undefined) {
        doc.numero = d.numero;
      }
      if (d.calle !== undefined) {
        doc.calle = d.calle;
      }
      if (d.notas !== undefined) {
        doc.notas = d.notas;
      }
      if (d.propietarioId !== undefined) {
        doc.propietarioId =
          d.propietarioId === null
            ? null
            : ((await propietarioDelBarrio(d.propietarioId, req))?._id ?? null);
      }
    },
    filtroBusqueda: (req) => {
      const filtro: FilterQuery<Lote> = {};
      const q = textoQuery(req.query.q);
      if (q !== null) {
        filtro.numero = new RegExp(escaparRegex(q), 'i');
      }
      return filtro;
    },
  });
}

/** `GET/POST/PATCH/DELETE /api/propietarios`. */
export function crearRutasPropietarios(env: Env): Router {
  return crearRutasCrud(env, {
    entidad: 'propietario',
    modelo: PropietarioModel,
    crear: esquemaCrearPropietario,
    actualizar: esquemaActualizarPropietario,
    aDto: aPropietarioDto,
    orden: { apellido: 1, nombre: 1 },
    alcance: alcancePropietarios,
    construir: async (d, req) => ({
      uuid: d.uuid ?? randomUUID(),
      barrioId: barrioActual(req),
      loteId: await loteDelBarrio(d.loteId, req),
      nombre: d.nombre,
      apellido: d.apellido,
      tratamiento: d.tratamiento,
      telefono: d.telefono,
      email: d.email,
      descripcion: d.descripcion,
      activo: d.activo,
    }),
    aplicar: async (doc, d, req) => {
      doc.barrioId = barrioActual(req);
      if (d.loteId !== undefined) {
        doc.loteId = await loteDelBarrio(d.loteId, req);
      }
      if (d.nombre !== undefined) {
        doc.nombre = d.nombre;
      }
      if (d.apellido !== undefined) {
        doc.apellido = d.apellido;
      }
      if (d.tratamiento !== undefined) {
        doc.tratamiento = d.tratamiento;
      }
      if (d.telefono !== undefined) {
        doc.telefono = d.telefono;
      }
      if (d.email !== undefined) {
        doc.email = d.email;
      }
      if (d.descripcion !== undefined) {
        doc.descripcion = d.descripcion;
      }
      if (d.activo !== undefined) {
        doc.activo = d.activo;
      }
    },
    filtroBusqueda: async (req) => {
      const filtro: FilterQuery<Propietario> = {};
      const q = textoQuery(req.query.q);
      if (q !== null) {
        const re = new RegExp(escaparRegex(q), 'i');
        filtro.$or = [{ nombre: re }, { apellido: re }];
      }
      const lote = textoQuery(req.query.lote);
      if (lote !== null) {
        const loteDoc = await LoteModel.findOne({
          numero: lote,
          barrioId: barrioActual(req),
        });
        filtro.loteId = loteDoc === null ? new Types.ObjectId() : loteDoc._id;
      }
      return filtro;
    },
  });
}

/** `GET/POST/PATCH/DELETE /api/familiares`. */
export function crearRutasFamiliares(env: Env): Router {
  return crearRutasCrud(env, {
    entidad: 'familiar',
    modelo: FamiliarModel,
    crear: esquemaCrearFamiliar,
    actualizar: esquemaActualizarFamiliar,
    aDto: aFamiliarDto,
    orden: { nombre: 1 },
    alcance: alcanceFamiliares,
    construir: async (d, req) => {
      const propietario = await propietarioDelBarrio(d.propietarioId, req);
      const loteId =
        d.loteId === null ? (propietario?.loteId ?? null) : await loteDelBarrio(d.loteId, req);
      return {
        uuid: d.uuid ?? randomUUID(),
        propietarioId: propietario?._id ?? null,
        loteId,
        nombre: d.nombre,
        parentesco: d.parentesco,
        descripcion: d.descripcion,
        activo: d.activo,
      };
    },
    aplicar: async (doc, d, req) => {
      if (d.propietarioId !== undefined) {
        const propietario = await propietarioDelBarrio(d.propietarioId, req);
        doc.propietarioId = propietario?._id ?? null;
        if (d.loteId === undefined && propietario !== null && propietario.loteId !== null) {
          doc.loteId = propietario.loteId;
        }
      }
      if (d.loteId !== undefined) {
        doc.loteId = await loteDelBarrio(d.loteId, req);
      }
      if (d.nombre !== undefined) {
        doc.nombre = d.nombre;
      }
      if (d.parentesco !== undefined) {
        doc.parentesco = d.parentesco;
      }
      if (d.descripcion !== undefined) {
        doc.descripcion = d.descripcion;
      }
      if (d.activo !== undefined) {
        doc.activo = d.activo;
      }
    },
    filtroBusqueda: (req) => {
      const filtro: FilterQuery<Familiar> = {};
      const propietarioId = textoQuery(req.query.propietarioId);
      if (propietarioId !== null && Types.ObjectId.isValid(propietarioId)) {
        filtro.propietarioId = new Types.ObjectId(propietarioId);
      }
      const q = textoQuery(req.query.q);
      if (q !== null) {
        filtro.nombre = new RegExp(escaparRegex(q), 'i');
      }
      return filtro;
    },
  });
}

/** `GET/POST/PATCH/DELETE /api/vehiculos`. */
export function crearRutasVehiculos(env: Env): Router {
  return crearRutasCrud(env, {
    entidad: 'vehiculo',
    modelo: VehiculoModel,
    crear: esquemaCrearVehiculo,
    actualizar: esquemaActualizarVehiculo,
    aDto: aVehiculoDto,
    orden: { patente: 1 },
    alcance: alcanceVehiculos,
    construir: async (d, req) => {
      const propietario = await propietarioDelBarrio(d.propietarioId, req);
      const familiar = await familiarDelBarrio(d.familiarId, req);
      const loteId =
        d.loteId === null
          ? (propietario?.loteId ?? familiar?.loteId ?? null)
          : await loteDelBarrio(d.loteId, req);
      return {
        uuid: d.uuid ?? randomUUID(),
        patente: d.patente,
        marca: d.marca,
        modelo: d.modelo,
        color: d.color,
        propietarioId: propietario?._id ?? null,
        familiarId: familiar?._id ?? null,
        loteId,
        descripcion: d.descripcion,
      };
    },
    aplicar: async (doc, d, req) => {
      if (d.patente !== undefined) {
        doc.patente = d.patente;
      }
      if (d.marca !== undefined) {
        doc.marca = d.marca;
      }
      if (d.modelo !== undefined) {
        doc.modelo = d.modelo;
      }
      if (d.color !== undefined) {
        doc.color = d.color;
      }
      if (d.propietarioId !== undefined) {
        const propietario = await propietarioDelBarrio(d.propietarioId, req);
        doc.propietarioId = propietario?._id ?? null;
        if (d.loteId === undefined && propietario !== null && propietario.loteId !== null) {
          doc.loteId = propietario.loteId;
        }
      }
      if (d.familiarId !== undefined) {
        const familiar = await familiarDelBarrio(d.familiarId, req);
        doc.familiarId = familiar?._id ?? null;
        if (d.loteId === undefined && familiar !== null && familiar.loteId !== null) {
          doc.loteId = familiar.loteId;
        }
      }
      if (d.loteId !== undefined) {
        doc.loteId = await loteDelBarrio(d.loteId, req);
      }
      if (d.descripcion !== undefined) {
        doc.descripcion = d.descripcion;
      }
    },
    filtroBusqueda: (req) => {
      const filtro: FilterQuery<Vehiculo> = {};
      const propietarioId = textoQuery(req.query.propietarioId);
      if (propietarioId !== null && Types.ObjectId.isValid(propietarioId)) {
        filtro.propietarioId = new Types.ObjectId(propietarioId);
      }
      const patente = textoQuery(req.query.patente);
      if (patente !== null) {
        const normalizada = normalizarPatente(patente);
        filtro.patente = /^\d/.test(patente)
          ? normalizada
          : new RegExp(`^${escaparRegex(normalizada)}`);
      }
      return filtro;
    },
  });
}

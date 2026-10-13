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
import { Router } from 'express';
import { Types, type FilterQuery } from 'mongoose';

import { crearAutenticar, requerirRol } from '../auth/middleware.js';
import { configTokens } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import { errorValidacion } from '../lib/errores.js';
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
      respuestaOk(res, await pullDirectorio(fecha));
    }),
  );

  router.post(
    '/importar',
    autenticar,
    escribir,
    asincrono(async (req, res) => {
      const datos = validar(esquemaImportarDirectorio, req.body);
      const resultado = await importarDirectorio(datos.barrio, datos.csv);
      publicar('directorio:actualizado', {
        entidad: 'barrio',
        uuid: datos.barrio,
        operacion: 'actualizar',
      });
      respuestaOk(res, resultado);
    }),
  );

  return router;
}

/** `GET/POST/PATCH/DELETE /api/barrios`. */
export function crearRutasBarrios(env: Env): Router {
  return crearRutasCrud(env, {
    entidad: 'barrio',
    modelo: BarrioModel,
    crear: esquemaCrearBarrio,
    actualizar: esquemaActualizarBarrio,
    aDto: aBarrioDto,
    orden: { nombre: 1 },
    construir: (d) => ({
      uuid: d.uuid ?? randomUUID(),
      nombre: d.nombre,
      direccion: d.direccion,
      activo: d.activo,
    }),
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
    construir: (d) => ({
      uuid: d.uuid ?? randomUUID(),
      barrioId: ref(d.barrioId),
      numero: d.numero,
      calle: d.calle,
      notas: d.notas,
      propietarioId: ref(d.propietarioId),
    }),
    aplicar: (doc, d) => {
      if (d.barrioId !== undefined) {
        doc.barrioId = ref(d.barrioId);
      }
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
        doc.propietarioId = ref(d.propietarioId);
      }
    },
    filtroBusqueda: (req) => {
      const filtro: FilterQuery<Lote> = {};
      const q = textoQuery(req.query.q);
      if (q !== null) {
        filtro.numero = new RegExp(escaparRegex(q), 'i');
      }
      const barrioId = textoQuery(req.query.barrioId);
      if (barrioId !== null && Types.ObjectId.isValid(barrioId)) {
        filtro.barrioId = new Types.ObjectId(barrioId);
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
    construir: (d) => ({
      uuid: d.uuid ?? randomUUID(),
      barrioId: ref(d.barrioId),
      loteId: ref(d.loteId),
      nombre: d.nombre,
      apellido: d.apellido,
      telefono: d.telefono,
      email: d.email,
      descripcion: d.descripcion,
      activo: d.activo,
    }),
    aplicar: (doc, d) => {
      if (d.barrioId !== undefined) {
        doc.barrioId = ref(d.barrioId);
      }
      if (d.loteId !== undefined) {
        doc.loteId = ref(d.loteId);
      }
      if (d.nombre !== undefined) {
        doc.nombre = d.nombre;
      }
      if (d.apellido !== undefined) {
        doc.apellido = d.apellido;
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
        const loteDoc = await LoteModel.findOne({ numero: lote });
        filtro.loteId = loteDoc === null ? new Types.ObjectId() : loteDoc._id;
      }
      const barrioId = textoQuery(req.query.barrioId);
      if (barrioId !== null && Types.ObjectId.isValid(barrioId)) {
        filtro.barrioId = new Types.ObjectId(barrioId);
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
    construir: (d) => ({
      uuid: d.uuid ?? randomUUID(),
      propietarioId: ref(d.propietarioId),
      loteId: ref(d.loteId),
      nombre: d.nombre,
      parentesco: d.parentesco,
      descripcion: d.descripcion,
      activo: d.activo,
    }),
    aplicar: (doc, d) => {
      if (d.propietarioId !== undefined) {
        doc.propietarioId = ref(d.propietarioId);
      }
      if (d.loteId !== undefined) {
        doc.loteId = ref(d.loteId);
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
    construir: (d) => ({
      uuid: d.uuid ?? randomUUID(),
      patente: d.patente,
      marca: d.marca,
      modelo: d.modelo,
      color: d.color,
      propietarioId: ref(d.propietarioId),
      familiarId: ref(d.familiarId),
      loteId: ref(d.loteId),
      descripcion: d.descripcion,
    }),
    aplicar: (doc, d) => {
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
        doc.propietarioId = ref(d.propietarioId);
      }
      if (d.familiarId !== undefined) {
        doc.familiarId = ref(d.familiarId);
      }
      if (d.loteId !== undefined) {
        doc.loteId = ref(d.loteId);
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

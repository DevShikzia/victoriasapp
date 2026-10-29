import { randomUUID } from 'node:crypto';

import {
  esquemaActualizarDomestica,
  esquemaCrearDomestica,
  type FiltroRegistrosDomesticas,
} from '@victoriasapp/shared';
import { Router, type Request } from 'express';
import { Types, type FilterQuery, type HydratedDocument } from 'mongoose';

import { crearAutenticar, requerirRol, usuarioDe } from '../auth/middleware.js';
import { configTokens } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import {
  errorBarrioRequerido,
  errorConflicto,
  errorNoEncontrado,
  errorValidacion,
} from '../lib/errores.js';
import { asincrono, respuestaOk, validar } from '../lib/http.js';
import { DomesticaModel, type Domestica } from '../models/domesticas.model.js';
import { LoteModel, type Lote } from '../models/directorio.modelos.js';
import { registrarAuditoria } from '../servicios/auditoria.service.js';
import {
  aDomesticaDto,
  listarRegistrosDomesticas,
  lotesUuidPorId,
} from '../servicios/domesticas.service.js';

type LoteDoc = HydratedDocument<Lote>;

function textoQuery(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function barrioActual(req: Request): Types.ObjectId {
  const id = usuarioDe(req).barrioId;
  if (id === null || !Types.ObjectId.isValid(id)) {
    throw errorBarrioRequerido();
  }
  return new Types.ObjectId(id);
}

function usuarioId(req: Request): Types.ObjectId | null {
  const id = usuarioDe(req).id;
  return Types.ObjectId.isValid(id) ? new Types.ObjectId(id) : null;
}

async function lotePorUuid(uuid: string, barrioId: Types.ObjectId): Promise<LoteDoc> {
  const lote = await LoteModel.findOne({ uuid, barrioId });
  if (lote === null) {
    throw errorValidacion('El lote no pertenece al barrio activo');
  }
  return lote;
}

async function resolverHabituales(
  uuids: readonly string[],
  barrioId: Types.ObjectId,
  principalId: Types.ObjectId | null,
): Promise<Types.ObjectId[]> {
  const resultado: Types.ObjectId[] = [];
  const vistos = new Set<string>();
  for (const uuid of uuids) {
    const lote = await lotePorUuid(uuid, barrioId);
    if (principalId !== null && lote._id.equals(principalId)) {
      continue;
    }
    const clave = lote._id.toString();
    if (vistos.has(clave)) {
      continue;
    }
    vistos.add(clave);
    resultado.push(lote._id);
  }
  return resultado;
}

async function validarDniUnico(
  dni: string,
  barrioId: Types.ObjectId,
  exceptoUuid: string | null = null,
): Promise<void> {
  const existente = await DomesticaModel.findOne({ dni, barrioId });
  if (existente !== null && existente.uuid !== exceptoUuid) {
    throw errorConflicto('Ya existe una doméstica con ese DNI en este barrio');
  }
}

/** `GET/POST/PATCH/DELETE /api/domesticas` y `GET /api/domesticas/registros`. */
export function crearRutasDomesticas(env: Env): Router {
  const router = Router();
  const autenticar = crearAutenticar(configTokens(env));
  const escribir = requerirRol('admin', 'supervisor');

  router.get(
    '/',
    autenticar,
    asincrono(async (req, res) => {
      const barrioId = barrioActual(req);
      const condiciones: FilterQuery<Domestica>[] = [{ barrioId }];

      const q = textoQuery(req.query.q);
      if (q !== null) {
        const regex = new RegExp(escaparRegex(q), 'i');
        condiciones.push({ $or: [{ nombre: regex }, { apellido: regex }, { dni: regex }] });
      }

      const activo = textoQuery(req.query.activo);
      if (activo === 'true') {
        condiciones.push({ activo: true });
      } else if (activo === 'false') {
        condiciones.push({ activo: false });
      }

      const loteTexto = textoQuery(req.query.lote);
      if (loteTexto !== null) {
        const lote = await LoteModel.findOne({
          barrioId,
          $or: [{ uuid: loteTexto }, { numero: loteTexto }],
        });
        if (lote === null) {
          respuestaOk(res, []);
          return;
        }
        condiciones.push({
          $or: [{ lotePrincipalId: lote._id }, { lotesHabituales: lote._id }],
        });
      }

      const filtro: FilterQuery<Domestica> =
        condiciones.length === 1 ? condiciones[0] ?? {} : { $and: condiciones };
      const docs = await DomesticaModel.find(filtro)
        .sort({ apellido: 1, nombre: 1 })
        .limit(500);
      const lotesPorId = await lotesUuidPorId(barrioId);
      respuestaOk(
        res,
        docs.map((doc) => aDomesticaDto(doc, lotesPorId)),
      );
    }),
  );

  router.get(
    '/registros',
    autenticar,
    asincrono(async (req, res) => {
      const barrioId = barrioActual(req);
      const estado = textoQuery(req.query.estado);
      const filtro: FiltroRegistrosDomesticas = {
        q: textoQuery(req.query.q) ?? undefined,
        estado: estado === 'dentro' || estado === 'fuera' ? estado : undefined,
        lote: textoQuery(req.query.lote) ?? undefined,
        domestica: textoQuery(req.query.domestica) ?? undefined,
        desde: textoQuery(req.query.desde) ?? undefined,
        hasta: textoQuery(req.query.hasta) ?? undefined,
        limite: (() => {
          const texto = textoQuery(req.query.limit);
          if (texto === null) {
            return undefined;
          }
          const numero = Number.parseInt(texto, 10);
          return Number.isNaN(numero) ? undefined : numero;
        })(),
      };
      respuestaOk(res, await listarRegistrosDomesticas(filtro, barrioId));
    }),
  );

  router.post(
    '/',
    autenticar,
    escribir,
    asincrono(async (req, res) => {
      const datos = validar(esquemaCrearDomestica, req.body);
      const barrioId = barrioActual(req);
      const principal = await lotePorUuid(datos.lotePrincipalUuid, barrioId);
      const habituales = await resolverHabituales(
        datos.lotesHabituales,
        barrioId,
        principal._id,
      );
      await validarDniUnico(datos.dni, barrioId);

      const doc = await DomesticaModel.create({
        uuid: datos.uuid ?? randomUUID(),
        barrioId,
        nombre: datos.nombre,
        apellido: datos.apellido,
        dni: datos.dni,
        telefono: datos.telefono,
        lotePrincipalId: principal._id,
        lotesHabituales: habituales,
        activo: datos.activo,
        notas: datos.notas,
      });

      await registrarAuditoria({
        userId: usuarioId(req),
        accion: 'domestica.creada',
        entidad: 'domesticas',
        entidadId: doc._id.toString(),
        detalle: { uuid: doc.uuid },
      });
      const lotesPorId = await lotesUuidPorId(barrioId);
      respuestaOk(res, aDomesticaDto(doc, lotesPorId), 201);
    }),
  );

  router.patch(
    '/:uuid',
    autenticar,
    escribir,
    asincrono(async (req, res) => {
      const barrioId = barrioActual(req);
      const doc = await DomesticaModel.findOne({ uuid: req.params.uuid, barrioId });
      if (doc === null) {
        throw errorNoEncontrado('Doméstica no encontrada');
      }

      const datos = validar(esquemaActualizarDomestica, req.body);
      if (datos.dni !== undefined) {
        await validarDniUnico(datos.dni, barrioId, doc.uuid);
        doc.dni = datos.dni;
      }
      if (datos.lotePrincipalUuid !== undefined) {
        const principal = await lotePorUuid(datos.lotePrincipalUuid, barrioId);
        doc.lotePrincipalId = principal._id;
        doc.lotesHabituales = doc.lotesHabituales.filter((id) => !id.equals(principal._id));
      }
      if (datos.lotesHabituales !== undefined) {
        doc.lotesHabituales = await resolverHabituales(
          datos.lotesHabituales,
          barrioId,
          doc.lotePrincipalId,
        );
      }
      if (datos.nombre !== undefined) {
        doc.nombre = datos.nombre;
      }
      if (datos.apellido !== undefined) {
        doc.apellido = datos.apellido;
      }
      if (datos.telefono !== undefined) {
        doc.telefono = datos.telefono;
      }
      if (datos.activo !== undefined) {
        doc.activo = datos.activo;
      }
      if (datos.notas !== undefined) {
        doc.notas = datos.notas;
      }
      await doc.save();

      await registrarAuditoria({
        userId: usuarioId(req),
        accion: 'domestica.actualizada',
        entidad: 'domesticas',
        entidadId: doc._id.toString(),
        detalle: { uuid: doc.uuid },
      });
      const lotesPorId = await lotesUuidPorId(barrioId);
      respuestaOk(res, aDomesticaDto(doc, lotesPorId));
    }),
  );

  router.delete(
    '/:uuid',
    autenticar,
    escribir,
    asincrono(async (req, res) => {
      const barrioId = barrioActual(req);
      const doc = await DomesticaModel.findOne({ uuid: req.params.uuid, barrioId });
      if (doc === null) {
        throw errorNoEncontrado('Doméstica no encontrada');
      }
      doc.activo = false;
      await doc.save();
      await registrarAuditoria({
        userId: usuarioId(req),
        accion: 'domestica.desactivada',
        entidad: 'domesticas',
        entidadId: doc._id.toString(),
        detalle: { uuid: doc.uuid },
      });
      respuestaOk(res, { desactivada: true });
    }),
  );

  return router;
}

import type {
  DomesticaDto,
  DomesticaLocal,
  FiltroRegistrosDomesticas,
  RegistroDomesticaDto,
  RegistroDomesticaSync,
  ResultadoSync,
  UsuarioPublico,
} from '@victoriasapp/shared';
import { Types, type FilterQuery, type HydratedDocument } from 'mongoose';

import { registrarAuditoria } from './auditoria.service.js';
import { DomesticaModel, RegistroDomesticaModel } from '../models/domesticas.model.js';
import type { Domestica, RegistroDomestica } from '../models/domesticas.model.js';
import { LoteModel, type Lote } from '../models/directorio.modelos.js';

export type DomesticaDoc = HydratedDocument<Domestica>;
export type RegistroDomesticaDoc = HydratedDocument<RegistroDomestica>;
export type LoteDoc = HydratedDocument<Lote>;

function textoQuery(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function idONull(valor: Types.ObjectId | null): string | null {
  return valor === null ? null : valor.toString();
}

/** Mapa `_id` de lote -> `uuid`, para no exponer ids internos al PWA. */
export async function lotesUuidPorId(barrioId: Types.ObjectId): Promise<Map<string, string>> {
  const lotes = await LoteModel.find({ barrioId }).select('uuid').lean();
  return new Map(lotes.map((lote) => [lote._id.toString(), lote.uuid]));
}

export function aDomesticaDto(
  doc: DomesticaDoc,
  lotesPorId: ReadonlyMap<string, string>,
): DomesticaDto {
  const lotePrincipalUuid =
    doc.lotePrincipalId === null ? null : (lotesPorId.get(doc.lotePrincipalId.toString()) ?? null);
  const lotesHabituales = doc.lotesHabituales
    .map((id) => lotesPorId.get(id.toString()))
    .filter((uuid): uuid is string => uuid !== undefined);

  return {
    id: doc._id.toString(),
    uuid: doc.uuid,
    barrioId: idONull(doc.barrioId),
    nombre: doc.nombre,
    apellido: doc.apellido,
    dni: doc.dni,
    telefono: doc.telefono,
    lotePrincipalUuid,
    lotesHabituales,
    activo: doc.activo,
    notas: doc.notas,
    actualizadoEn: doc.updatedAt.toISOString(),
  };
}

export function aDomesticaLocal(
  doc: DomesticaDoc,
  lotesPorId: ReadonlyMap<string, string>,
): DomesticaLocal {
  const lotePrincipalUuid =
    doc.lotePrincipalId === null ? null : (lotesPorId.get(doc.lotePrincipalId.toString()) ?? null);
  const lotesHabituales = doc.lotesHabituales
    .map((id) => lotesPorId.get(id.toString()))
    .filter((uuid): uuid is string => uuid !== undefined);

  return {
    uuid: doc.uuid,
    nombre: doc.nombre,
    apellido: doc.apellido,
    dni: doc.dni,
    telefono: doc.telefono,
    lotePrincipalUuid,
    lotesHabituales,
    activo: doc.activo,
    notas: doc.notas,
    actualizadoEn: doc.updatedAt.toISOString(),
  };
}

export function aRegistroDomesticaDto(
  doc: RegistroDomesticaDoc,
  domestica: DomesticaDoc,
  lote: LoteDoc,
): RegistroDomesticaDto {
  return {
    id: doc._id.toString(),
    uuid: doc.uuid,
    domesticaId: doc.domesticaId.toString(),
    domesticaUuid: domestica.uuid,
    domesticaNombre: `${domestica.apellido}, ${domestica.nombre}`,
    domesticaDni: domestica.dni,
    loteId: doc.loteId.toString(),
    loteUuid: lote.uuid,
    loteNumero: lote.numero,
    entradaEn: doc.entradaEn.toISOString(),
    salidaEn: doc.salidaEn === null ? null : doc.salidaEn.toISOString(),
    descripcion: doc.descripcion,
    creadoOffline: doc.creadoOffline,
    barrioId: idONull(doc.barrioId),
    syncRev: doc.syncRev,
    actualizadoEn: doc.updatedAt.toISOString(),
  };
}

/**
 * Aplica altas y salidas de domésticas creadas offline. Idempotente por `uuid`.
 * El barrio y el usuario que registra salen siempre de la sesión.
 */
export async function aplicarSyncRegistrosDomesticas(
  registros: readonly RegistroDomesticaSync[],
  usuario: UsuarioPublico,
): Promise<ResultadoSync> {
  const aplicados: string[] = [];
  const duplicados: string[] = [];
  const errores: { uuid: string; mensaje: string }[] = [];

  if (usuario.barrioId === null || !Types.ObjectId.isValid(usuario.barrioId)) {
    return {
      aplicados,
      duplicados,
      errores: registros.map((registro) => ({
        uuid: registro.uuid,
        mensaje: 'Elegí el barrio en el que vas a trabajar',
      })),
    };
  }

  const barrioId = new Types.ObjectId(usuario.barrioId);
  const registradoPor = Types.ObjectId.isValid(usuario.id)
    ? new Types.ObjectId(usuario.id)
    : null;

  const domesticaUuids = [...new Set(registros.map((registro) => registro.domesticaUuid))];
  const loteUuids = [...new Set(registros.map((registro) => registro.loteUuid))];

  const [domesticas, lotes] = await Promise.all([
    DomesticaModel.find({ uuid: { $in: domesticaUuids }, barrioId }),
    LoteModel.find({ uuid: { $in: loteUuids }, barrioId }),
  ]);
  const domesticasPorUuid = new Map(domesticas.map((doc) => [doc.uuid, doc]));
  const lotesPorUuid = new Map(lotes.map((doc) => [doc.uuid, doc]));

  for (const entrada of registros) {
    try {
      const domestica = domesticasPorUuid.get(entrada.domesticaUuid);
      if (domestica === undefined) {
        errores.push({
          uuid: entrada.uuid,
          mensaje: 'La doméstica no existe en este barrio',
        });
        continue;
      }
      const lote = lotesPorUuid.get(entrada.loteUuid);
      if (lote === undefined) {
        errores.push({ uuid: entrada.uuid, mensaje: 'El lote no existe en este barrio' });
        continue;
      }

      const fechaEntrada = new Date(entrada.entradaEn);
      const fechaSalida = entrada.salidaEn === null ? null : new Date(entrada.salidaEn);
      if (Number.isNaN(fechaEntrada.getTime())) {
        errores.push({ uuid: entrada.uuid, mensaje: 'La fecha de entrada no es válida' });
        continue;
      }
      if (fechaSalida !== null && Number.isNaN(fechaSalida.getTime())) {
        errores.push({ uuid: entrada.uuid, mensaje: 'La fecha de salida no es válida' });
        continue;
      }
      if (fechaSalida !== null && fechaSalida.getTime() < fechaEntrada.getTime()) {
        errores.push({
          uuid: entrada.uuid,
          mensaje: 'La salida no puede ser anterior a la entrada',
        });
        continue;
      }

      const existente = await RegistroDomesticaModel.findOne({ uuid: entrada.uuid });

      if (existente === null) {
        if (!domestica.activo) {
          errores.push({ uuid: entrada.uuid, mensaje: 'La doméstica está inactiva' });
          continue;
        }
        if (fechaSalida === null) {
          const abierto = await RegistroDomesticaModel.findOne({
            barrioId,
            domesticaId: domestica._id,
            salidaEn: null,
          });
          if (abierto !== null) {
            errores.push({
              uuid: entrada.uuid,
              mensaje: 'La doméstica ya tiene una entrada abierta',
            });
            continue;
          }
        }

        const nuevo = new RegistroDomesticaModel({
          uuid: entrada.uuid,
          barrioId,
          domesticaId: domestica._id,
          loteId: lote._id,
          entradaEn: fechaEntrada,
          salidaEn: fechaSalida,
          descripcion: entrada.descripcion,
          registradoPor,
          creadoOffline: entrada.creadoOffline,
          syncRev: 1,
          actualizadoCliente: new Date(entrada.actualizadoEn),
        });
        await nuevo.save();
        aplicados.push(entrada.uuid);
        await registrarAuditoria({
          userId: registradoPor,
          accion: 'domestica.entrada',
          entidad: 'registros_domesticas',
          entidadId: nuevo._id.toString(),
          detalle: { domesticaUuid: domestica.uuid, loteUuid: lote.uuid },
        });
        continue;
      }

      if (existente.barrioId !== null && !existente.barrioId.equals(barrioId)) {
        errores.push({ uuid: entrada.uuid, mensaje: 'El registro pertenece a otro barrio' });
        continue;
      }

      const entrante = new Date(entrada.actualizadoEn).getTime();
      if (entrante <= existente.actualizadoCliente.getTime()) {
        duplicados.push(entrada.uuid);
        continue;
      }

      if (existente.salidaEn !== null && fechaSalida === null) {
        errores.push({ uuid: entrada.uuid, mensaje: 'No se puede reabrir un registro cerrado' });
        continue;
      }

      existente.domesticaId = domestica._id;
      existente.loteId = lote._id;
      existente.entradaEn = fechaEntrada;
      existente.salidaEn = fechaSalida;
      existente.descripcion = entrada.descripcion;
      existente.creadoOffline = entrada.creadoOffline;
      existente.barrioId ??= barrioId;
      existente.registradoPor ??= registradoPor;
      existente.syncRev += 1;
      existente.actualizadoCliente = new Date(entrada.actualizadoEn);
      await existente.save();
      aplicados.push(entrada.uuid);
      await registrarAuditoria({
        userId: registradoPor,
        accion: fechaSalida !== null ? 'domestica.salida' : 'domestica.actualizada',
        entidad: 'registros_domesticas',
        entidadId: existente._id.toString(),
        detalle: { domesticaUuid: domestica.uuid, loteUuid: lote.uuid },
      });
    } catch (error) {
      errores.push({
        uuid: entrada.uuid,
        mensaje: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return { aplicados, duplicados, errores };
}

/** Historial para el panel/admin (online). */
export async function listarRegistrosDomesticas(
  filtro: FiltroRegistrosDomesticas,
  barrioId: Types.ObjectId,
): Promise<readonly RegistroDomesticaDto[]> {
  const consulta: FilterQuery<RegistroDomestica> = { barrioId };

  if (filtro.estado === 'dentro') {
    consulta.salidaEn = null;
  } else if (filtro.estado === 'fuera') {
    consulta.salidaEn = { $ne: null };
  }

  const domesticaUuid = textoQuery(filtro.domestica);
  if (domesticaUuid !== null) {
    const domestica = await DomesticaModel.findOne({ uuid: domesticaUuid, barrioId });
    if (domestica === null) {
      return [];
    }
    consulta.domesticaId = domestica._id;
  }

  const loteTexto = textoQuery(filtro.lote);
  if (loteTexto !== null) {
    const lote = await LoteModel.findOne({
      barrioId,
      $or: [{ uuid: loteTexto }, { numero: loteTexto }],
    });
    if (lote === null) {
      return [];
    }
    consulta.loteId = lote._id;
  }

  const rango: { $gte?: Date; $lte?: Date } = {};
  const desde = textoQuery(filtro.desde);
  if (desde !== null) {
    const fecha = new Date(desde);
    if (!Number.isNaN(fecha.getTime())) {
      rango.$gte = fecha;
    }
  }
  const hasta = textoQuery(filtro.hasta);
  if (hasta !== null) {
    const fecha = new Date(hasta);
    if (!Number.isNaN(fecha.getTime())) {
      rango.$lte = fecha;
    }
  }
  if (rango.$gte !== undefined || rango.$lte !== undefined) {
    consulta.entradaEn = rango;
  }

  const texto = textoQuery(filtro.q);
  if (texto !== null) {
    const regex = new RegExp(escaparRegex(texto), 'i');
    const coincidencias = await DomesticaModel.find({
      barrioId,
      $or: [{ nombre: regex }, { apellido: regex }, { dni: regex }],
    }).select('_id');
    const ids = coincidencias.map((doc) => doc._id);
    if (ids.length > 0) {
      consulta.$or = [{ domesticaId: { $in: ids } }, { descripcion: regex }];
    } else {
      consulta.descripcion = regex;
    }
  }

  const limite = Math.min(Math.max(filtro.limite ?? 200, 1), 500);
  const registros = await RegistroDomesticaModel.find(consulta)
    .sort({ entradaEn: -1 })
    .limit(limite);

  if (registros.length === 0) {
    return [];
  }

  const domesticaIds = [
    ...new Set(registros.map((registro) => registro.domesticaId.toString())),
  ].map((id) => new Types.ObjectId(id));
  const loteIds = [...new Set(registros.map((registro) => registro.loteId.toString()))].map(
    (id) => new Types.ObjectId(id),
  );
  const [domesticas, lotes] = await Promise.all([
    DomesticaModel.find({ _id: { $in: domesticaIds } }),
    LoteModel.find({ _id: { $in: loteIds } }),
  ]);
  const domesticasPorId = new Map(domesticas.map((doc) => [doc._id.toString(), doc]));
  const lotesPorId = new Map(lotes.map((doc) => [doc._id.toString(), doc]));

  return registros.flatMap((registro) => {
    const domestica = domesticasPorId.get(registro.domesticaId.toString());
    const lote = lotesPorId.get(registro.loteId.toString());
    if (domestica === undefined || lote === undefined) {
      return [];
    }
    return [aRegistroDomesticaDto(registro, domestica, lote)];
  });
}

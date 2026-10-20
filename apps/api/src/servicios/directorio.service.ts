import { randomUUID } from 'node:crypto';

import type {
  BarrioDto,
  DirectorioPull,
  EliminadoDirectorio,
  FamiliarDto,
  FamiliarLocal,
  LoteDto,
  LoteLocal,
  PropietarioDto,
  PropietarioLocal,
  ResultadoImportacion,
  VehiculoDto,
  VehiculoLocal,
} from '@victoriasapp/shared';
import {
  dividirNombreCompleto,
  parsearCsvDirectorio,
  rangoTratamiento,
} from '@victoriasapp/shared';
import type { HydratedDocument, Types } from 'mongoose';

import { errorNoEncontrado } from '../lib/errores.js';

import {
  BarrioModel,
  EliminadoModel,
  FamiliarModel,
  LoteModel,
  PropietarioModel,
  VehiculoModel,
  type Barrio,
  type Familiar,
  type Lote,
  type Propietario,
  type Vehiculo,
} from '../models/directorio.modelos.js';

type BarrioDoc = HydratedDocument<Barrio>;
type LoteDoc = HydratedDocument<Lote>;
export type PropietarioDoc = HydratedDocument<Propietario>;
export type FamiliarDoc = HydratedDocument<Familiar>;
export type VehiculoDoc = HydratedDocument<Vehiculo>;

function idONull(valor: Types.ObjectId | null): string | null {
  return valor === null ? null : valor.toString();
}

// ---------------------------------------------------------------------------
// DTOs (ABM online)
// ---------------------------------------------------------------------------

export function aBarrioDto(doc: BarrioDoc): BarrioDto {
  return {
    id: doc._id.toString(),
    uuid: doc.uuid,
    nombre: doc.nombre,
    direccion: doc.direccion,
    activo: doc.activo,
    actualizadoEn: doc.updatedAt.toISOString(),
  };
}

export function aLoteDto(doc: LoteDoc): LoteDto {
  return {
    id: doc._id.toString(),
    uuid: doc.uuid,
    barrioId: idONull(doc.barrioId),
    numero: doc.numero,
    calle: doc.calle,
    notas: doc.notas,
    propietarioId: idONull(doc.propietarioId),
    actualizadoEn: doc.updatedAt.toISOString(),
  };
}

export function aPropietarioDto(doc: PropietarioDoc): PropietarioDto {
  return {
    id: doc._id.toString(),
    uuid: doc.uuid,
    barrioId: idONull(doc.barrioId),
    loteId: idONull(doc.loteId),
    nombre: doc.nombre,
    apellido: doc.apellido,
    tratamiento: doc.tratamiento,
    telefono: doc.telefono,
    email: doc.email,
    descripcion: doc.descripcion,
    activo: doc.activo,
    actualizadoEn: doc.updatedAt.toISOString(),
  };
}

export function aFamiliarDto(doc: FamiliarDoc): FamiliarDto {
  return {
    id: doc._id.toString(),
    uuid: doc.uuid,
    propietarioId: idONull(doc.propietarioId),
    loteId: idONull(doc.loteId),
    nombre: doc.nombre,
    parentesco: doc.parentesco,
    descripcion: doc.descripcion,
    activo: doc.activo,
    actualizadoEn: doc.updatedAt.toISOString(),
  };
}

export function aVehiculoDto(doc: VehiculoDoc): VehiculoDto {
  return {
    id: doc._id.toString(),
    uuid: doc.uuid,
    patente: doc.patente,
    marca: doc.marca,
    modelo: doc.modelo,
    color: doc.color,
    loteId: idONull(doc.loteId),
    propietarioIds: doc.propietarioIds.map((id) => id.toString()),
    familiarIds: doc.familiarIds.map((id) => id.toString()),
    descripcion: doc.descripcion,
    actualizadoEn: doc.updatedAt.toISOString(),
  };
}

/**
 * Orden jerárquico de los titulares de un lote: primero el señor, después la
 * señora y, a igualdad de tratamiento, por apellido y nombre.
 */
function compararPropietarios(a: PropietarioDoc, b: PropietarioDoc): number {
  const porTratamiento = rangoTratamiento(a.tratamiento) - rangoTratamiento(b.tratamiento);
  if (porTratamiento !== 0) {
    return porTratamiento;
  }
  const porApellido = a.apellido.localeCompare(b.apellido, 'es', {
    sensitivity: 'base',
    numeric: true,
  });
  return porApellido !== 0
    ? porApellido
    : a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base', numeric: true });
}

/**
 * Recalcula el titular principal (`Lote.propietarioId`) de todos los lotes del
 * barrio a partir de los propietarios asignados. La fuente de verdad es
 * `Propietario.loteId`; el espejo del lote queda ordenado por jerarquía para
 * que los consumidores viejos y el pull offline vean siempre al señor primero.
 *
 * Se llama después de crear/editar/borrar propietarios y al terminar una
 * importación, así no hay que repetir esta lógica en cada ruta.
 */
export async function recalcularTitularesDeBarrio(barrioId: Types.ObjectId): Promise<void> {
  const lotes = await LoteModel.find({ barrioId });
  if (lotes.length === 0) {
    return;
  }

  const loteIds = lotes.map((lote) => lote._id);
  const propietarios = await PropietarioModel.find({ loteId: { $in: loteIds } });
  const porLote = new Map<string, PropietarioDoc[]>();
  for (const propietario of propietarios) {
    if (propietario.loteId === null) {
      continue;
    }
    const clave = propietario.loteId.toString();
    const lista = porLote.get(clave) ?? [];
    lista.push(propietario);
    porLote.set(clave, lista);
  }

  for (const lote of lotes) {
    const titulares = porLote.get(lote._id.toString()) ?? [];
    titulares.sort(compararPropietarios);
    const principal = titulares[0]?._id ?? null;
    if (idONull(lote.propietarioId) === idONull(principal)) {
      continue;
    }
    // `updateOne` respeta `timestamps`, así el pull incremental incluye el lote.
    await LoteModel.updateOne({ _id: lote._id }, { $set: { propietarioId: principal } });
  }
}

// ---------------------------------------------------------------------------
// Pull incremental (offline)
// ---------------------------------------------------------------------------

function nombreCompleto(doc: PropietarioDoc): string {
  return `${doc.nombre} ${doc.apellido}`.trim();
}

/**
 * Devuelve lo cambiado desde `desde` (o todo si es `null`) **del barrio activo**,
 * ya "aplanado" a las proyecciones locales que cachea el PWA, con los nombres
 * resueltos para poder buscar sin conexión.
 *
 * El barrio se resuelve por pertenencia: un propietario entra si está asignado
 * al barrio o si su lote pertenece al barrio; familiares y vehículos entran por
 * cualquiera de sus referencias. Así también se recuperan datos viejos que
 * todavía no tenían `barrioId` propio.
 */
export async function pullDirectorio(
  desde: Date | null,
  barrioId: Types.ObjectId,
): Promise<DirectorioPull> {
  const ahora = new Date();

  const lotes = await LoteModel.find({ barrioId });
  const loteIds = lotes.map((doc) => doc._id);
  const propietarios = await PropietarioModel.find({
    $or: [{ barrioId }, { loteId: { $in: loteIds } }],
  });
  const propietarioIds = propietarios.map((doc) => doc._id);
  const familiares = await FamiliarModel.find({
    $or: [{ loteId: { $in: loteIds } }, { propietarioId: { $in: propietarioIds } }],
  });
  const familiarIds = familiares.map((doc) => doc._id);

  const [vehiculos, eliminados] = await Promise.all([
    VehiculoModel.find({
      $or: [
        { loteId: { $in: loteIds } },
        { propietarioIds: { $in: propietarioIds } },
        { familiarIds: { $in: familiarIds } },
        // Datos viejos con una sola referencia.
        { propietarioId: { $in: propietarioIds } },
        { familiarId: { $in: familiarIds } },
      ],
    }),
    EliminadoModel.find(),
  ]);

  const propietariosPorId = new Map<string, PropietarioDoc>(
    propietarios.map((doc) => [doc._id.toString(), doc]),
  );
  const familiaresPorId = new Map<string, FamiliarDoc>(
    familiares.map((doc) => [doc._id.toString(), doc]),
  );
  const lotesPorId = new Map<string, LoteDoc>(lotes.map((doc) => [doc._id.toString(), doc]));

  const titularesPorLote = new Map<string, PropietarioDoc[]>();
  for (const doc of propietarios) {
    if (doc.loteId === null) {
      continue;
    }
    const clave = doc.loteId.toString();
    const lista = titularesPorLote.get(clave) ?? [];
    lista.push(doc);
    titularesPorLote.set(clave, lista);
  }
  for (const lista of titularesPorLote.values()) {
    lista.sort(compararPropietarios);
  }

  const cambio = (doc: { updatedAt: Date }): boolean =>
    desde === null || doc.updatedAt.getTime() > desde.getTime();

  const aLoteLocal = (doc: LoteDoc): LoteLocal => {
    const titulares = titularesPorLote.get(doc._id.toString()) ?? [];
    const principal =
      doc.propietarioId === null
        ? null
        : (propietariosPorId.get(doc.propietarioId.toString()) ?? null);
    const propietarioNombre =
      titulares.length > 0
        ? titulares.map(nombreCompleto).join(' / ')
        : principal === null
          ? null
          : nombreCompleto(principal);
    return {
      uuid: doc.uuid,
      numero: doc.numero,
      calle: doc.calle,
      propietarioNombre,
      actualizadoEn: doc.updatedAt.toISOString(),
    };
  };

  const aPropietarioLocal = (doc: PropietarioDoc): PropietarioLocal => {
    const lote = doc.loteId === null ? null : (lotesPorId.get(doc.loteId.toString()) ?? null);
    return {
      uuid: doc.uuid,
      nombre: doc.nombre,
      apellido: doc.apellido,
      tratamiento: doc.tratamiento,
      telefono: doc.telefono,
      email: doc.email,
      descripcion: doc.descripcion,
      loteNumero: lote?.numero ?? null,
      actualizadoEn: doc.updatedAt.toISOString(),
    };
  };

  const aFamiliarLocal = (doc: FamiliarDoc): FamiliarLocal => {
    const propietario =
      doc.propietarioId === null
        ? null
        : (propietariosPorId.get(doc.propietarioId.toString()) ?? null);
    const loteId = doc.loteId ?? propietario?.loteId ?? null;
    const lote = loteId === null ? null : (lotesPorId.get(loteId.toString()) ?? null);
    return {
      uuid: doc.uuid,
      nombre: doc.nombre,
      parentesco: doc.parentesco,
      propietarioNombre: propietario === null ? '' : nombreCompleto(propietario),
      loteNumero: lote?.numero ?? null,
      actualizadoEn: doc.updatedAt.toISOString(),
    };
  };

  const aVehiculoLocal = (doc: VehiculoDoc): VehiculoLocal => {
    // Soportamos documentos nuevos (listas) y viejos (referencia singular).
    const propietarios = (
      doc.propietarioIds.length
        ? doc.propietarioIds
        : doc.propietarioId === null
          ? []
          : [doc.propietarioId]
    )
      .map((id) => propietariosPorId.get(id.toString()) ?? null)
      .filter((propietario): propietario is PropietarioDoc => propietario !== null)
      .sort(compararPropietarios);
    const familiares = (
      doc.familiarIds.length ? doc.familiarIds : doc.familiarId === null ? [] : [doc.familiarId]
    )
      .map((id) => familiaresPorId.get(id.toString()) ?? null)
      .filter((familiar): familiar is FamiliarDoc => familiar !== null);

    const usuariosNombres = [
      ...propietarios.map(nombreCompleto),
      ...familiares.map((familiar) => familiar.nombre),
    ];
    const propietarioDelFamiliar = familiares[0]?.propietarioId;
    const propietario =
      propietarios[0] ??
      (propietarioDelFamiliar === null || propietarioDelFamiliar === undefined
        ? null
        : (propietariosPorId.get(propietarioDelFamiliar.toString()) ?? null));
    const loteId =
      doc.loteId ?? propietarios[0]?.loteId ?? familiares[0]?.loteId ?? propietario?.loteId ?? null;
    const lote = loteId === null ? null : (lotesPorId.get(loteId.toString()) ?? null);
    return {
      uuid: doc.uuid,
      patente: doc.patente,
      marca: doc.marca,
      modelo: doc.modelo,
      color: doc.color,
      usuariosNombres,
      propietarioNombre: usuariosNombres[0] ?? null,
      loteNumero: lote?.numero ?? null,
      actualizadoEn: doc.updatedAt.toISOString(),
    };
  };

  const eliminadosFiltrados: EliminadoDirectorio[] = eliminados
    .filter((doc) => desde === null || doc.eliminadoEn.getTime() > desde.getTime())
    .map((doc) => ({ entidad: doc.entidad, uuid: doc.uuid }));

  return {
    desde: ahora.toISOString(),
    lotes: lotes.filter(cambio).map(aLoteLocal),
    propietarios: propietarios.filter(cambio).map(aPropietarioLocal),
    familiares: familiares.filter(cambio).map(aFamiliarLocal),
    vehiculos: vehiculos.filter(cambio).map(aVehiculoLocal),
    eliminados: eliminadosFiltrados,
  };
}

// ---------------------------------------------------------------------------
// Importador CSV
// ---------------------------------------------------------------------------

async function asegurarLote(barrioId: Types.ObjectId, numero: string): Promise<LoteDoc> {
  const existente = await LoteModel.findOne({ barrioId, numero });
  if (existente !== null) {
    return existente;
  }
  return await LoteModel.create({ uuid: randomUUID(), barrioId, numero, activo: true });
}

async function asegurarVehiculo(
  patente: string,
  propietarioId: Types.ObjectId,
  loteId: Types.ObjectId,
  descripcion: string | null,
): Promise<void> {
  const existente = await VehiculoModel.findOne({ patente });
  if (existente === null) {
    await VehiculoModel.create({
      uuid: randomUUID(),
      patente,
      loteId,
      propietarioIds: [propietarioId],
      familiarIds: [],
      propietarioId,
      familiarId: null,
      descripcion,
      activo: true,
    });
    return;
  }
  let cambio = false;
  if (!existente.propietarioIds.some((id) => id.equals(propietarioId))) {
    existente.propietarioIds = [...existente.propietarioIds, propietarioId];
    cambio = true;
  }
  if (existente.propietarioId === null) {
    existente.propietarioId = propietarioId;
    cambio = true;
  }
  if (existente.loteId?.toString() !== loteId.toString()) {
    existente.loteId = loteId;
    cambio = true;
  }
  if (descripcion !== null && existente.descripcion !== descripcion) {
    existente.descripcion = descripcion;
    cambio = true;
  }
  if (cambio) {
    await existente.save();
  }
}

async function asegurarFamiliar(
  propietarioId: Types.ObjectId,
  loteId: Types.ObjectId,
  nombre: string,
  parentesco: string | null,
): Promise<void> {
  const existente = await FamiliarModel.findOne({ propietarioId, nombre });
  if (existente === null) {
    await FamiliarModel.create({
      uuid: randomUUID(),
      propietarioId,
      loteId,
      nombre,
      parentesco,
      activo: true,
    });
    return;
  }
  let cambio = false;
  if (existente.loteId?.toString() !== loteId.toString()) {
    existente.loteId = loteId;
    cambio = true;
  }
  if (parentesco !== null && existente.parentesco !== parentesco) {
    existente.parentesco = parentesco;
    cambio = true;
  }
  if (cambio) {
    await existente.save();
  }
}

/**
 * Importa un CSV de directorio. Es idempotente por claves naturales (barrio,
 * lote, propietario por nombre+apellido, vehículo por patente, familiar por
 * nombre dentro del propietario), así que se puede repetir sin duplicar.
 *
 * `creados`/`actualizados` cuentan propietarios nuevos vs. ya existentes.
 */
export async function importarDirectorio(
  barrioId: Types.ObjectId,
  csv: string,
): Promise<ResultadoImportacion> {
  const { filas, errores } = parsearCsvDirectorio(csv);
  const erroresAcumulados = [...errores];
  const barrio = await BarrioModel.findById(barrioId);
  if (barrio === null) {
    throw errorNoEncontrado('Barrio no encontrado');
  }

  let creados = 0;
  let actualizados = 0;

  for (const fila of filas) {
    try {
      const { nombre, apellido } = dividirNombreCompleto(fila.propietario);
      if (nombre === '' || apellido === '') {
        erroresAcumulados.push({ fila: fila.fila, mensaje: 'Nombre de propietario inválido' });
        continue;
      }

      const lote = await asegurarLote(barrio._id, fila.lote);

      const existente = await PropietarioModel.findOne({
        barrioId: barrio._id,
        nombre,
        apellido,
      });

      let propietario: PropietarioDoc;
      if (existente === null) {
        propietario = await PropietarioModel.create({
          uuid: randomUUID(),
          barrioId: barrio._id,
          loteId: lote._id,
          nombre,
          apellido,
          tratamiento: fila.tratamiento,
          telefono: fila.telefono,
          email: null,
          descripcion: fila.descripcion,
          activo: true,
        });
        creados += 1;
      } else {
        propietario = existente;
        if (propietario.loteId?.toString() !== lote._id.toString()) {
          propietario.loteId = lote._id;
        }
        if (fila.tratamiento !== null) {
          propietario.tratamiento = fila.tratamiento;
        }
        if (fila.telefono !== null) {
          propietario.telefono = fila.telefono;
        }
        if (fila.descripcion !== null) {
          propietario.descripcion = fila.descripcion;
        }
        await propietario.save();
        actualizados += 1;
      }

      if (fila.patente !== null) {
        await asegurarVehiculo(fila.patente, propietario._id, lote._id, fila.descripcion);
      }

      if (fila.familiar !== null) {
        await asegurarFamiliar(propietario._id, lote._id, fila.familiar, fila.parentesco);
      }
    } catch (error) {
      erroresAcumulados.push({
        fila: fila.fila,
        mensaje: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  // Los lotes pueden haber quedado con varios titulares: dejamos el espejo
  // `propietarioId` ordenado por jerarquía (señor, señora, …).
  await recalcularTitularesDeBarrio(barrio._id);

  return {
    barrio: barrio.nombre,
    filas: filas.length,
    creados,
    actualizados,
    errores: erroresAcumulados,
  };
}

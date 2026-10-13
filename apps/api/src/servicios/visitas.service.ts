import type { ResultadoSync, UsuarioPublico, VisitaDto, VisitaSync } from '@victoriasapp/shared';
import { Types, type HydratedDocument } from 'mongoose';

import type { Visita } from '../models/visita.model.js';
import { VisitaModel } from '../models/visita.model.js';
import { publicar } from '../tiempo-real/bus.js';

export type VisitaDoc = HydratedDocument<Visita>;

export function aVisitaDto(doc: VisitaDoc): VisitaDto {
  return {
    id: doc._id.toString(),
    uuid: doc.uuid,
    tipo: doc.tipo,
    apellido: doc.apellido,
    nombre: doc.nombre,
    dni: doc.dni,
    fechaNacimiento: doc.fechaNacimiento,
    sexo: doc.sexo,
    formatoDocumento: doc.formatoDocumento,
    documentoRaw: doc.documentoRaw,
    patente: doc.patente,
    loteNumero: doc.loteNumero,
    propietarioNombre: doc.propietarioNombre,
    motivo: doc.motivo,
    acompanantes: doc.acompanantes,
    entradaEn: doc.entradaEn.toISOString(),
    salidaEn: doc.salidaEn === null ? null : doc.salidaEn.toISOString(),
    creadoOffline: doc.creadoOffline,
    syncRev: doc.syncRev,
    actualizadoEn: doc.updatedAt.toISOString(),
  };
}

function fecha(valor: string | null): Date | null {
  return valor === null ? null : new Date(valor);
}

function asignarCampos(doc: VisitaDoc, entrada: VisitaSync): void {
  doc.tipo = entrada.tipo;
  doc.apellido = entrada.apellido;
  doc.nombre = entrada.nombre;
  doc.dni = entrada.dni;
  doc.fechaNacimiento = entrada.fechaNacimiento;
  doc.sexo = entrada.sexo;
  doc.formatoDocumento = entrada.formatoDocumento;
  doc.documentoRaw = entrada.documentoRaw;
  doc.patente = entrada.patente;
  doc.loteNumero = entrada.loteNumero;
  doc.propietarioNombre = entrada.propietarioNombre;
  doc.motivo = entrada.motivo;
  doc.acompanantes = entrada.acompanantes;
  doc.entradaEn = new Date(entrada.entradaEn);
  doc.salidaEn = fecha(entrada.salidaEn);
  doc.creadoOffline = entrada.creadoOffline;
}

/**
 * Aplica un lote de visitas creadas offline. Idempotente por `uuid`.
 *
 * - `uuid` nuevo → se crea (`aplicados`).
 * - `uuid` existente con datos más nuevos → se actualiza (`aplicados`).
 * - `uuid` existente con datos viejos o iguales → no se toca (`duplicados`).
 */
export async function aplicarSyncVisitas(
  visitas: readonly VisitaSync[],
  usuario: UsuarioPublico,
): Promise<ResultadoSync> {
  const aplicados: string[] = [];
  const duplicados: string[] = [];
  const errores: { uuid: string; mensaje: string }[] = [];
  const guardiaId = Types.ObjectId.isValid(usuario.id) ? new Types.ObjectId(usuario.id) : null;

  for (const entrada of visitas) {
    try {
      const existente = await VisitaModel.findOne({ uuid: entrada.uuid });
      if (existente === null) {
        const nuevo = new VisitaModel({ uuid: entrada.uuid, guardiaId, syncRev: 1 });
        asignarCampos(nuevo, entrada);
        await nuevo.save();
        aplicados.push(entrada.uuid);
        publicar('visita:creada', { visita: aVisitaDto(nuevo) });
        continue;
      }

      const entrante = new Date(entrada.actualizadoEn).getTime();
      if (entrante > existente.updatedAt.getTime()) {
        asignarCampos(existente, entrada);
        existente.syncRev += 1;
        await existente.save();
        aplicados.push(entrada.uuid);
        publicar('visita:actualizada', { visita: aVisitaDto(existente) });
      } else {
        duplicados.push(entrada.uuid);
      }
    } catch (error) {
      errores.push({
        uuid: entrada.uuid,
        mensaje: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  return { aplicados, duplicados, errores };
}

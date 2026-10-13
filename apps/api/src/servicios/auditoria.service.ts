import type { Types } from 'mongoose';

import { AuditLogModel } from '../models/audit-log.model.js';

export interface EntradaAuditoria {
  readonly userId?: Types.ObjectId | null;
  readonly accion: string;
  readonly entidad?: string | null;
  readonly entidadId?: string | null;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
  readonly detalle?: Record<string, unknown> | null;
}

/** Registra un evento de auditoría. Nunca debe tumbar la operación principal. */
export async function registrarAuditoria(entrada: EntradaAuditoria): Promise<void> {
  try {
    await AuditLogModel.create({
      userId: entrada.userId ?? null,
      accion: entrada.accion,
      entidad: entrada.entidad ?? null,
      entidadId: entrada.entidadId ?? null,
      ip: entrada.ip ?? null,
      userAgent: entrada.userAgent ?? null,
      detalle: entrada.detalle ?? null,
    });
  } catch (error) {
    console.error('[audit] no se pudo registrar:', error);
  }
}

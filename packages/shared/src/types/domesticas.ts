import { z } from 'zod';

import { normalizarNumeroDni } from '../dni/normalizar.js';
import type { EstadoSync } from './visita.js';

/**
 * Personal doméstico: personas que trabajan en uno o más lotes del barrio.
 *
 * El perfil es persistente y se cachea offline con el resto del directorio.
 * Cada entrada/salida es un `RegistroDomestica` independiente.
 */

export interface DomesticaLocal {
  readonly uuid: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly dni: string;
  readonly telefono: string | null;
  /** Lote donde trabaja habitualmente. */
  readonly lotePrincipalUuid: string | null;
  /** Otros lotes donde suele trabajar (sin incluir el principal). */
  readonly lotesHabituales: readonly string[];
  readonly activo: boolean;
  readonly notas: string | null;
  readonly actualizadoEn: string;
}

export interface RegistroDomesticaLocal {
  readonly uuid: string;
  readonly domesticaUuid: string;
  /** Lote real de ese día. */
  readonly loteUuid: string;
  readonly entradaEn: string;
  readonly salidaEn: string | null;
  readonly descripcion: string | null;
  readonly creadoOffline: boolean;
  readonly estadoSync: EstadoSync;
  readonly intentosSync: number;
  readonly ultimoErrorSync: string | null;
  readonly creadoEn: string;
  readonly actualizadoEn: string;
}

/** Perfil tal como lo devuelve la API. */
export interface DomesticaDto {
  readonly id: string;
  readonly uuid: string;
  readonly barrioId: string | null;
  readonly nombre: string;
  readonly apellido: string;
  readonly dni: string;
  readonly telefono: string | null;
  readonly lotePrincipalUuid: string | null;
  readonly lotesHabituales: readonly string[];
  readonly activo: boolean;
  readonly notas: string | null;
  readonly actualizadoEn: string;
}

/** Registro de entrada/salida tal como lo devuelve la API. */
export interface RegistroDomesticaDto {
  readonly id: string;
  readonly uuid: string;
  readonly domesticaId: string;
  readonly domesticaUuid: string;
  readonly domesticaNombre: string;
  readonly domesticaDni: string;
  readonly loteId: string;
  readonly loteUuid: string;
  readonly loteNumero: string;
  readonly entradaEn: string;
  readonly salidaEn: string | null;
  readonly descripcion: string | null;
  readonly creadoOffline: boolean;
  readonly barrioId: string | null;
  readonly syncRev: number;
  readonly actualizadoEn: string;
}

const RE_DNI = /^\d{7,8}$/;
const uuidRef = z.string().trim().min(1).max(80);
const uuidRefs = z.array(uuidRef).max(50);

const dniSchema = z
  .string()
  .trim()
  .transform((valor) => normalizarNumeroDni(valor))
  .refine((valor) => RE_DNI.test(valor), 'DNI inválido (7 u 8 dígitos)');

const textoOpcional = (max: number): z.ZodNullable<z.ZodString> =>
  z.string().trim().max(max).nullable();

export const esquemaCrearDomestica = z.object({
  uuid: uuidRef.optional(),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  apellido: z.string().trim().min(1, 'El apellido es obligatorio').max(120),
  dni: dniSchema,
  telefono: textoOpcional(40).default(null),
  lotePrincipalUuid: uuidRef,
  lotesHabituales: uuidRefs.default([]),
  activo: z.boolean().default(true),
  notas: textoOpcional(400).default(null),
});
export type CrearDomestica = z.infer<typeof esquemaCrearDomestica>;

export const esquemaActualizarDomestica = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  apellido: z.string().trim().min(1).max(120).optional(),
  dni: dniSchema.optional(),
  telefono: textoOpcional(40).optional(),
  lotePrincipalUuid: uuidRef.optional(),
  lotesHabituales: uuidRefs.optional(),
  activo: z.boolean().optional(),
  notas: textoOpcional(400).optional(),
});
export type ActualizarDomestica = z.infer<typeof esquemaActualizarDomestica>;

/** Registro que viaja al servidor en `POST /api/sync`. */
export const esquemaRegistroDomesticaSync = z.object({
  uuid: uuidRef,
  domesticaUuid: uuidRef,
  loteUuid: uuidRef,
  entradaEn: z.string().datetime(),
  salidaEn: z.string().datetime().nullable().default(null),
  descripcion: textoOpcional(400).default(null),
  creadoOffline: z.boolean().default(true),
  actualizadoEn: z.string().datetime(),
});
export type RegistroDomesticaSync = z.infer<typeof esquemaRegistroDomesticaSync>;

/** Filtros del historial (`GET /api/domesticas/registros`). */
export interface FiltroRegistrosDomesticas {
  readonly q?: string | undefined;
  readonly estado?: 'dentro' | 'fuera' | undefined;
  readonly lote?: string | undefined;
  readonly domestica?: string | undefined;
  /** ISO (inclusive). */
  readonly desde?: string | undefined;
  /** ISO (inclusive). */
  readonly hasta?: string | undefined;
  readonly limite?: number | undefined;
}

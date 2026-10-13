/**
 * Tipos y validaciones de una **visita** (ingreso/egreso) al barrio.
 *
 * El tipo `NuevaVisita` es lo que completa el formulario. `Visita` es el registro
 * ya guardado localmente (offline-first), con su `uuid` de idempotencia y su
 * estado de sincronización.
 */

import { z } from 'zod';
import { FORMATOS_DNI, SEXOS, TIPOS_VISITA } from './dominio.js';

export const ESTADOS_SYNC = ['pendiente', 'sincronizada', 'error'] as const;
export type EstadoSync = (typeof ESTADOS_SYNC)[number];

const RE_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Esquema de validación de una visita nueva (compartido front/back). */
export const esquemaNuevaVisita = z.object({
  tipo: z.enum(TIPOS_VISITA),

  apellido: z.string().trim().min(1, 'El apellido es obligatorio').max(80),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(80),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, 'DNI inválido (7 u 8 dígitos)'),
  fechaNacimiento: z.string().regex(RE_FECHA_ISO, 'Fecha inválida').nullable().default(null),
  sexo: z.enum(SEXOS).nullable().default(null),
  formatoDocumento: z.enum(FORMATOS_DNI).default('manual'),
  documentoRaw: z.string().max(4000).nullable().default(null),

  patente: z.string().trim().max(10).nullable().default(null),
  loteNumero: z.string().trim().max(20).nullable().default(null),
  propietarioNombre: z.string().trim().max(160).nullable().default(null),
  motivo: z.string().trim().max(200).nullable().default(null),
  acompanantes: z.number().int().min(0).max(50).default(0),

  /** Fecha y hora de entrada, ISO 8601 (con `Z`). */
  entradaEn: z.string().datetime(),
});

/** Datos que completa el formulario (con defaults aplicados). */
export type NuevaVisita = z.infer<typeof esquemaNuevaVisita>;

/** Datos tal como los recibe el formulario (defaults opcionales). */
export type NuevaVisitaInput = z.input<typeof esquemaNuevaVisita>;

/** Esquema para marcar la salida. */
export const esquemaSalidaVisita = z.object({
  salidaEn: z.string().datetime(),
});
export type SalidaVisita = z.infer<typeof esquemaSalidaVisita>;

/** Registro de visita guardado localmente (offline-first). */
export type Visita = NuevaVisita & {
  readonly uuid: string;
  readonly salidaEn: string | null;
  readonly creadoOffline: boolean;
  readonly estadoSync: EstadoSync;
  readonly intentosSync: number;
  readonly ultimoErrorSync: string | null;
  /** ISO de creación local. */
  readonly creadoEn: string;
  /** ISO de última modificación local. */
  readonly actualizadoEn: string;
};

/** Una visita está "abierta" mientras no tenga salida. */
export function visitaAbierta(visita: Pick<Visita, 'salidaEn'>): boolean {
  return visita.salidaEn === null;
}

/**
 * Visita tal como viaja al servidor en `POST /api/sync`.
 * Es el subconjunto relevante de `Visita` (sin estado de sync local).
 */
export const esquemaVisitaSync = z.object({
  uuid: z.string().trim().min(1).max(80),
  tipo: z.enum(TIPOS_VISITA),
  apellido: z.string().trim().min(1).max(80),
  nombre: z.string().trim().min(1).max(80),
  dni: z
    .string()
    .trim()
    .regex(/^\d{7,8}$/, 'DNI inválido (7 u 8 dígitos)'),
  fechaNacimiento: z.string().regex(RE_FECHA_ISO, 'Fecha inválida').nullable().default(null),
  sexo: z.enum(SEXOS).nullable().default(null),
  formatoDocumento: z.enum(FORMATOS_DNI).default('manual'),
  documentoRaw: z.string().max(4000).nullable().default(null),
  patente: z.string().trim().max(10).nullable().default(null),
  loteNumero: z.string().trim().max(20).nullable().default(null),
  propietarioNombre: z.string().trim().max(160).nullable().default(null),
  motivo: z.string().trim().max(200).nullable().default(null),
  acompanantes: z.number().int().min(0).max(50).default(0),
  entradaEn: z.string().datetime(),
  salidaEn: z.string().datetime().nullable().default(null),
  creadoOffline: z.boolean().default(true),
  actualizadoEn: z.string().datetime(),
});
export type VisitaSync = z.infer<typeof esquemaVisitaSync>;

/** Convierte una visita local (PWA) al formato que espera la API. */
export function aVisitaSync(visita: Visita): VisitaSync {
  return {
    uuid: visita.uuid,
    tipo: visita.tipo,
    apellido: visita.apellido,
    nombre: visita.nombre,
    dni: visita.dni,
    fechaNacimiento: visita.fechaNacimiento,
    sexo: visita.sexo,
    formatoDocumento: visita.formatoDocumento,
    documentoRaw: visita.documentoRaw,
    patente: visita.patente,
    loteNumero: visita.loteNumero,
    propietarioNombre: visita.propietarioNombre,
    motivo: visita.motivo,
    acompanantes: visita.acompanantes,
    entradaEn: visita.entradaEn,
    salidaEn: visita.salidaEn,
    creadoOffline: visita.creadoOffline,
    actualizadoEn: visita.actualizadoEn,
  };
}

/**
 * Genera un identificador único en el cliente (`crypto.randomUUID`).
 * Se usa como `uuid` de idempotencia para el sync.
 */
export function crearIdLocal(): string {
  const contenedor = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  const uuid = contenedor.crypto?.randomUUID;
  if (typeof uuid === 'function') {
    return uuid.call(contenedor.crypto);
  }
  // Respaldo si el entorno no expone `crypto` (no criptográfico, sólo emergencia).
  const aleatorio = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${aleatorio}`;
}

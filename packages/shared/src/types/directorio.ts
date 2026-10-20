/**
 * Tipos del **directorio** del barrio.
 *
 * Hay dos familias de tipos:
 *  - **Proyecciones locales** (`LoteLocal`, `PropietarioLocal`, …): lo que el PWA
 *    cachea en IndexedDB para buscar **sin red**. Traen los nombres
 *    desnormalizados (`propietarioNombre`, `loteNumero`) para evitar joins.
 *  - **Entidades de la API** (`LoteDto`, `PropietarioDto`, …): lo que devuelve la
 *    API en el ABM, con ids y referencias.
 *
 * Ver docs/09-directorio-barrio.md.
 */

import { z } from 'zod';
import type { ErrorImportacion } from '../directorio/csv.js';
import {
  TRATAMIENTOS_PROPIETARIO,
  type TratamientoPropietario,
} from '../directorio/tratamiento.js';
import { normalizarPatente } from '../dni/normalizar.js';
import type { RolUsuario } from './dominio.js';

// ---------------------------------------------------------------------------
// Proyecciones locales (caché offline del PWA)
// ---------------------------------------------------------------------------

export interface LoteLocal {
  readonly uuid: string;
  readonly numero: string;
  readonly calle: string | null;
  readonly propietarioNombre: string | null;
  readonly actualizadoEn: string;
}

export interface PropietarioLocal {
  readonly uuid: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly tratamiento: TratamientoPropietario | null;
  readonly telefono: string | null;
  readonly email: string | null;
  readonly descripcion: string | null;
  readonly loteNumero: string | null;
  readonly actualizadoEn: string;
}

export interface FamiliarLocal {
  readonly uuid: string;
  readonly nombre: string;
  readonly parentesco: string | null;
  readonly propietarioNombre: string;
  readonly loteNumero: string | null;
  readonly actualizadoEn: string;
}

export interface VehiculoLocal {
  readonly uuid: string;
  readonly patente: string;
  readonly marca: string | null;
  readonly modelo: string | null;
  readonly color: string | null;
  readonly propietarioNombre: string | null;
  readonly loteNumero: string | null;
  readonly actualizadoEn: string;
}

/** Datos de sesión recordados en el dispositivo. */
export interface SesionLocal {
  /** Nombre de usuario; es la clave primaria de la tabla `sesion`. */
  readonly usuario: string;
  readonly id: string;
  readonly nombre: string;
  readonly rol: RolUsuario;
  readonly garitaId: string | null;
  /** Barrio en el que trabaja esta cuenta (se elige al iniciar sesión). */
  readonly barrioId: string | null;
  readonly barrioNombre: string | null;
  readonly accessToken: string;
  /** Vencimiento del access token, en ISO. */
  readonly expiraEn: string;
  /** Momento en que se guardó la sesión (ISO); permite elegir la más reciente. */
  readonly guardadaEn?: string;
}

/** Metadatos locales (última sync, versión de esquema). */
export interface MetaLocal {
  readonly clave: string;
  readonly valor: string;
}

/** Clave de `meta` donde se guarda la fecha del último pull del directorio. */
export const META_ULTIMA_SYNC_DIRECTORIO = 'directorio.ultimaSync';

// ---------------------------------------------------------------------------
// Entidades del directorio (API)
// ---------------------------------------------------------------------------

export const ENTIDADES_DIRECTORIO = [
  'barrio',
  'lote',
  'propietario',
  'familiar',
  'vehiculo',
] as const;
export type EntidadDirectorio = (typeof ENTIDADES_DIRECTORIO)[number];

const RE_PATENTE = /^[A-Z0-9]{5,8}$/;

/** Patente obligatoria, normalizada (mayúsculas, sin espacios ni guiones). */
export const esquemaPatente = z
  .string()
  .transform((valor) => normalizarPatente(valor))
  .refine((valor) => RE_PATENTE.test(valor), 'Patente inválida');

const textoOpcional = (max: number): z.ZodNullable<z.ZodString> =>
  z.string().trim().max(max).nullable();
const uuidCliente = z.string().trim().min(1).max(80);

/** Barrio cerrado. */
export interface BarrioDto {
  readonly id: string;
  readonly uuid: string;
  readonly nombre: string;
  readonly direccion: string | null;
  readonly activo: boolean;
  readonly actualizadoEn: string;
}

export const esquemaCrearBarrio = z.object({
  uuid: uuidCliente.optional(),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  direccion: textoOpcional(200).default(null),
  activo: z.boolean().default(true),
});
export type CrearBarrio = z.infer<typeof esquemaCrearBarrio>;

export const esquemaActualizarBarrio = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  direccion: textoOpcional(200).optional(),
  activo: z.boolean().optional(),
});
export type ActualizarBarrio = z.infer<typeof esquemaActualizarBarrio>;

const idReferencia = z.string().trim().min(1).nullable();

/** Lote / parcela. */
export interface LoteDto {
  readonly id: string;
  readonly uuid: string;
  readonly barrioId: string | null;
  readonly numero: string;
  readonly calle: string | null;
  readonly notas: string | null;
  readonly propietarioId: string | null;
  readonly actualizadoEn: string;
}

export const esquemaCrearLote = z.object({
  uuid: uuidCliente.optional(),
  barrioId: idReferencia.default(null),
  numero: z.string().trim().min(1, 'El número de lote es obligatorio').max(20),
  calle: textoOpcional(120).default(null),
  notas: textoOpcional(400).default(null),
  propietarioId: idReferencia.default(null),
});
export type CrearLote = z.infer<typeof esquemaCrearLote>;

export const esquemaActualizarLote = z.object({
  barrioId: idReferencia.optional(),
  numero: z.string().trim().min(1).max(20).optional(),
  calle: textoOpcional(120).optional(),
  notas: textoOpcional(400).optional(),
  propietarioId: idReferencia.optional(),
});
export type ActualizarLote = z.infer<typeof esquemaActualizarLote>;

/** Propietario (titular). */
export interface PropietarioDto {
  readonly id: string;
  readonly uuid: string;
  readonly barrioId: string | null;
  readonly loteId: string | null;
  readonly nombre: string;
  readonly apellido: string;
  readonly tratamiento: TratamientoPropietario | null;
  readonly telefono: string | null;
  readonly email: string | null;
  readonly descripcion: string | null;
  readonly activo: boolean;
  readonly actualizadoEn: string;
}

export const esquemaCrearPropietario = z.object({
  uuid: uuidCliente.optional(),
  barrioId: idReferencia.default(null),
  loteId: idReferencia.default(null),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  apellido: z.string().trim().min(1, 'El apellido es obligatorio').max(120),
  tratamiento: z.enum(TRATAMIENTOS_PROPIETARIO).nullable().default(null),
  telefono: textoOpcional(40).default(null),
  email: textoOpcional(160).default(null),
  descripcion: textoOpcional(400).default(null),
  activo: z.boolean().default(true),
});
export type CrearPropietario = z.infer<typeof esquemaCrearPropietario>;

export const esquemaActualizarPropietario = z.object({
  barrioId: idReferencia.optional(),
  loteId: idReferencia.optional(),
  nombre: z.string().trim().min(1).max(120).optional(),
  apellido: z.string().trim().min(1).max(120).optional(),
  tratamiento: z.enum(TRATAMIENTOS_PROPIETARIO).nullable().optional(),
  telefono: textoOpcional(40).optional(),
  email: textoOpcional(160).optional(),
  descripcion: textoOpcional(400).optional(),
  activo: z.boolean().optional(),
});
export type ActualizarPropietario = z.infer<typeof esquemaActualizarPropietario>;

/** Familiar de un propietario (hijo, cónyuge, …). */
export interface FamiliarDto {
  readonly id: string;
  readonly uuid: string;
  readonly propietarioId: string | null;
  readonly loteId: string | null;
  readonly nombre: string;
  readonly parentesco: string | null;
  readonly descripcion: string | null;
  readonly activo: boolean;
  readonly actualizadoEn: string;
}

export const esquemaCrearFamiliar = z.object({
  uuid: uuidCliente.optional(),
  propietarioId: idReferencia.default(null),
  loteId: idReferencia.default(null),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(160),
  parentesco: textoOpcional(60).default(null),
  descripcion: textoOpcional(400).default(null),
  activo: z.boolean().default(true),
});
export type CrearFamiliar = z.infer<typeof esquemaCrearFamiliar>;

export const esquemaActualizarFamiliar = z.object({
  propietarioId: idReferencia.optional(),
  loteId: idReferencia.optional(),
  nombre: z.string().trim().min(1).max(160).optional(),
  parentesco: textoOpcional(60).optional(),
  descripcion: textoOpcional(400).optional(),
  activo: z.boolean().optional(),
});
export type ActualizarFamiliar = z.infer<typeof esquemaActualizarFamiliar>;

/** Vehículo del barrio. */
export interface VehiculoDto {
  readonly id: string;
  readonly uuid: string;
  readonly patente: string;
  readonly marca: string | null;
  readonly modelo: string | null;
  readonly color: string | null;
  readonly propietarioId: string | null;
  readonly familiarId: string | null;
  readonly loteId: string | null;
  readonly descripcion: string | null;
  readonly actualizadoEn: string;
}

export const esquemaCrearVehiculo = z.object({
  uuid: uuidCliente.optional(),
  patente: esquemaPatente,
  marca: textoOpcional(60).default(null),
  modelo: textoOpcional(60).default(null),
  color: textoOpcional(40).default(null),
  propietarioId: idReferencia.default(null),
  familiarId: idReferencia.default(null),
  loteId: idReferencia.default(null),
  descripcion: textoOpcional(400).default(null),
});
export type CrearVehiculo = z.infer<typeof esquemaCrearVehiculo>;

export const esquemaActualizarVehiculo = z.object({
  patente: esquemaPatente.optional(),
  marca: textoOpcional(60).optional(),
  modelo: textoOpcional(60).optional(),
  color: textoOpcional(40).optional(),
  propietarioId: idReferencia.optional(),
  familiarId: idReferencia.optional(),
  loteId: idReferencia.optional(),
  descripcion: textoOpcional(400).optional(),
});
export type ActualizarVehiculo = z.infer<typeof esquemaActualizarVehiculo>;

// ---------------------------------------------------------------------------
// Pull incremental del directorio (offline)
// ---------------------------------------------------------------------------

/** Entidad borrada (lápida) que el cliente debe eliminar de su caché. */
export interface EliminadoDirectorio {
  readonly entidad: EntidadDirectorio;
  readonly uuid: string;
}

/**
 * Respuesta de `GET /api/directorio?desde=…`.
 *
 * Sólo trae lo cambiado desde `desde`; el cliente guarda el nuevo `desde` para
 * la próxima vez.
 */
export interface DirectorioPull {
  /** Marca de tiempo a usar como `desde` en el próximo pull. */
  readonly desde: string;
  readonly lotes: readonly LoteLocal[];
  readonly propietarios: readonly PropietarioLocal[];
  readonly familiares: readonly FamiliarLocal[];
  readonly vehiculos: readonly VehiculoLocal[];
  readonly eliminados: readonly EliminadoDirectorio[];
}

/**
 * Cuerpo de `POST /api/directorio/importar`.
 *
 * El barrio ya no viaja en el cuerpo: se toma del barrio activo de la cuenta.
 */
export const esquemaImportarDirectorio = z.object({
  csv: z.string().min(1).max(2_000_000),
});
export type ImportarDirectorio = z.infer<typeof esquemaImportarDirectorio>;

/** Resultado de `POST /api/directorio/importar`. */
export interface ResultadoImportacion {
  readonly barrio: string;
  /** Cantidad de filas leídas del CSV. */
  readonly filas: number;
  readonly creados: number;
  readonly actualizados: number;
  readonly errores: readonly ErrorImportacion[];
}

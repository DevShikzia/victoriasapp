import {
  TRATAMIENTOS_PROPIETARIO,
  type EntidadDirectorio,
  type TratamientoPropietario,
} from '@victoriasapp/shared';
import { type Model, Schema, type Types, model } from 'mongoose';

/**
 * Modelos del **directorio** del barrio (ver docs/04-modelo-de-datos.md y
 * docs/09-directorio-barrio.md).
 *
 * Jerarquía:
 *   Barrio ─ Lote ─ Propietario ─ (Familiar ─) Vehículo
 *
 * Todos los documentos llevan `uuid`: permite crearlos offline de forma
 * idempotente y borrarlos con una "lápida" (`eliminados`) para que los clientes
 * limpien su caché en el próximo pull incremental.
 */

export interface Barrio {
  uuid: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lote {
  uuid: string;
  barrioId: Types.ObjectId | null;
  numero: string;
  calle: string | null;
  notas: string | null;
  /** Titular principal (espejo de `Propietario.loteId`). */
  propietarioId: Types.ObjectId | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Propietario {
  uuid: string;
  barrioId: Types.ObjectId | null;
  loteId: Types.ObjectId | null;
  nombre: string;
  apellido: string;
  tratamiento: TratamientoPropietario | null;
  telefono: string | null;
  email: string | null;
  descripcion: string | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Familiar {
  uuid: string;
  propietarioId: Types.ObjectId | null;
  loteId: Types.ObjectId | null;
  nombre: string;
  parentesco: string | null;
  descripcion: string | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vehiculo {
  uuid: string;
  patente: string | null;
  marca: string | null;
  modelo: string | null;
  color: string | null;
  /** Lote al que está asociado el vehículo. */
  loteId: Types.ObjectId | null;
  /** Propietarios del lote que usan el vehículo. */
  propietarioIds: Types.ObjectId[];
  /** Familiares del lote que usan el vehículo. */
  familiarIds: Types.ObjectId[];
  /**
   * Referencias singulares heredadas. Se mantienen para leer datos viejos; las
   * listas `propietarioIds` y `familiarIds` son la fuente de verdad.
   */
  propietarioId: Types.ObjectId | null;
  familiarId: Types.ObjectId | null;
  descripcion: string | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Lápida de un documento borrado, para el pull incremental. */
export interface Eliminado {
  uuid: string;
  entidad: EntidadDirectorio;
  eliminadoEn: Date;
}

const opciones = { timestamps: true } as const;

const barrioSchema = new Schema<Barrio>(
  {
    uuid: { type: String, required: true, unique: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    direccion: { type: String, default: null, trim: true },
    activo: { type: Boolean, default: true },
  },
  opciones,
);

const loteSchema = new Schema<Lote>(
  {
    uuid: { type: String, required: true, unique: true, trim: true },
    barrioId: { type: Schema.Types.ObjectId, ref: 'Barrio', default: null },
    numero: { type: String, required: true, trim: true },
    calle: { type: String, default: null, trim: true },
    notas: { type: String, default: null, trim: true },
    propietarioId: { type: Schema.Types.ObjectId, ref: 'Propietario', default: null },
    activo: { type: Boolean, default: true },
  },
  opciones,
);
loteSchema.index({ barrioId: 1, numero: 1 });
loteSchema.index({ numero: 1 });

const propietarioSchema = new Schema<Propietario>(
  {
    uuid: { type: String, required: true, unique: true, trim: true },
    barrioId: { type: Schema.Types.ObjectId, ref: 'Barrio', default: null },
    loteId: { type: Schema.Types.ObjectId, ref: 'Lote', default: null },
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    tratamiento: { type: String, enum: [...TRATAMIENTOS_PROPIETARIO], default: null },
    telefono: { type: String, default: null, trim: true },
    email: { type: String, default: null, trim: true },
    descripcion: { type: String, default: null, trim: true },
    activo: { type: Boolean, default: true },
  },
  opciones,
);
propietarioSchema.index({ apellido: 1, nombre: 1 });
propietarioSchema.index({ loteId: 1 });

const familiarSchema = new Schema<Familiar>(
  {
    uuid: { type: String, required: true, unique: true, trim: true },
    propietarioId: { type: Schema.Types.ObjectId, ref: 'Propietario', default: null },
    loteId: { type: Schema.Types.ObjectId, ref: 'Lote', default: null },
    nombre: { type: String, required: true, trim: true },
    parentesco: { type: String, default: null, trim: true },
    descripcion: { type: String, default: null, trim: true },
    activo: { type: Boolean, default: true },
  },
  opciones,
);
familiarSchema.index({ propietarioId: 1 });

const vehiculoSchema = new Schema<Vehiculo>(
  {
    uuid: { type: String, required: true, unique: true, trim: true },
    patente: { type: String, default: null, trim: true, uppercase: true },
    marca: { type: String, default: null, trim: true },
    modelo: { type: String, default: null, trim: true },
    color: { type: String, default: null, trim: true },
    loteId: { type: Schema.Types.ObjectId, ref: 'Lote', default: null },
    propietarioIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Propietario' }],
      default: [],
    },
    familiarIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Familiar' }],
      default: [],
    },
    propietarioId: { type: Schema.Types.ObjectId, ref: 'Propietario', default: null },
    familiarId: { type: Schema.Types.ObjectId, ref: 'Familiar', default: null },
    descripcion: { type: String, default: null, trim: true },
    activo: { type: Boolean, default: true },
  },
  opciones,
);
// La patente es opcional, pero si existe no puede repetirse. El índice parcial
// excluye los documentos sin patente (`null`); `sparse` no sirve porque el campo
// existe con valor nulo y sólo se permitiría un vehículo sin patente.
vehiculoSchema.index(
  { patente: 1 },
  { unique: true, partialFilterExpression: { patente: { $type: 'string' } } },
);
vehiculoSchema.index({ loteId: 1 });
vehiculoSchema.index({ propietarioIds: 1 });
vehiculoSchema.index({ familiarIds: 1 });
vehiculoSchema.index({ propietarioId: 1 });

const eliminadoSchema = new Schema<Eliminado>(
  {
    uuid: { type: String, required: true },
    entidad: { type: String, required: true },
    eliminadoEn: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: false },
);
eliminadoSchema.index({ eliminadoEn: 1 });

export const BarrioModel: Model<Barrio> = model<Barrio>('Barrio', barrioSchema);
export const LoteModel: Model<Lote> = model<Lote>('Lote', loteSchema);
export const PropietarioModel: Model<Propietario> = model<Propietario>(
  'Propietario',
  propietarioSchema,
);
export const FamiliarModel: Model<Familiar> = model<Familiar>('Familiar', familiarSchema);
export const VehiculoModel: Model<Vehiculo> = model<Vehiculo>('Vehiculo', vehiculoSchema);
export const EliminadoModel: Model<Eliminado> = model<Eliminado>('Eliminado', eliminadoSchema);

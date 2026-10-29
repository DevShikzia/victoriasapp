import { type Model, Schema, type Types, model } from 'mongoose';

/** Perfil de una persona que trabaja en uno o más lotes. */
export interface Domestica {
  uuid: string;
  barrioId: Types.ObjectId | null;
  nombre: string;
  apellido: string;
  dni: string;
  telefono: string | null;
  /** Lote donde trabaja habitualmente. */
  lotePrincipalId: Types.ObjectId | null;
  /** Otros lotes donde suele trabajar (sin incluir el principal). */
  lotesHabituales: Types.ObjectId[];
  activo: boolean;
  notas: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Entrada/salida de una doméstica en un lote concreto. */
export interface RegistroDomestica {
  uuid: string;
  barrioId: Types.ObjectId | null;
  domesticaId: Types.ObjectId;
  /** Lote real de ese día. */
  loteId: Types.ObjectId;
  entradaEn: Date;
  salidaEn: Date | null;
  descripcion: string | null;
  /** Staff que abrió el registro; se toma de la sesión. */
  registradoPor: Types.ObjectId | null;
  creadoOffline: boolean;
  syncRev: number;
  /**
   * Última modificación según el reloj del dispositivo. Se usa para resolver
   * conflictos de sync: comparar contra `updatedAt` del servidor rechazaría
   * cambios de celulares con la hora atrasada.
   */
  actualizadoCliente: Date;
  createdAt: Date;
  updatedAt: Date;
}

const domesticaSchema = new Schema<Domestica>(
  {
    uuid: { type: String, required: true, unique: true, trim: true },
    barrioId: { type: Schema.Types.ObjectId, ref: 'Barrio', default: null },
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    dni: { type: String, required: true, trim: true },
    telefono: { type: String, default: null, trim: true },
    lotePrincipalId: { type: Schema.Types.ObjectId, ref: 'Lote', default: null },
    lotesHabituales: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Lote' }],
      default: [],
    },
    activo: { type: Boolean, default: true },
    notas: { type: String, default: null, trim: true },
  },
  { timestamps: true },
);

domesticaSchema.index({ barrioId: 1, dni: 1 }, { unique: true });
domesticaSchema.index({ barrioId: 1, apellido: 1, nombre: 1 });
domesticaSchema.index({ barrioId: 1, lotePrincipalId: 1 });
domesticaSchema.index({ barrioId: 1, lotesHabituales: 1 });

const registroDomesticaSchema = new Schema<RegistroDomestica>(
  {
    uuid: { type: String, required: true, unique: true, trim: true },
    barrioId: { type: Schema.Types.ObjectId, ref: 'Barrio', default: null },
    domesticaId: { type: Schema.Types.ObjectId, ref: 'Domestica', required: true },
    loteId: { type: Schema.Types.ObjectId, ref: 'Lote', required: true },
    entradaEn: { type: Date, required: true },
    salidaEn: { type: Date, default: null },
    descripcion: { type: String, default: null, trim: true },
    registradoPor: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    creadoOffline: { type: Boolean, default: true },
    syncRev: { type: Number, default: 1 },
    actualizadoCliente: { type: Date, default: Date.now },
  },
  { timestamps: true, collection: 'registros_domesticas' },
);

registroDomesticaSchema.index({ barrioId: 1, entradaEn: -1 });
registroDomesticaSchema.index({ barrioId: 1, domesticaId: 1, salidaEn: 1 });
registroDomesticaSchema.index({ barrioId: 1, loteId: 1, entradaEn: -1 });

export const DomesticaModel: Model<Domestica> = model<Domestica>('Domestica', domesticaSchema);
export const RegistroDomesticaModel: Model<RegistroDomestica> = model<RegistroDomestica>(
  'RegistroDomestica',
  registroDomesticaSchema,
);

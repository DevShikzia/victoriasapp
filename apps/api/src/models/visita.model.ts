import {
  FORMATOS_DNI,
  SEXOS,
  TIPOS_VISITA,
  type DniFormato,
  type Sexo,
  type TipoVisita,
} from '@victoriasapp/shared';
import { type Model, Schema, type Types, model } from 'mongoose';

export interface Visita {
  uuid: string;
  tipo: TipoVisita;
  apellido: string;
  nombre: string;
  dni: string;
  fechaNacimiento: string | null;
  sexo: Sexo | null;
  formatoDocumento: DniFormato;
  documentoRaw: string | null;
  patente: string | null;
  loteNumero: string | null;
  propietarioNombre: string | null;
  motivo: string | null;
  acompanantes: number;
  entradaEn: Date;
  salidaEn: Date | null;
  creadoOffline: boolean;
  guardiaId: Types.ObjectId | null;
  garitaId: Types.ObjectId | null;
  barrioId: Types.ObjectId | null;
  syncRev: number;
  createdAt: Date;
  updatedAt: Date;
}

const visitaSchema = new Schema<Visita>(
  {
    uuid: { type: String, required: true, unique: true, trim: true },
    tipo: { type: String, enum: [...TIPOS_VISITA], required: true },
    apellido: { type: String, required: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    dni: { type: String, required: true, trim: true },
    fechaNacimiento: { type: String, default: null },
    sexo: { type: String, enum: [...SEXOS], default: null },
    formatoDocumento: { type: String, enum: [...FORMATOS_DNI], default: 'manual' },
    documentoRaw: { type: String, default: null },
    patente: { type: String, default: null, index: true },
    loteNumero: { type: String, default: null, index: true },
    propietarioNombre: { type: String, default: null },
    motivo: { type: String, default: null },
    acompanantes: { type: Number, default: 0, min: 0 },
    entradaEn: { type: Date, required: true },
    salidaEn: { type: Date, default: null },
    creadoOffline: { type: Boolean, default: true },
    guardiaId: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    garitaId: { type: Schema.Types.ObjectId, ref: 'Garita', default: null },
    barrioId: { type: Schema.Types.ObjectId, ref: 'Barrio', default: null },
    syncRev: { type: Number, default: 1 },
  },
  { timestamps: true },
);

visitaSchema.index({ entradaEn: -1 });
visitaSchema.index({ dni: 1 });

export const VisitaModel: Model<Visita> = model<Visita>('Visita', visitaSchema);

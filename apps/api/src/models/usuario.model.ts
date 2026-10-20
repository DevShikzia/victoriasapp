import { ROLES_USUARIO, type RolUsuario } from '@victoriasapp/shared';
import { type Model, Schema, type Types, model } from 'mongoose';

export interface Usuario {
  usuario: string;
  nombre: string;
  passwordHash: string;
  rol: RolUsuario;
  garitaId: Types.ObjectId | null;
  barrioId: Types.ObjectId | null;
  activo: boolean;
  ultimoAcceso: Date | null;
  refreshTokenHash: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const usuarioSchema = new Schema<Usuario>(
  {
    usuario: { type: String, required: true, unique: true, trim: true, lowercase: true },
    nombre: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    rol: { type: String, enum: [...ROLES_USUARIO], required: true, default: 'guardia' },
    garitaId: { type: Schema.Types.ObjectId, ref: 'Garita', default: null },
    barrioId: { type: Schema.Types.ObjectId, ref: 'Barrio', default: null },
    activo: { type: Boolean, default: true },
    ultimoAcceso: { type: Date, default: null },
    refreshTokenHash: { type: String, default: null, select: false },
  },
  { timestamps: true },
);

export const UsuarioModel: Model<Usuario> = model<Usuario>('Usuario', usuarioSchema);

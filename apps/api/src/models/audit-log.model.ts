import { type Model, Schema, type Types, model } from 'mongoose';

export interface AuditLog {
  userId: Types.ObjectId | null;
  accion: string;
  entidad: string | null;
  entidadId: string | null;
  ip: string | null;
  userAgent: string | null;
  detalle: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<AuditLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    accion: { type: String, required: true, index: true },
    entidad: { type: String, default: null },
    entidadId: { type: String, default: null },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    detalle: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

auditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLogModel: Model<AuditLog> = model<AuditLog>('AuditLog', auditLogSchema);

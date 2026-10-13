import type { UsuarioPublico } from '@victoriasapp/shared';
import type { HydratedDocument } from 'mongoose';

import type { Usuario } from '../models/usuario.model.js';

export type UsuarioDoc = HydratedDocument<Usuario>;

/** Proyecta un usuario de Mongo a su forma pública (sin hashes). */
export function aUsuarioPublico(doc: UsuarioDoc): UsuarioPublico {
  return {
    id: doc._id.toString(),
    usuario: doc.usuario,
    nombre: doc.nombre,
    rol: doc.rol,
    garitaId: doc.garitaId === null ? null : doc.garitaId.toString(),
  };
}

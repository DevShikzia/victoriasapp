import type { UsuarioAdmin, UsuarioPublico } from '@victoriasapp/shared';
import type { HydratedDocument } from 'mongoose';

import type { Usuario } from '../models/usuario.model.js';

export type UsuarioDoc = HydratedDocument<Usuario>;

/**
 * Proyecta un usuario de Mongo a su forma pública (sin hashes).
 *
 * `barrioNombre` se resuelve aparte porque vive en la colección de barrios; los
 * llamadores que ya lo tienen lo pasan para evitar una consulta extra.
 */
export function aUsuarioPublico(
  doc: UsuarioDoc,
  barrioNombre: string | null = null,
): UsuarioPublico {
  return {
    id: doc._id.toString(),
    usuario: doc.usuario,
    nombre: doc.nombre,
    rol: doc.rol,
    garitaId: doc.garitaId === null ? null : doc.garitaId.toString(),
    barrioId: doc.barrioId === null ? null : doc.barrioId.toString(),
    barrioNombre: doc.barrioId === null ? null : barrioNombre,
  };
}

/** Proyecta un usuario para el listado de administración (incluye `activo`). */
export function aUsuarioAdmin(doc: UsuarioDoc, barrioNombre: string | null = null): UsuarioAdmin {
  return { ...aUsuarioPublico(doc, barrioNombre), activo: doc.activo };
}

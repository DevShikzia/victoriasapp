/**
 * Tipos y validaciones de autenticación (compartidos front/back).
 * Ver docs/06-seguridad.md.
 */

import { z } from 'zod';
import { ROLES_USUARIO, type RolUsuario } from './dominio.js';

/** Mínimo de caracteres que acepta el sistema para una contraseña. */
export const LONGITUD_MINIMA_PASSWORD = 8;

/** Credenciales de login (usuario + contraseña). */
export const esquemaLogin = z.object({
  usuario: z.string().trim().min(1, 'El usuario es obligatorio').max(60),
  password: z.string().min(1, 'La contraseña es obligatoria').max(200),
});
export type Credenciales = z.infer<typeof esquemaLogin>;

/** Contraseña válida según la política del sistema. */
export const esquemaPassword = z
  .string()
  .min(
    LONGITUD_MINIMA_PASSWORD,
    `La contraseña debe tener al menos ${String(LONGITUD_MINIMA_PASSWORD)} caracteres`,
  )
  .max(200);

/** Alta de usuario (sólo admin). */
export const esquemaCrearUsuario = z.object({
  usuario: z
    .string()
    .trim()
    .min(3, 'El usuario debe tener al menos 3 caracteres')
    .max(60)
    .regex(/^[a-zA-Z0-9._-]+$/, 'Sólo letras, números, punto, guion y guion bajo'),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  password: esquemaPassword,
  rol: z.enum(ROLES_USUARIO).default('guardia'),
  garitaId: z.string().trim().min(1).nullable().default(null),
});
export type CrearUsuario = z.infer<typeof esquemaCrearUsuario>;

/** Edición de usuario (todos los campos opcionales). */
export const esquemaActualizarUsuario = z.object({
  nombre: z.string().trim().min(1).max(120).optional(),
  password: esquemaPassword.optional(),
  rol: z.enum(ROLES_USUARIO).optional(),
  activo: z.boolean().optional(),
  garitaId: z.string().trim().min(1).nullable().optional(),
});
export type ActualizarUsuario = z.infer<typeof esquemaActualizarUsuario>;

/** Usuario tal como lo expone la API (nunca incluye hashes). */
export interface UsuarioPublico {
  readonly id: string;
  readonly usuario: string;
  readonly nombre: string;
  readonly rol: RolUsuario;
  readonly garitaId: string | null;
}

/** Usuario en el listado de administración (`/api/users`): agrega si está activo. */
export interface UsuarioAdmin extends UsuarioPublico {
  readonly activo: boolean;
}

/** Respuesta de un login exitoso. */
export interface RespuestaLogin {
  readonly accessToken: string;
  /** Momento de vencimiento del access token (epoch ms). */
  readonly expiraEn: number;
  readonly usuario: UsuarioPublico;
}

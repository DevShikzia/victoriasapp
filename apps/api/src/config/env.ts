import { z } from 'zod';

/** Booleano tolerante a las formas típicas de las variables de entorno. */
const esquemaBooleano = z
  .enum(['true', 'false', '1', '0'])
  .transform((valor) => valor === 'true' || valor === '1');

/**
 * Esquema y validación de las variables de entorno.
 * Falla el arranque si falta algo obligatorio (mejor que romper en runtime).
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI es obligatorio'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET debe tener al menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET debe tener al menos 32 caracteres'),
  CORS_ORIGINS: z.string().default('http://localhost:4200'),

  /**
   * `strict` sirve cuando el PWA y la API comparten sitio (o en desarrollo).
   * Con Netlify + Render son dominios distintos: usar `none` (exige HTTPS).
   */
  COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).default('strict'),

  /** Vida de los tokens, en segundos. */
  ACCESS_TOKEN_SEGUNDOS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  REFRESH_TOKEN_SEGUNDOS: z.coerce
    .number()
    .int()
    .positive()
    .default(7 * 24 * 60 * 60),

  /**
   * Alta automática del administrador al arrancar (ver docs/06-seguridad.md).
   *
   * - Si `ADMIN_PASSWORD` está definida y el usuario no existe → se crea.
   * - Si `ADMIN_FORZAR_RESET=true` y el usuario existe → se resetea su contraseña
   *   (útil para recuperar el acceso si te quedaste afuera).
   * - Si no se define `ADMIN_PASSWORD`, no se toca nada.
   */
  ADMIN_USUARIO: z.string().trim().min(3).max(60).default('admin'),
  ADMIN_NOMBRE: z.string().trim().min(1).max(120).default('Administrador'),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD debe tener al menos 8 caracteres').optional(),
  ADMIN_FORZAR_RESET: esquemaBooleano.default('false'),
});

export type Env = z.infer<typeof envSchema>;

/** Carga y valida el entorno. */
export function cargarEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const resultado = envSchema.safeParse(raw);
  if (!resultado.success) {
    const detalle = resultado.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuración de entorno inválida:\n${detalle}`);
  }
  return resultado.data;
}

/** Orígenes permitidos por CORS, como arreglo. */
export function origenesCors(env: Env): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((origen) => origen.trim())
    .filter((origen) => origen !== '');
}

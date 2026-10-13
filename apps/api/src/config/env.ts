import { z } from 'zod';

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

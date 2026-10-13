import bcrypt from 'bcryptjs';

/** Costo de bcrypt para las contraseñas de usuario. */
const COSTO = 12;

/** Hashea una contraseña en texto plano. */
export async function hashearPassword(password: string): Promise<string> {
  return bcrypt.hash(password, COSTO);
}

/** Verifica una contraseña contra su hash. */
export async function verificarPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

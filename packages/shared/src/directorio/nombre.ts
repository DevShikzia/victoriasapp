/**
 * Utilidades para partir nombres completos (del CSV del directorio) en
 * nombre y apellido.
 */

export interface NombrePartido {
  readonly nombre: string;
  readonly apellido: string;
}

/**
 * Divide un nombre completo en `nombre` y `apellido`.
 *
 * - Con coma (`"Perez, Juan"`) la parte de la izquierda es el apellido.
 * - Sin coma, la última palabra es el apellido y el resto el nombre
 *   (`"Juan Perez"`, `"Maria de los Angeles Gomez"`).
 * - Un único término se usa como nombre y apellido (no se puede adivinar más).
 */
export function dividirNombreCompleto(texto: string): NombrePartido {
  const limpio = texto.trim().replace(/\s+/g, ' ');
  if (limpio === '') {
    return { nombre: '', apellido: '' };
  }

  const coma = limpio.indexOf(',');
  if (coma >= 0) {
    const apellido = limpio.slice(0, coma).trim();
    const nombre = limpio.slice(coma + 1).trim();
    return { nombre: nombre === '' ? apellido : nombre, apellido };
  }

  const partes = limpio.split(' ');
  if (partes.length === 1) {
    return { nombre: limpio, apellido: limpio };
  }
  const apellido = partes[partes.length - 1] ?? limpio;
  const nombre = partes.slice(0, -1).join(' ');
  return { nombre, apellido };
}

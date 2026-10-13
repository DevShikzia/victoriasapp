/**
 * Búsqueda difusa de texto para el **directorio offline**.
 *
 * Pensada para el autocompletado en la garita: tolera mayúsculas, tildes, `ñ`,
 * espacios de más, coincidencias por prefijo y errores de tipeo (una o dos
 * letras de diferencia). Es puro y sin dependencias para poder correr en el
 * celular sin conexión.
 */

/** Normaliza un texto para comparar: sin acentos, minúsculas y espacios simples. */
export function normalizarParaBusqueda(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Pesos de cada tipo de coincidencia (más alto = mejor). Se suman por cada
 * término de la consulta; sirven para ordenar los resultados.
 */
export const PUNTAJES_BUSQUEDA = {
  exacto: 1000,
  palabraExacta: 600,
  prefijoCampo: 500,
  prefijoPalabra: 400,
  contiene: 200,
  subsecuencia: 100,
  difuso: 60,
} as const;

/** `true` si todas las letras de `token` aparecen en `texto`, en orden. */
function esSubsecuencia(texto: string, token: string): boolean {
  let i = 0;
  for (const letra of texto) {
    if (letra === token[i]) {
      i += 1;
      if (i === token.length) {
        return true;
      }
    }
  }
  return i === token.length;
}

/**
 * Distancia de Levenshtein acotada: si supera `maximo` no importa el valor
 * exacto, sólo saber que se pasó.
 */
function distancia(a: string, b: string, maximo: number): number {
  if (Math.abs(a.length - b.length) > maximo) {
    return maximo + 1;
  }

  let anterior: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const actual: number[] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      actual[j] = Math.min(
        (anterior[j] ?? 0) + 1,
        (actual[j - 1] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + costo,
      );
    }
    anterior = actual;
  }
  return anterior[b.length] ?? maximo + 1;
}

/** Cuántas letras de error se toleran según el largo del término. */
function umbralDifuso(token: string): number {
  if (token.length <= 3) {
    return 1;
  }
  if (token.length <= 6) {
    return 2;
  }
  return 3;
}

/** Puntúa un único término contra un campo ya normalizado. `0` = no coincide. */
function puntuarToken(texto: string, token: string): number {
  if (token.length === 0) {
    return 0;
  }
  if (texto === token) {
    return PUNTAJES_BUSQUEDA.exacto;
  }

  const palabras = texto.split(' ');
  if (palabras.includes(token)) {
    return PUNTAJES_BUSQUEDA.palabraExacta;
  }
  if (texto.startsWith(token)) {
    return PUNTAJES_BUSQUEDA.prefijoCampo;
  }
  if (palabras.some((palabra) => palabra.startsWith(token))) {
    return PUNTAJES_BUSQUEDA.prefijoPalabra;
  }
  if (texto.includes(token)) {
    return PUNTAJES_BUSQUEDA.contiene;
  }
  if (token.length >= 3 && esSubsecuencia(texto, token)) {
    return PUNTAJES_BUSQUEDA.subsecuencia;
  }
  const maximo = umbralDifuso(token);
  if (palabras.some((palabra) => distancia(palabra, token, maximo) <= maximo)) {
    return PUNTAJES_BUSQUEDA.difuso;
  }
  return 0;
}

/**
 * Puntúa un campo contra una consulta. Todos los términos de la consulta deben
 * aparecer en el campo (en cualquier orden); el puntaje es la suma.
 * `0` significa que no hay coincidencia.
 */
export function puntuarCoincidencia(campo: string | null | undefined, consulta: string): number {
  const texto = normalizarParaBusqueda(campo ?? '');
  const q = normalizarParaBusqueda(consulta);
  if (texto === '' || q === '') {
    return 0;
  }

  let total = 0;
  for (const token of q.split(' ')) {
    const puntaje = puntuarToken(texto, token);
    if (puntaje === 0) {
      return 0;
    }
    total += puntaje;
  }
  return total;
}

/**
 * Ordena `items` por relevancia frente a `consulta`, comparando contra los
 * campos que devuelve `campos(item)`. Descarta los que no coinciden, ordena de
 * mayor a menor puntaje (empate: el orden original) y corta en `limite`.
 */
export function ordenarPorCoincidencia<T>(
  items: readonly T[],
  consulta: string,
  campos: (item: T) => readonly (string | null | undefined)[],
  limite = 8,
): readonly T[] {
  if (normalizarParaBusqueda(consulta) === '') {
    return [];
  }

  const puntuados: { readonly item: T; readonly puntaje: number; readonly indice: number }[] = [];
  items.forEach((item, indice) => {
    let mejor = 0;
    for (const campo of campos(item)) {
      const puntaje = puntuarCoincidencia(campo, consulta);
      if (puntaje > mejor) {
        mejor = puntaje;
      }
    }
    if (mejor > 0) {
      puntuados.push({ item, puntaje: mejor, indice });
    }
  });

  puntuados.sort((a, b) => b.puntaje - a.puntaje || a.indice - b.indice);
  return puntuados.slice(0, limite).map((p) => p.item);
}

/**
 * Utilidades de normalización para datos leídos de un DNI.
 *
 * El PDF417 y el QR sólo soportan ASCII imprimible: no pueden representar
 * `ñ`, `ü` ni acentos. Cada versión del documento lo resuelve distinto.
 */

/**
 * Reemplaza los códigos que usan algunas versiones del PDF417 para letras
 * que no están en ASCII:
 *  - `NXX` → `Ñ`
 *  - `UXX` → `Ü`
 */
export function normalizarLetras(texto: string): string {
  return texto.replaceAll('NXX', 'Ñ').replaceAll('UXX', 'Ü');
}

/** Recorta espacios repetidos y de los extremos. */
export function limpiarEspacios(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ');
}

/** Normaliza texto de persona: letras especiales + espacios. */
export function normalizarTexto(texto: string): string {
  return limpiarEspacios(normalizarLetras(texto));
}

/** Normaliza una patente: mayúsculas, sin espacios ni guiones. */
export function normalizarPatente(patente: string): string {
  return patente.toUpperCase().replace(/[\s-]/g, '');
}

/**
 * Convierte una fecha `DD/MM/AAAA` o `AAAA-MM-DD` a ISO `YYYY-MM-DD`.
 * Devuelve `null` si no es una fecha válida.
 */
export function aFechaIso(entrada: string): string | null {
  const texto = entrada.trim();
  if (texto === '') {
    return null;
  }

  const dmy = /^(?<d>\d{1,2})[/.-](?<m>\d{1,2})[/.-](?<y>\d{4})$/.exec(texto);
  if (dmy?.groups) {
    const { d, m, y } = dmy.groups;
    if (d !== undefined && m !== undefined && y !== undefined) {
      return construirIso(y, m, d);
    }
  }

  const iso = /^(?<y>\d{4})-(?<m>\d{1,2})-(?<d>\d{1,2})$/.exec(texto);
  if (iso?.groups) {
    const { y, m, d } = iso.groups;
    if (y !== undefined && m !== undefined && d !== undefined) {
      return construirIso(y, m, d);
    }
  }

  return null;
}

/** Construye y valida una fecha ISO. */
function construirIso(anio: string, mes: string, dia: string): string | null {
  const year = Number.parseInt(anio, 10);
  const month = Number.parseInt(mes, 10);
  const day = Number.parseInt(dia, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const fecha = new Date(Date.UTC(year, month - 1, day));
  const esValida =
    fecha.getUTCFullYear() === year &&
    fecha.getUTCMonth() === month - 1 &&
    fecha.getUTCDate() === day;

  if (!esValida) {
    return null;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${String(year).padStart(4, '0')}-${mm}-${dd}`;
}

/** Normaliza el sexo leído a `M` | `F` | `X` (o `null`). */
export function normalizarSexo(entrada: string | null): 'M' | 'F' | 'X' | null {
  if (entrada === null) {
    return null;
  }
  switch (entrada.trim().toUpperCase()) {
    case 'M':
    case 'MASCULINO':
      return 'M';
    case 'F':
    case 'FEMENINO':
      return 'F';
    case 'X':
      return 'X';
    default:
      return null;
  }
}

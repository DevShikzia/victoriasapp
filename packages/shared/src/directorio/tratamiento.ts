/**
 * Tratamiento de un propietario: señor o señora.
 *
 * Se usa para mostrarlo en el directorio y para ordenar los lotes: primero el
 * señor, después la señora y, si hay un solo titular, ese queda solo.
 */

export const TRATAMIENTOS_PROPIETARIO = ['senor', 'senora'] as const;
export type TratamientoPropietario = (typeof TRATAMIENTOS_PROPIETARIO)[number];

export const ETIQUETAS_TRATAMIENTO: Readonly<Record<TratamientoPropietario, string>> = {
  senor: 'Señor',
  senora: 'Señora',
};

/** Etiqueta legible (`Señor` / `Señora`) o `null` si no está definido. */
export function etiquetaTratamiento(
  valor: TratamientoPropietario | null | undefined,
): string | null {
  if (valor === null || valor === undefined) {
    return null;
  }
  return ETIQUETAS_TRATAMIENTO[valor];
}

/** Abreviatura para listas compactas (`Sr.` / `Sra.`). */
export function abreviaturaTratamiento(
  valor: TratamientoPropietario | null | undefined,
): string | null {
  if (valor === 'senor') {
    return 'Sr.';
  }
  if (valor === 'senora') {
    return 'Sra.';
  }
  return null;
}

/**
 * Normaliza un texto libre (por ejemplo, una columna del CSV) a un tratamiento.
 * Acepta `señor`, `senor`, `sr`, `m`, `masculino`, `señora`, `senora`, `sra`,
 * `f`, `femenino`, con o sin tildes y en cualquier capitalización.
 */
export function normalizarTratamiento(
  valor: string | null | undefined,
): TratamientoPropietario | null {
  const limpio = (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (['senor', 'sr', 'sr.', 'm', 'masculino', 'hombre'].includes(limpio)) {
    return 'senor';
  }
  if (['senora', 'sra', 'sra.', 'f', 'femenino', 'mujer'].includes(limpio)) {
    return 'senora';
  }
  return null;
}

/** Orden de tratamiento: señor (0), señora (1), sin dato (2). */
export function rangoTratamiento(valor: TratamientoPropietario | null | undefined): number {
  if (valor === 'senor') {
    return 0;
  }
  if (valor === 'senora') {
    return 1;
  }
  return 2;
}

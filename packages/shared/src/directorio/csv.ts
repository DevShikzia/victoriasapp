/**
 * Tipos, validaciones y parser de CSV del **directorio** (barrio, lotes,
 * propietarios, familiares y vehículos), compartido por front y back.
 *
 * Ver docs/09-directorio-barrio.md.
 */

import { normalizarPatente } from '../dni/normalizar.js';

export interface FilaImportacion {
  /** Número de fila en el archivo (1-based, incluyendo la cabecera). */
  readonly fila: number;
  readonly lote: string;
  readonly propietario: string;
  readonly telefono: string | null;
  readonly patente: string | null;
  readonly familiar: string | null;
  readonly parentesco: string | null;
  readonly descripcion: string | null;
}

export interface ErrorImportacion {
  readonly fila: number;
  readonly mensaje: string;
}

export interface ResultadoParseoCsv {
  readonly filas: readonly FilaImportacion[];
  readonly errores: readonly ErrorImportacion[];
}

/** Columnas esperadas, en orden. */
export const COLUMNAS_DIRECTORIO = [
  'lote',
  'propietario',
  'telefono',
  'patente',
  'familiar',
  'parentesco',
  'descripcion',
] as const;

const SEPARADORES = [',', ';', '\t'] as const;

/** Cuenta cuántas veces aparece `separador` fuera de comillas. */
function contarFueraDeComillas(linea: string, separador: string): number {
  let cantidad = 0;
  let entreComillas = false;
  for (const caracter of linea) {
    if (caracter === '"') {
      entreComillas = !entreComillas;
    } else if (!entreComillas && caracter === separador) {
      cantidad += 1;
    }
  }
  return cantidad;
}

/** Elige el separador más probable mirando la primera línea con contenido. */
function detectarSeparador(texto: string): string {
  const primeraLinea = texto.split(/\r?\n/).find((linea) => linea.trim() !== '') ?? '';
  let mejor: string = SEPARADORES[0];
  let maximo = 0;
  for (const separador of SEPARADORES) {
    const cantidad = contarFueraDeComillas(primeraLinea, separador);
    if (cantidad > maximo) {
      maximo = cantidad;
      mejor = separador;
    }
  }
  return mejor;
}

/** Convierte el texto CSV en una matriz de celdas. */
function parsearCeldas(texto: string, separador: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  let indice = 0;

  while (indice < texto.length) {
    const caracter = texto.charAt(indice);

    if (caracter === '"') {
      if (entreComillas && texto.charAt(indice + 1) === '"') {
        celda += '"';
        indice += 2;
        continue;
      }
      entreComillas = !entreComillas;
      indice += 1;
      continue;
    }

    if (!entreComillas && caracter === separador) {
      fila.push(celda);
      celda = '';
      indice += 1;
      continue;
    }

    if (!entreComillas && (caracter === '\n' || caracter === '\r')) {
      if (caracter === '\r' && texto.charAt(indice + 1) === '\n') {
        indice += 1;
      }
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = '';
      indice += 1;
      continue;
    }

    celda += caracter;
    indice += 1;
  }

  fila.push(celda);
  filas.push(fila);
  return filas;
}

/** Convierte `string | null | undefined` en `string | null`. */
function aTexto(valor: string | null | undefined): string | null {
  return valor ?? null;
}

/** Parsea el CSV del directorio. Nunca lanza: devuelve filas válidas + errores. */
export function parsearCsvDirectorio(texto: string): ResultadoParseoCsv {
  const separador = detectarSeparador(texto);
  const celdas = parsearCeldas(texto, separador);
  const filas: FilaImportacion[] = [];
  const errores: ErrorImportacion[] = [];

  celdas.forEach((filaCeldas, indice) => {
    const fila = indice + 1;
    const normalizadas = filaCeldas.map((celda) => {
      const limpio = celda.trim();
      return limpio === '' ? null : limpio;
    });

    if (normalizadas.every((celda) => celda === null)) {
      return;
    }
    if (
      normalizadas[0]?.toLowerCase() === 'lote' &&
      normalizadas[1]?.toLowerCase() === 'propietario'
    ) {
      return;
    }

    const lote = aTexto(normalizadas[0]);
    const propietario = aTexto(normalizadas[1]);
    if (lote === null || propietario === null) {
      errores.push({ fila, mensaje: 'Lote y propietario son obligatorios' });
      return;
    }

    const patente = aTexto(normalizadas[3]);
    filas.push({
      fila,
      lote,
      propietario,
      telefono: aTexto(normalizadas[2]),
      patente: patente === null ? null : normalizarPatente(patente),
      familiar: aTexto(normalizadas[4]),
      parentesco: aTexto(normalizadas[5]),
      descripcion: aTexto(normalizadas[6]),
    });
  });

  return { filas, errores };
}

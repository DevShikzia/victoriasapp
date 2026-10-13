/**
 * Parser de la Zona de Lectura Mecánica (MRZ) del DNI electrónico.
 * Formato TD1 (ICAO 9303): 3 líneas de 30 caracteres.
 */

import type { Sexo } from '../types/dominio.js';
import { aFechaIso, limpiarEspacios } from './normalizar.js';

export interface MrzData {
  readonly numeroDocumento: string;
  readonly apellido: string;
  readonly nombre: string;
  readonly fechaNacimiento: string | null;
  readonly fechaVencimiento: string | null;
  readonly sexo: Sexo | null;
  readonly valido: boolean;
  readonly errores: readonly string[];
}

const LARGO_LINEA_TD1 = 30;

/** Detecta si un texto parece una MRZ TD1 (3 líneas de 30). */
export function esMrz(raw: string): boolean {
  const lineas = dividirLineas(raw);
  if (lineas.length < 3) {
    return false;
  }
  const primera = lineas[0];
  return primera?.startsWith('ID') ?? false;
}

/** Parsea una MRZ TD1. Devuelve `null` si no tiene la forma esperada. */
export function parseMrz(raw: string): MrzData | null {
  const lineas = dividirLineas(raw);
  const [l1, l2, l3] = lineas;
  if (l1 === undefined || l2 === undefined || l3 === undefined) {
    return null;
  }

  const errores: string[] = [];

  // Línea 1: tipo (2) + país (3) + número de documento (9) + dígito (1) + relleno
  const numeroDocumento = l1.slice(5, 14).replaceAll('<', '').trim();
  const digitoDoc = l1.slice(14, 15);
  if (digitoDoc !== '<' && digitoDoc !== calcularDigito(numeroDocumento)) {
    errores.push('Dígito verificador del documento incorrecto');
  }

  // Línea 2: fecha nacimiento (6) + dígito + sexo + fecha vencimiento (6) + dígito + ...
  const nacimientoYYMMDD = l2.slice(0, 6);
  const sexoChar = l2.slice(7, 8);
  const vencimientoYYMMDD = l2.slice(8, 14);

  const fechaNacimiento = desdeYYMMDD(nacimientoYYMMDD);
  const fechaVencimiento = desdeYYMMDD(vencimientoYYMMDD);

  const sexo: Sexo | null =
    sexoChar === 'M' || sexoChar === 'F' || sexoChar === 'X' ? sexoChar : null;

  // Línea 3: apellido(s) << nombre(s)
  const [apellidoRaw = '', nombreRaw = ''] = l3.split('<<');
  const apellido = limpiarEspacios(apellidoRaw.replaceAll('<', ' '));
  const nombre = limpiarEspacios(nombreRaw.replaceAll('<', ' '));

  return {
    numeroDocumento,
    apellido,
    nombre,
    fechaNacimiento,
    fechaVencimiento,
    sexo,
    valido: errores.length === 0,
    errores,
  };
}

function dividirLineas(raw: string): string[] {
  return raw
    .replaceAll('\r', '\n')
    .split('\n')
    .map((linea) => linea.padEnd(LARGO_LINEA_TD1, '<').slice(0, LARGO_LINEA_TD1))
    .filter((linea) => linea.replaceAll('<', '').trim() !== '');
}

/** Convierte `YYMMDD` a ISO `YYYY-MM-DD` (siglo 2000 si `YY <= 30`). */
function desdeYYMMDD(yymmdd: string): string | null {
  if (!/^\d{6}$/.test(yymmdd)) {
    return null;
  }
  const yy = Number.parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const siglo = yy <= 30 ? 2000 : 1900;
  return aFechaIso(`${String(siglo + yy)}-${mm}-${dd}`);
}

/** Dígito verificador ICAO 9303 (ponderación 7-3-1, módulo 10). */
export function calcularDigito(valor: string): string {
  const pesos = [7, 3, 1];
  let suma = 0;
  for (let i = 0; i < valor.length; i += 1) {
    const caracter = valor.charAt(i);
    const base = caracter === '<' ? 0 : caracter.charCodeAt(0);
    const valorCaracter = caracter >= '0' && caracter <= '9' ? Number.parseInt(caracter, 10) : base;
    const peso = pesos[i % 3] ?? 1;
    suma += valorCaracter * peso;
  }
  return String(suma % 10);
}

/**
 * Parser unificado de códigos de DNI argentino.
 *
 * Soporta:
 *  - PDF417 del DNI tarjeta viejo (reverso, 16/17 campos).
 *  - PDF417 del DNI tarjeta intermedio (frente, 8/9 campos).
 *  - MRZ TD1 del DNI electrónico.
 *  - QR del DNI electrónico (detección; el formato exacto se fija con el
 *    Modo captura — ver docs/02-formatos-dni.md).
 *
 * Nunca lanza excepción: ante cualquier problema devuelve `ok: false` con el
 * payload crudo y los errores, para poder diagnosticar.
 */

import type { DniData, DniFormato, ParseResult } from '../types/dominio.js';
import { esMrz, parseMrz } from './mrz.js';
import { aFechaIso, normalizarSexo, normalizarTexto } from './normalizar.js';

const RE_DNI = /^\d{7,8}$/;

/** Punto de entrada del parser. */
export function parseDni(raw: string): ParseResult {
  const texto = raw.trim();

  if (texto === '') {
    return fallo('desconocido', raw, ['Payload vacío']);
  }

  if (esMrz(texto)) {
    return parsearDesdeMrz(texto);
  }

  if (texto.includes('@')) {
    return parsearDesdePdf417(texto);
  }

  if (/^https?:\/\//i.test(texto)) {
    // QR con URL (validación en línea). No contiene los datos de la persona.
    return fallo('qr', raw, ['QR de validación en línea: no contiene datos personales']);
  }

  return fallo('desconocido', raw, ['Formato de código no reconocido']);
}

/** Campos separados por `@` (PDF417 viejo e intermedio). */
function parsearDesdePdf417(texto: string): ParseResult {
  const campos = texto.split('@');

  const esIntermedio = campos.length === 8 || campos.length === 9;
  const esViejo = campos.length === 16 || campos.length === 17;

  if (esIntermedio) {
    const data = construirDesdeCamposIntermedio(campos);
    const errores = validar(data);
    return {
      ok: errores.length === 0,
      formato: 'pdf417-intermedio',
      data,
      raw: texto,
      errores,
    };
  }

  if (esViejo) {
    const data = construirDesdeCamposViejo(campos);
    const errores = validar(data);
    return {
      ok: errores.length === 0,
      formato: 'pdf417-viejo',
      data,
      raw: texto,
      errores,
    };
  }

  return fallo('desconocido', texto, [
    `Cantidad de campos inesperada (${String(campos.length)}): posible nueva versión`,
  ]);
}

/** Formato intermedio (código en el frente). */
function construirDesdeCamposIntermedio(campos: readonly string[]): DniData {
  return {
    numeroTramite: texto(campos[0]),
    apellido: normalizarTexto(texto(campos[1])),
    nombre: normalizarTexto(texto(campos[2])),
    sexo: normalizarSexo(texto(campos[3])),
    numeroDni: texto(campos[4]),
    ejemplar: texto(campos[5]),
    fechaNacimiento: aFechaIso(texto(campos[6])),
    fechaEmision: aFechaIso(texto(campos[7])),
    fechaVencimiento: null,
  };
}

/** Formato viejo (código en el reverso). */
function construirDesdeCamposViejo(campos: readonly string[]): DniData {
  return {
    numeroTramite: texto(campos[0]),
    numeroDni: texto(campos[1]),
    ejemplar: texto(campos[2]),
    apellido: normalizarTexto(texto(campos[4])),
    nombre: normalizarTexto(texto(campos[5])),
    fechaNacimiento: aFechaIso(texto(campos[7])),
    sexo: normalizarSexo(texto(campos[8])),
    fechaEmision: aFechaIso(texto(campos[9])),
    fechaVencimiento: aFechaIso(texto(campos[12])),
  };
}

/** Formato MRZ TD1. */
function parsearDesdeMrz(texto: string): ParseResult {
  const mrz = parseMrz(texto);
  if (mrz === null) {
    return fallo('mrz', texto, ['MRZ con estructura inválida']);
  }

  const data: DniData = {
    apellido: normalizarTexto(mrz.apellido),
    nombre: normalizarTexto(mrz.nombre),
    numeroDni: mrz.numeroDocumento,
    sexo: mrz.sexo,
    fechaNacimiento: mrz.fechaNacimiento,
    numeroTramite: null,
    ejemplar: null,
    fechaEmision: null,
    fechaVencimiento: mrz.fechaVencimiento,
  };

  const errores = [...mrz.errores, ...validar(data)];

  return {
    ok: errores.length === 0,
    formato: 'mrz',
    data,
    raw: texto,
    errores,
  };
}

/** Validaciones mínimas del resultado. */
function validar(data: DniData): string[] {
  const errores: string[] = [];
  if (!RE_DNI.test(data.numeroDni)) {
    errores.push('Número de DNI inválido');
  }
  if (data.apellido === '') {
    errores.push('Apellido vacío');
  }
  if (data.nombre === '') {
    errores.push('Nombre vacío');
  }
  return errores;
}

function texto(valor: string | undefined): string {
  return valor ?? '';
}

function fallo(
  formato: DniFormato | 'desconocido',
  raw: string,
  errores: readonly string[],
): ParseResult {
  return { ok: false, formato, data: null, raw, errores };
}

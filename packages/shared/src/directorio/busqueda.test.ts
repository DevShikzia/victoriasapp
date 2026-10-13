import { describe, expect, it } from 'vitest';

import { normalizarParaBusqueda, ordenarPorCoincidencia, puntuarCoincidencia } from './busqueda.js';

interface Item {
  readonly v: string;
}

const campo = (item: Item): readonly string[] => [item.v];

describe('normalizarParaBusqueda', () => {
  it('quita tildes y pasa a minúsculas', () => {
    expect(normalizarParaBusqueda('Los Álamos')).toBe('los alamos');
  });

  it('convierte la ñ en n', () => {
    expect(normalizarParaBusqueda('Ñandú')).toBe('nandu');
  });

  it('recorta y colapsa espacios y signos', () => {
    expect(normalizarParaBusqueda('  PEREZ,   ANA ')).toBe('perez ana');
  });

  it('devuelve vacío para un texto vacío', () => {
    expect(normalizarParaBusqueda('   ')).toBe('');
  });
});

describe('puntuarCoincidencia', () => {
  it('puntúa más alto la coincidencia exacta que la de palabra', () => {
    const exacto = puntuarCoincidencia('ANA', 'ana');
    const palabra = puntuarCoincidencia('PEREZ ANA', 'ana');
    expect(exacto).toBeGreaterThan(palabra);
    expect(palabra).toBeGreaterThan(0);
  });

  it('no distingue tildes ni mayúsculas', () => {
    expect(puntuarCoincidencia('Los Álamos', 'alamos')).toBeGreaterThan(0);
    expect(puntuarCoincidencia('PEREZ, ANA', 'PÉREZ')).toBeGreaterThan(0);
  });

  it('coincide por prefijo de palabra', () => {
    expect(puntuarCoincidencia('PEREZ ANA', 'an')).toBeGreaterThan(0);
  });

  it('acepta los términos en cualquier orden', () => {
    expect(puntuarCoincidencia('PEREZ, ANA', 'ana perez')).toBeGreaterThan(0);
  });

  it('tolera errores de tipeo (Levenshtein)', () => {
    expect(puntuarCoincidencia('GOMEZ LUIS', 'gomze')).toBeGreaterThan(0);
    expect(puntuarCoincidencia('PEREZ', 'peres')).toBeGreaterThan(0);
  });

  it('tolera letras salteadas (subsecuencia)', () => {
    expect(puntuarCoincidencia('perez ana', 'pza')).toBeGreaterThan(0);
  });

  it('devuelve 0 cuando no hay coincidencia o la consulta está vacía', () => {
    expect(puntuarCoincidencia('PEREZ', 'zzz')).toBe(0);
    expect(puntuarCoincidencia('PEREZ', '')).toBe(0);
    expect(puntuarCoincidencia(null, 'perez')).toBe(0);
    expect(puntuarCoincidencia('PEREZ', 'perez lopez')).toBe(0);
  });
});

describe('ordenarPorCoincidencia', () => {
  it('ordena por relevancia: exacto antes que palabra', () => {
    const items: readonly Item[] = [{ v: 'PEREZ ANA' }, { v: 'ANA' }];
    const orden = ordenarPorCoincidencia(items, 'ana', campo);
    expect(orden.map((i) => i.v)).toEqual(['ANA', 'PEREZ ANA']);
  });

  it('descarta los que no coinciden y mantiene el orden original en empates', () => {
    const items: readonly Item[] = [{ v: 'GOMEZ LUIS' }, { v: 'PEREZ ANA' }, { v: 'LUIS GOMEZ' }];
    const orden = ordenarPorCoincidencia(items, 'gomez', campo);
    expect(orden.map((i) => i.v)).toEqual(['GOMEZ LUIS', 'LUIS GOMEZ']);
  });

  it('respeta el límite', () => {
    const items: readonly Item[] = [{ v: 'ana' }, { v: 'anabel' }, { v: 'anahi' }];
    expect(ordenarPorCoincidencia(items, 'an', campo, 2)).toHaveLength(2);
  });

  it('devuelve una lista vacía si la consulta está vacía', () => {
    expect(ordenarPorCoincidencia([{ v: 'ana' }], '   ', campo)).toEqual([]);
  });
});

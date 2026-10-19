import { normalizarParaBusqueda } from '@victoriasapp/shared';

/** Trozo de texto que coincide (o no) con la consulta. */
export interface SegmentoTexto {
  readonly texto: string;
  readonly coincide: boolean;
}

const RE_ALFANUMERICO = /[a-z0-9]/;

/**
 * Normaliza el texto conservando un mapa de cada carácter normalizado a su
 * índice en el texto original. Es lo que permite resaltar la coincidencia sin
 * perder la posición real (tildes, mayúsculas, signos).
 */
function normalizarConMapa(texto: string): {
  readonly normalizado: string;
  readonly mapa: readonly number[];
} {
  let normalizado = '';
  const mapa: number[] = [];

  for (let i = 0; i < texto.length; i += 1) {
    const caracter = texto[i] ?? '';
    const limpio = caracter
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (limpio !== '' && RE_ALFANUMERICO.test(limpio)) {
      normalizado += limpio;
      mapa.push(i);
    } else if (normalizado !== '' && !normalizado.endsWith(' ')) {
      normalizado += ' ';
      mapa.push(i);
    }
  }

  if (normalizado.endsWith(' ')) {
    normalizado = normalizado.slice(0, -1);
    mapa.pop();
  }

  return { normalizado, mapa };
}

/**
 * Parte `texto` en segmentos marcando los tramos que coinciden con algún
 * término de `consulta`. Si no hay coincidencias devuelve un único segmento.
 */
export function segmentosResaltados(texto: string, consulta: string): readonly SegmentoTexto[] {
  const tokens = normalizarParaBusqueda(consulta)
    .split(' ')
    .filter((token) => token !== '');

  if (texto === '' || tokens.length === 0) {
    return [{ texto, coincide: false }];
  }

  const { normalizado, mapa } = normalizarConMapa(texto);
  const marcas = new Set<number>();

  for (const token of tokens) {
    let desde = 0;
    let indice = normalizado.indexOf(token, desde);
    while (indice !== -1) {
      for (let i = indice; i < indice + token.length; i += 1) {
        const original = mapa.at(i);
        if (original !== undefined) {
          marcas.add(original);
        }
      }
      desde = indice + token.length;
      indice = normalizado.indexOf(token, desde);
    }
  }

  if (marcas.size === 0) {
    return [{ texto, coincide: false }];
  }

  const segmentos: SegmentoTexto[] = [];
  let inicio = 0;
  for (let i = 1; i <= texto.length; i += 1) {
    const anterior = marcas.has(i - 1);
    const siguiente = i < texto.length ? marcas.has(i) : !anterior;
    if (siguiente !== anterior) {
      segmentos.push({ texto: texto.slice(inicio, i), coincide: anterior });
      inicio = i;
    }
  }

  return segmentos;
}

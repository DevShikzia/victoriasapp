import { segmentosResaltados } from './resaltado';

describe('segmentosResaltados', () => {
  it('devuelve el texto completo sin marcas si no hay coincidencia', () => {
    const segmentos = segmentosResaltados('PEREZ, ANA', 'gomez');
    expect(segmentos).toEqual([{ texto: 'PEREZ, ANA', coincide: false }]);
  });

  it('respeta el texto original y marca ignorando mayúsculas y tildes', () => {
    const segmentos = segmentosResaltados('Los Álamos', 'alamos');

    expect(segmentos.map((s) => s.texto).join('')).toBe('Los Álamos');
    const marcado = segmentos
      .filter((s) => s.coincide)
      .map((s) => s.texto)
      .join('');
    expect(marcado.toLowerCase()).toBe('álamos');
  });

  it('marca todos los términos de la consulta', () => {
    const segmentos = segmentosResaltados('PEREZ, ANA', 'ana perez');
    const marcados = segmentos.filter((s) => s.coincide).map((s) => s.texto);

    expect(marcados).toContain('PEREZ');
    expect(marcados).toContain('ANA');
  });

  it('marca coincidencias parciales dentro de una palabra', () => {
    const segmentos = segmentosResaltados('AB1234CD', '34');
    const marcado = segmentos
      .filter((s) => s.coincide)
      .map((s) => s.texto)
      .join('');

    expect(marcado).toBe('34');
  });

  it('no rompe con consultas vacías', () => {
    expect(segmentosResaltados('Lote 7', '   ')).toEqual([{ texto: 'Lote 7', coincide: false }]);
  });
});

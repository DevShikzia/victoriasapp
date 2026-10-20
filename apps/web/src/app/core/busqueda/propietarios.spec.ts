import type { PropietarioLocal, TratamientoPropietario } from '@victoriasapp/shared';

import {
  agruparPropietarios,
  buscarYOrdenarPropietarios,
  filtrarPropietarios,
  ordenarPropietarios,
} from './propietarios';

function propietario(
  nombre: string,
  apellido: string,
  loteNumero: string | null,
  tratamiento: TratamientoPropietario | null = null,
): PropietarioLocal {
  return {
    uuid: `${apellido}-${nombre}-${loteNumero ?? 'sin-lote'}`,
    nombre,
    apellido,
    tratamiento,
    telefono: null,
    email: null,
    descripcion: null,
    loteNumero,
    actualizadoEn: '2026-01-01T00:00:00.000Z',
  };
}

describe('ordenarPropietarios', () => {
  it('ordena los lotes de forma numérica y deja los vacíos al final', () => {
    const lista = [
      propietario('Ana', 'Perez', '10'),
      propietario('Luis', 'Gomez', null),
      propietario('Maria', 'Diaz', '2'),
      propietario('Juan', 'Lopez', '42'),
    ];

    expect(ordenarPropietarios(lista, 'lote').map((p) => p.loteNumero)).toEqual([
      '2',
      '10',
      '42',
      null,
    ]);
  });

  it('dentro del mismo lote pone primero al señor y después a la señora', () => {
    const lista = [
      propietario('Ana', 'Perez', '42', 'senora'),
      propietario('Juan', 'Perez', '42', 'senor'),
      propietario('Otra', 'Persona', '42', null),
    ];

    expect(ordenarPropietarios(lista, 'lote').map((p) => p.nombre)).toEqual([
      'Juan',
      'Ana',
      'Otra',
    ]);
  });

  it('ordena alfabéticamente por apellido y nombre', () => {
    const lista = [
      propietario('Zoe', 'Perez', '1'),
      propietario('Ana', 'Gomez', '2'),
      propietario('Beto', 'Gomez', '3'),
    ];

    expect(ordenarPropietarios(lista, 'alfabetico').map((p) => p.apellido)).toEqual([
      'Gomez',
      'Gomez',
      'Perez',
    ]);
    expect(ordenarPropietarios(lista, 'alfabetico')[0]?.nombre).toBe('Ana');
  });
});

describe('filtrarPropietarios', () => {
  const lista = [
    propietario('Ana', 'Pérez', '42', 'senora'),
    propietario('Juan', 'Gómez', '7', 'senor'),
    propietario('Maria', 'Díaz', '105', null),
  ];

  it('devuelve todos con la consulta vacía', () => {
    expect(filtrarPropietarios(lista, '   ').length).toBe(3);
  });

  it('busca por nombre sin distinguir tildes ni mayúsculas', () => {
    expect(filtrarPropietarios(lista, 'PEREZ').map((p) => p.nombre)).toEqual(['Ana']);
  });

  it('busca por número de lote', () => {
    expect(filtrarPropietarios(lista, '105').map((p) => p.nombre)).toEqual(['Maria']);
  });

  it('combina nombre y lote en la misma consulta', () => {
    expect(filtrarPropietarios(lista, 'gomez 7').map((p) => p.nombre)).toEqual(['Juan']);
  });

  it('aplica búsqueda y orden juntos', () => {
    const resultado = buscarYOrdenarPropietarios(lista, 'gomez', 'lote');
    expect(resultado.map((p) => p.nombre)).toEqual(['Juan']);
  });
});

describe('agruparPropietarios', () => {
  const lista = [
    propietario('Ana', 'Diaz', '1', 'senora'),
    propietario('Beto', 'Gomez', '1', 'senor'),
    propietario('Maria', 'Alvarez', '2', 'senora'),
    propietario('Juan', 'Perez', '2', 'senor'),
    propietario('Carla', 'Gomez', '10', 'senora'),
    propietario('Carlos', 'Diaz', '10', 'senor'),
  ];

  it('muestra juntos a todos los propietarios del lote y los ordena por jerarquía', () => {
    const grupos = agruparPropietarios(lista, '', 'lote');

    expect(grupos.map((grupo) => grupo.loteNumero)).toEqual(['1', '2', '10']);
    expect(grupos[1]?.propietarios.map((p) => p.nombre)).toEqual(['Juan', 'Maria']);
  });

  it('si la búsqueda coincide con un titular, conserva todo el grupo del lote', () => {
    const grupos = agruparPropietarios(lista, 'Alvarez', 'lote');

    expect(grupos.length).toBe(1);
    expect(grupos[0]?.loteNumero).toBe('2');
    expect(grupos[0]?.propietarios.map((p) => p.nombre)).toEqual(['Juan', 'Maria']);
  });

  it('ordena los grupos alfabéticamente por el señor', () => {
    const grupos = agruparPropietarios(lista, '', 'senor');

    expect(grupos.map((grupo) => grupo.loteNumero)).toEqual(['10', '1', '2']);
  });

  it('ordena los grupos alfabéticamente por la señora', () => {
    const grupos = agruparPropietarios(lista, '', 'senora');

    expect(grupos.map((grupo) => grupo.loteNumero)).toEqual(['2', '1', '10']);
  });
});

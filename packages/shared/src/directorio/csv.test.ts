import { describe, expect, it } from 'vitest';
import { parsearCsvDirectorio } from './csv.js';

describe('parsearCsvDirectorio', () => {
  it('parsea filas con cabecera', () => {
    const csv = [
      'lote,propietario,telefono,patente,familiar,parentesco,descripcion',
      '42,Juan Perez,11-5555-5555,ab123cd,,',
      '42,Ana Gomez,11-6666-6666,AC456EF,Maria Perez,hija,Casa del fondo',
    ].join('\n');

    const { filas, errores } = parsearCsvDirectorio(csv);

    expect(errores).toHaveLength(0);
    expect(filas).toHaveLength(2);
    expect(filas[0]).toEqual({
      fila: 2,
      lote: '42',
      propietario: 'Juan Perez',
      telefono: '11-5555-5555',
      patente: 'AB123CD',
      familiar: null,
      parentesco: null,
      descripcion: null,
    });
    expect(filas[1]?.familiar).toBe('Maria Perez');
    expect(filas[1]?.parentesco).toBe('hija');
    expect(filas[1]?.descripcion).toBe('Casa del fondo');
  });

  it('funciona sin cabecera', () => {
    const r = parsearCsvDirectorio('7,Lopez Maria,,,,\n');
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]?.lote).toBe('7');
    expect(r.errores).toHaveLength(0);
  });

  it('respeta comas dentro de comillas', () => {
    const r = parsearCsvDirectorio('5,"Perez, Juan",,,\n');
    expect(r.filas[0]?.propietario).toBe('Perez, Juan');
  });

  it('desescapa comillas dobles', () => {
    const r = parsearCsvDirectorio('5,"Juan ""El Tano"" Perez",,,\n');
    expect(r.filas[0]?.propietario).toBe('Juan "El Tano" Perez');
  });

  it('detecta el separador punto y coma', () => {
    const r = parsearCsvDirectorio(
      'lote;propietario;telefono;patente;familiar;parentesco;descripcion\n9;Ana Gomez;;AB123CD;;;\n',
    );
    expect(r.filas).toHaveLength(1);
    expect(r.filas[0]?.propietario).toBe('Ana Gomez');
    expect(r.filas[0]?.patente).toBe('AB123CD');
  });

  it('normaliza la patente', () => {
    const r = parsearCsvDirectorio('1,Juan,,ab-123 cd,,,\n');
    expect(r.filas[0]?.patente).toBe('AB123CD');
  });

  it('reporta filas sin lote o sin propietario', () => {
    const r = parsearCsvDirectorio('1,Juan,,,,\n,Ana,,,,\n2,Ana,,,,\n');
    expect(r.errores).toHaveLength(1);
    expect(r.errores[0]?.fila).toBe(2);
  });

  it('ignora líneas vacías y no cuenta la cabecera como error', () => {
    const r = parsearCsvDirectorio('\n\nlote,propietario\n1,Juan\n\n');
    expect(r.filas).toHaveLength(1);
    expect(r.errores).toHaveLength(0);
  });

  it('devuelve vacío para un texto vacío', () => {
    const r = parsearCsvDirectorio('');
    expect(r.filas).toHaveLength(0);
    expect(r.errores).toHaveLength(0);
  });
});

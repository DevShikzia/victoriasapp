import { describe, expect, it } from 'vitest';
import { dividirNombreCompleto } from './nombre.js';

describe('dividirNombreCompleto', () => {
  it('separa nombre y apellido por orden natural', () => {
    expect(dividirNombreCompleto('Juan Perez')).toEqual({ nombre: 'Juan', apellido: 'Perez' });
  });

  it('usa la última palabra como apellido', () => {
    expect(dividirNombreCompleto('Maria de los Angeles Gomez')).toEqual({
      nombre: 'Maria de los Angeles',
      apellido: 'Gomez',
    });
  });

  it('respeta el formato "Apellido, Nombre"', () => {
    expect(dividirNombreCompleto('Perez, Juan')).toEqual({ nombre: 'Juan', apellido: 'Perez' });
  });

  it('normaliza espacios', () => {
    expect(dividirNombreCompleto('  Juan   Perez ')).toEqual({ nombre: 'Juan', apellido: 'Perez' });
  });

  it('devuelve vacío para un texto vacío', () => {
    expect(dividirNombreCompleto('   ')).toEqual({ nombre: '', apellido: '' });
  });

  it('repite el token cuando hay uno solo', () => {
    expect(dividirNombreCompleto('Perez')).toEqual({ nombre: 'Perez', apellido: 'Perez' });
  });
});

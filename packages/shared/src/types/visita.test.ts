import { describe, expect, it } from 'vitest';
import { crearIdLocal, esquemaNuevaVisita } from './visita.js';

function baseValida(): Record<string, unknown> {
  return {
    tipo: 'ingreso',
    apellido: 'PEREZ',
    nombre: 'JUAN',
    dni: '30123456',
    entradaEn: '2026-10-13T12:00:00.000Z',
  };
}

describe('esquemaNuevaVisita', () => {
  it('acepta una visita mínima y aplica los defaults', () => {
    const r = esquemaNuevaVisita.safeParse(baseValida());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.acompanantes).toBe(0);
      expect(r.data.formatoDocumento).toBe('manual');
      expect(r.data.patente).toBeNull();
      expect(r.data.fechaNacimiento).toBeNull();
    }
  });

  it('rechaza un DNI inválido', () => {
    const r = esquemaNuevaVisita.safeParse({ ...baseValida(), dni: '12AB' });
    expect(r.success).toBe(false);
  });

  it('rechaza un apellido vacío', () => {
    const r = esquemaNuevaVisita.safeParse({ ...baseValida(), apellido: '   ' });
    expect(r.success).toBe(false);
  });

  it('rechaza una fecha de entrada que no es ISO', () => {
    const r = esquemaNuevaVisita.safeParse({ ...baseValida(), entradaEn: '13/10/2026' });
    expect(r.success).toBe(false);
  });

  it('exige acompañantes entero no negativo', () => {
    const r = esquemaNuevaVisita.safeParse({ ...baseValida(), acompanantes: -1 });
    expect(r.success).toBe(false);
  });
});

describe('crearIdLocal', () => {
  it('genera ids únicos', () => {
    const a = crearIdLocal();
    const b = crearIdLocal();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';

import { esquemaCrearUsuario, esquemaLogin, esquemaPassword } from './auth.js';
import { esquemaSincronizacion } from './sync.js';

describe('esquemaLogin', () => {
  it('acepta credenciales completas', () => {
    const r = esquemaLogin.safeParse({ usuario: 'admin', password: 'secreto123' });
    expect(r.success).toBe(true);
  });

  it('rechaza contraseña vacía', () => {
    const r = esquemaLogin.safeParse({ usuario: 'admin', password: '' });
    expect(r.success).toBe(false);
  });
});

describe('esquemaPassword', () => {
  it('exige 8 caracteres o más', () => {
    expect(esquemaPassword.safeParse('corta12').success).toBe(false);
    expect(esquemaPassword.safeParse('larga1234').success).toBe(true);
  });
});

describe('esquemaCrearUsuario', () => {
  it('acepta un usuario válido y aplica el rol por defecto', () => {
    const r = esquemaCrearUsuario.safeParse({
      usuario: 'jperez',
      nombre: 'Juan Perez',
      password: 'clave12345',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.rol).toBe('guardia');
      expect(r.data.garitaId).toBeNull();
    }
  });

  it('rechaza caracteres inválidos en el usuario', () => {
    const r = esquemaCrearUsuario.safeParse({
      usuario: 'a b',
      nombre: 'X',
      password: 'clave12345',
    });
    expect(r.success).toBe(false);
  });
});

describe('esquemaSincronizacion', () => {
  it('acepta un lote con una visita y aplica defaults', () => {
    const r = esquemaSincronizacion.safeParse({
      visitas: [
        {
          uuid: 'b1c2',
          tipo: 'ingreso',
          apellido: 'PEREZ',
          nombre: 'JUAN',
          dni: '30123456',
          entradaEn: '2026-10-13T12:00:00.000Z',
          actualizadoEn: '2026-10-13T12:00:00.000Z',
        },
      ],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.visitas[0]?.salidaEn).toBeNull();
      expect(r.data.visitas[0]?.creadoOffline).toBe(true);
    }
  });

  it('acepta un lote vacío', () => {
    const r = esquemaSincronizacion.safeParse({});
    expect(r.success).toBe(true);
  });
});

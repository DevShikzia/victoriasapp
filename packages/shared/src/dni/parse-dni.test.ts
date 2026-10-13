import { describe, expect, it } from 'vitest';
import { parseDni } from './parse-dni.js';

describe('parseDni — PDF417 intermedio (frente, 8/9 campos)', () => {
  it('extrae los datos del ejemplo documentado', () => {
    const raw = '00012345678@PEREZ@JUAN CARLOS@M@30123456@A@15/03/1985@10/06/2019';
    const r = parseDni(raw);

    expect(r.formato).toBe('pdf417-intermedio');
    expect(r.ok).toBe(true);
    expect(r.data).not.toBeNull();
    expect(r.data?.apellido).toBe('PEREZ');
    expect(r.data?.nombre).toBe('JUAN CARLOS');
    expect(r.data?.numeroDni).toBe('30123456');
    expect(r.data?.sexo).toBe('M');
    expect(r.data?.fechaNacimiento).toBe('1985-03-15');
    expect(r.data?.fechaEmision).toBe('2019-06-10');
  });
});

describe('parseDni — PDF417 viejo (reverso, 16/17 campos)', () => {
  it('mapea los índices del formato viejo', () => {
    const campos = [
      '00012345678', // 0 trámite
      '30123456', // 1 DNI
      'A', // 2 ejemplar
      '', // 3 reservado
      'PEREZ', // 4 apellido
      'JUAN CARLOS', // 5 nombre
      '', // 6 reservado
      '15/03/1985', // 7 nacimiento
      'M', // 8 sexo
      '10/06/2019', // 9 emisión
      '', // 10
      '', // 11
      '10/06/2029', // 12 vencimiento
      '', // 13
      '', // 14
      '', // 15
    ];
    const r = parseDni(campos.join('@'));

    expect(r.formato).toBe('pdf417-viejo');
    expect(r.ok).toBe(true);
    expect(r.data?.numeroDni).toBe('30123456');
    expect(r.data?.apellido).toBe('PEREZ');
    expect(r.data?.nombre).toBe('JUAN CARLOS');
    expect(r.data?.sexo).toBe('M');
    expect(r.data?.fechaNacimiento).toBe('1985-03-15');
    expect(r.data?.fechaEmision).toBe('2019-06-10');
    expect(r.data?.fechaVencimiento).toBe('2029-06-10');
  });
});

describe('parseDni — MRZ TD1', () => {
  it('parsea las 3 líneas de la MRZ', () => {
    const raw = [
      'IDARG30123456<2<<<<<<<<<<<<<<<',
      '8503155M3003157ARG<<<<<<<<<<<8',
      'PEREZ<<JUAN<CARLOS<<<<<<<<<<<<',
    ].join('\n');
    const r = parseDni(raw);

    expect(r.formato).toBe('mrz');
    expect(r.ok).toBe(true);
    expect(r.data?.apellido).toBe('PEREZ');
    expect(r.data?.nombre).toBe('JUAN CARLOS');
    expect(r.data?.numeroDni).toBe('30123456');
    expect(r.data?.sexo).toBe('M');
    expect(r.data?.fechaNacimiento).toBe('1985-03-15');
    expect(r.data?.fechaVencimiento).toBe('2030-03-15');
  });
});

describe('parseDni — casos de fallo controlado', () => {
  it('no lanza excepción con payload vacío', () => {
    const r = parseDni('   ');
    expect(r.ok).toBe(false);
    expect(r.data).toBeNull();
    expect(r.errores.length).toBeGreaterThan(0);
  });

  it('detecta el QR de validación en línea (URL) como sin datos personales', () => {
    const r = parseDni('https://www.argentina.gob.ar/validar-dni/abc123');
    expect(r.ok).toBe(false);
    expect(r.formato).toBe('qr');
    expect(r.data).toBeNull();
  });

  it('avisa cuando la cantidad de campos es inesperada', () => {
    const r = parseDni('a@b@c');
    expect(r.ok).toBe(false);
    expect(r.errores[0]?.toLowerCase()).toContain('cantidad de campos');
  });
});

import { TestBed } from '@angular/core/testing';
import type { NuevaVisita } from '@victoriasapp/shared';

import { DatosService } from './datos.service';

function visitaDePrueba(): NuevaVisita {
  return {
    tipo: 'ingreso',
    apellido: 'PEREZ',
    nombre: 'ANA',
    dni: '30123456',
    fechaNacimiento: null,
    sexo: null,
    formatoDocumento: 'manual',
    documentoRaw: null,
    patente: null,
    loteNumero: null,
    propietarioNombre: null,
    motivo: null,
    acompanantes: 0,
    entradaEn: new Date().toISOString(),
  };
}

describe('DatosService (offline, IndexedDB)', () => {
  let servicio: DatosService;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    servicio = TestBed.inject(DatosService);
    await servicio.limpiar();
  });

  afterEach(async () => {
    await servicio.limpiar();
  });

  it('guarda una visita local y la encola en el outbox', async () => {
    const visita = await servicio.guardarVisita(visitaDePrueba());

    expect(visita.estadoSync).toBe('pendiente');
    expect(visita.salidaEn).toBeNull();
    expect(servicio.visitas().length).toBe(1);
    expect(servicio.abiertas()).toBe(1);
    expect(servicio.pendientes()).toBe(1);
  });

  it('marca la salida y encola una segunda operación', async () => {
    const visita = await servicio.guardarVisita(visitaDePrueba());

    await servicio.marcarSalida(visita.uuid);

    const guardada = servicio.visitas()[0];
    expect(guardada.salidaEn).not.toBeNull();
    expect(servicio.abiertas()).toBe(0);
    expect(servicio.pendientes()).toBe(2);
  });

  it('carga el directorio de ejemplo y lo encuentra por patente', async () => {
    await servicio.cargarEjemplo();

    const vehiculo = await servicio.vehiculoPorPatente('ab123cd');
    expect(vehiculo?.propietarioNombre).toBe('PEREZ, ANA');
    expect(vehiculo?.loteNumero).toBe('42');

    const propietarios = await servicio.buscarPropietarios('gomez');
    expect(propietarios.length).toBe(1);
    expect(propietarios[0]?.loteNumero).toBe('12');
  });

  it('busca de forma difusa: sin tildes, en cualquier orden, con typos y por prefijo', async () => {
    await servicio.cargarEjemplo();

    // "alamos" encuentra la calle "Los Álamos" (sin tilde).
    const porCalle = await servicio.buscarLotes('alamos');
    expect(porCalle.map((l) => l.numero)).toContain('42');

    // Términos en cualquier orden.
    const porNombre = await servicio.buscarPropietarios('ana perez');
    expect(porNombre.map((p) => p.apellido)).toContain('PEREZ');

    // Typo (Levenshtein): "gomze" encuentra GOMEZ.
    const porTypo = await servicio.buscarPropietarios('gomze');
    expect(porTypo.map((p) => p.apellido)).toContain('GOMEZ');

    // Patente incompleta (prefijo).
    const porPatente = await servicio.buscarVehiculos('ab123');
    expect(porPatente.map((v) => v.patente)).toContain('AB123CD');
  });
});

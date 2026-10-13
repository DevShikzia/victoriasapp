import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { BarrioDto, PropietarioDto, ResultadoImportacion } from '@victoriasapp/shared';

import { CONFIG } from '../config/config';
import { DirectorioAdminService } from './directorio-admin.service';

function barrioDePrueba(): BarrioDto {
  return {
    id: 'b1',
    uuid: 'u-b1',
    nombre: 'El Pare',
    direccion: null,
    activo: true,
    actualizadoEn: '2026-01-01T00:00:00.000Z',
  };
}

function propietarioDePrueba(): PropietarioDto {
  return {
    id: 'p1',
    uuid: 'u-p1',
    barrioId: 'b1',
    loteId: 'l1',
    nombre: 'Ana',
    apellido: 'Perez',
    telefono: null,
    email: null,
    descripcion: null,
    activo: true,
    actualizadoEn: '2026-01-01T00:00:00.000Z',
  };
}

describe('DirectorioAdminService', () => {
  let api: DirectorioAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(DirectorioAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lista una entidad sin filtros', async () => {
    const promesa = api.listar('barrio');
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/barrios`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.keys().length).toBe(0);

    peticion.flush({ ok: true, data: [barrioDePrueba()] });
    const lista = await promesa;
    expect(lista.length).toBe(1);
    expect(lista[0]?.nombre).toBe('El Pare');
  });

  it('manda la búsqueda como query param (recortada)', async () => {
    const promesa = api.listar('propietario', { q: '  PEREZ  ' });
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/propietarios?q=PEREZ`);
    expect(peticion.request.params.get('q')).toBe('PEREZ');

    peticion.flush({ ok: true, data: [propietarioDePrueba()] });
    const lista = await promesa;
    expect(lista.length).toBe(1);
    expect(lista[0]?.apellido).toBe('Perez');
  });

  it('crea una entidad con POST', async () => {
    const promesa = api.crear('barrio', { nombre: 'El Pare' });
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/barrios`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ nombre: 'El Pare' });

    peticion.flush({ ok: true, data: barrioDePrueba() });
    const creado = await promesa;
    expect(creado.nombre).toBe('El Pare');
  });

  it('actualiza una entidad con PATCH', async () => {
    const promesa = api.actualizar('barrio', 'b1', { nombre: 'El Pare II' });
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/barrios/b1`);
    expect(peticion.request.method).toBe('PATCH');

    peticion.flush({ ok: true, data: { ...barrioDePrueba(), nombre: 'El Pare II' } });
    const actualizado = await promesa;
    expect(actualizado.nombre).toBe('El Pare II');
  });

  it('borra una entidad con DELETE', async () => {
    const promesa = api.eliminar('barrio', 'b1');
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/barrios/b1`);
    expect(peticion.request.method).toBe('DELETE');

    peticion.flush({ ok: true, data: { eliminado: true } });
    await promesa;
  });

  it('importa un CSV del barrio', async () => {
    const promesa = api.importarCsv('El Pare', 'lote,propietario\n1,PEREZ');
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/directorio/importar`);
    expect(peticion.request.method).toBe('POST');
    const cuerpo = peticion.request.body as { barrio: string; csv: string };
    expect(cuerpo.barrio).toBe('El Pare');
    expect(cuerpo.csv).toContain('PEREZ');

    const resultado: ResultadoImportacion = {
      barrio: 'El Pare',
      filas: 1,
      creados: 1,
      actualizados: 0,
      errores: [],
    };
    peticion.flush({ ok: true, data: resultado });
    const devuelto = await promesa;
    expect(devuelto.creados).toBe(1);
  });
});

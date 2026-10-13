import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { VisitaDto } from '@victoriasapp/shared';

import { CONFIG } from '../config/config';
import { VisitasApiService } from './visitas-api.service';

function visitaDePrueba(): VisitaDto {
  return {
    id: 'v1',
    uuid: 'u-v1',
    tipo: 'ingreso',
    apellido: 'Perez',
    nombre: 'Ana',
    dni: '30123456',
    fechaNacimiento: null,
    sexo: null,
    formatoDocumento: 'pdf417-viejo',
    documentoRaw: null,
    patente: 'AB123CD',
    loteNumero: '12',
    propietarioNombre: 'Perez, Ana',
    motivo: null,
    acompanantes: 0,
    entradaEn: '2026-05-01T10:00:00.000Z',
    salidaEn: null,
    creadoOffline: false,
    syncRev: 1,
    actualizadoEn: '2026-05-01T10:00:00.000Z',
  };
}

describe('VisitasApiService', () => {
  let api: VisitasApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(VisitasApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('consulta el histórico sin filtros', async () => {
    const promesa = api.buscar();
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/visits`);
    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.keys().length).toBe(0);

    peticion.flush({ ok: true, data: [visitaDePrueba()] });
    const lista = await promesa;
    expect(lista.length).toBe(1);
    expect(lista[0]?.uuid).toBe('u-v1');
  });

  it('manda texto, estado, rango y límite (recortando vacíos)', async () => {
    const promesa = api.buscar({
      q: '  PEREZ  ',
      estado: 'fuera',
      lote: '  ',
      desde: '2026-05-01T00:00:00.000Z',
      hasta: '2026-05-02T00:00:00.000Z',
      limite: 500,
    });
    const peticion = http.expectOne((req) => req.url === `${CONFIG.apiBaseUrl}/api/visits`);
    const params = peticion.request.params;
    expect(params.get('q')).toBe('PEREZ');
    expect(params.get('estado')).toBe('fuera');
    expect(params.has('lote')).toBe(false);
    expect(params.get('desde')).toBe('2026-05-01T00:00:00.000Z');
    expect(params.get('hasta')).toBe('2026-05-02T00:00:00.000Z');
    expect(params.get('limit')).toBe('500');

    peticion.flush({ ok: true, data: [] });
    await promesa;
  });
});

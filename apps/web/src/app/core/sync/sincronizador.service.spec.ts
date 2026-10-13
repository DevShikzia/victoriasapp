import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  type TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { NuevaVisita, ResultadoSync, SolicitudSync } from '@victoriasapp/shared';

import { CONFIG } from '../config/config';
import { SesionService } from '../auth/sesion.service';
import { DatosService } from '../db/datos.service';
import { SincronizadorService } from './sincronizador.service';

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

describe('SincronizadorService', () => {
  let datos: DatosService;
  let sesion: SesionService;
  let sincro: SincronizadorService;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    datos = TestBed.inject(DatosService);
    sesion = TestBed.inject(SesionService);
    sincro = TestBed.inject(SincronizadorService);
    http = TestBed.inject(HttpTestingController);
    await datos.limpiar();
    await sesion.inicializar();
  });

  afterEach(() => {
    http.verify();
  });

  async function iniciarSesion(): Promise<void> {
    const promesa = sesion.login({ usuario: 'admin', password: 'clave12345' });
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/auth/login`);
    peticion.flush({
      ok: true,
      data: {
        accessToken: 'token-de-prueba',
        expiraEn: Date.now() + 900_000,
        usuario: { id: '1', usuario: 'admin', nombre: 'Admin', rol: 'admin', garitaId: null },
      },
    });
    await promesa;
  }

  async function esperarPeticion(url: string): Promise<TestRequest> {
    for (let intento = 0; intento < 100; intento++) {
      const peticiones = http.match(url);
      if (peticiones.length > 0) {
        return peticiones[0];
      }
      await new Promise((resolver) => setTimeout(resolver, 5));
    }
    throw new Error(`No se emitió ninguna petición a ${url}`);
  }

  it('no sincroniza si no hay sesión', async () => {
    await datos.guardarVisita(visitaDePrueba());
    const resultado = await sincro.sincronizar();
    expect(resultado).toBe(false);
    expect(datos.pendientes()).toBe(1);
    http.expectNone(`${CONFIG.apiBaseUrl}/api/sync`);
  });

  it('envía las visitas pendientes y limpia el outbox', async () => {
    await iniciarSesion();
    const visita = await datos.guardarVisita(visitaDePrueba());
    expect(datos.pendientes()).toBe(1);

    const promesa = sincro.sincronizar();
    const peticion = await esperarPeticion(`${CONFIG.apiBaseUrl}/api/sync`);
    expect(peticion.request.method).toBe('POST');

    const cuerpo = peticion.request.body as SolicitudSync;
    expect(cuerpo.visitas.length).toBe(1);
    expect(cuerpo.visitas[0]?.uuid).toBe(visita.uuid);

    const respuesta: ResultadoSync = { aplicados: [visita.uuid], duplicados: [], errores: [] };
    peticion.flush({ ok: true, data: respuesta });

    expect(await promesa).toBe(true);
    expect(datos.pendientes()).toBe(0);
    expect(datos.visitas()[0]?.estadoSync).toBe('sincronizada');
  });
});

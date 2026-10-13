import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { UsuarioAdmin } from '@victoriasapp/shared';

import { CONFIG } from '../config/config';
import { UsuariosAdminService } from './usuarios-admin.service';

function usuarioDePrueba(): UsuarioAdmin {
  return {
    id: 'u1',
    usuario: 'ana',
    nombre: 'Ana',
    rol: 'guardia',
    garitaId: null,
    activo: true,
  };
}

describe('UsuariosAdminService', () => {
  let api: UsuariosAdminService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(UsuariosAdminService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lista los usuarios', async () => {
    const promesa = api.listar();
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/users`);
    expect(peticion.request.method).toBe('GET');

    peticion.flush({ ok: true, data: [usuarioDePrueba()] });
    const lista = await promesa;
    expect(lista.length).toBe(1);
    expect(lista[0]?.usuario).toBe('ana');
    expect(lista[0]?.activo).toBe(true);
  });

  it('crea un usuario con POST', async () => {
    const promesa = api.crear({
      usuario: 'ana',
      nombre: 'Ana',
      password: 'password123',
      rol: 'guardia',
      garitaId: null,
    });
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/users`);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({
      usuario: 'ana',
      nombre: 'Ana',
      password: 'password123',
      rol: 'guardia',
      garitaId: null,
    });

    peticion.flush({ ok: true, data: usuarioDePrueba() });
    const creado = await promesa;
    expect(creado.usuario).toBe('ana');
  });

  it('actualiza un usuario con PATCH', async () => {
    const promesa = api.actualizar('u1', { nombre: 'Ana María', activo: false });
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/users/u1`);
    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ nombre: 'Ana María', activo: false });

    peticion.flush({
      ok: true,
      data: { ...usuarioDePrueba(), nombre: 'Ana María', activo: false },
    });
    const actualizado = await promesa;
    expect(actualizado.nombre).toBe('Ana María');
    expect(actualizado.activo).toBe(false);
  });

  it('desactiva un usuario con DELETE', async () => {
    const promesa = api.desactivar('u1');
    const peticion = http.expectOne(`${CONFIG.apiBaseUrl}/api/users/u1`);
    expect(peticion.request.method).toBe('DELETE');

    peticion.flush({ ok: true, data: { desactivado: true } });
    await promesa;
  });
});

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CONFIG } from '../../core/config/config';
import { Usuarios } from './usuarios';

describe('Usuarios (pantalla de ABM)', () => {
  it('renderiza el encabezado y carga la lista', async () => {
    await TestBed.configureTestingModule({
      imports: [Usuarios],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Usuarios);
    fixture.detectChanges();

    http.expectOne(`${CONFIG.apiBaseUrl}/api/users`).flush({ ok: true, data: [] });
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('Usuarios');
    expect(texto).toContain('Crear usuario');
    expect(texto).toContain('No hay usuarios');
    http.verify();
  });
});

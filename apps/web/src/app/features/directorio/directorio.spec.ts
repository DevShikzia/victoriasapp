import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Directorio } from './directorio';

describe('Directorio (pantalla de ABM)', () => {
  it('renderiza el encabezado y carga las listas', async () => {
    await TestBed.configureTestingModule({
      imports: [Directorio],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Directorio);
    fixture.detectChanges();

    // 4 listas de referencia.
    for (const peticion of http.match(() => true)) {
      peticion.flush({ ok: true, data: [] });
    }
    await new Promise((resolver) => setTimeout(resolver, 0));

    // Listado de la entidad activa (propietarios).
    for (const peticion of http.match(() => true)) {
      peticion.flush({ ok: true, data: [] });
    }
    await fixture.whenStable();
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('Directorio del barrio');
    expect(texto).toContain('Propietarios');
    expect(texto).toContain('Importar CSV del barrio');
    http.verify();
  });
});

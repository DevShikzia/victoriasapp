import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { LoteDto, PropietarioDto } from '@victoriasapp/shared';

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

  it('agrupa los propietarios del mismo lote y ordena los grupos', async () => {
    await TestBed.configureTestingModule({
      imports: [Directorio],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Directorio);
    fixture.detectChanges();

    const fecha = '2026-01-01T00:00:00.000Z';
    const lotes: readonly LoteDto[] = [
      {
        id: 'lote-1',
        uuid: 'lote-1',
        barrioId: 'barrio-1',
        numero: '1',
        calle: null,
        notas: null,
        propietarioId: 'p-beto',
        actualizadoEn: fecha,
      },
      {
        id: 'lote-2',
        uuid: 'lote-2',
        barrioId: 'barrio-1',
        numero: '2',
        calle: null,
        notas: null,
        propietarioId: 'p-juan',
        actualizadoEn: fecha,
      },
    ];
    const propietarios: readonly PropietarioDto[] = [
      {
        id: 'p-ana',
        uuid: 'p-ana',
        barrioId: 'barrio-1',
        loteId: 'lote-1',
        nombre: 'Ana',
        apellido: 'Diaz',
        tratamiento: 'senora',
        telefono: null,
        email: null,
        descripcion: null,
        activo: true,
        actualizadoEn: fecha,
      },
      {
        id: 'p-beto',
        uuid: 'p-beto',
        barrioId: 'barrio-1',
        loteId: 'lote-1',
        nombre: 'Beto',
        apellido: 'Gomez',
        tratamiento: 'senor',
        telefono: null,
        email: null,
        descripcion: null,
        activo: true,
        actualizadoEn: fecha,
      },
      {
        id: 'p-juan',
        uuid: 'p-juan',
        barrioId: 'barrio-1',
        loteId: 'lote-2',
        nombre: 'Juan',
        apellido: 'Perez',
        tratamiento: 'senor',
        telefono: null,
        email: null,
        descripcion: null,
        activo: true,
        actualizadoEn: fecha,
      },
    ];

    const referenciasPendientes = http.match(() => true);
    for (const peticion of referenciasPendientes) {
      if (peticion.request.url.endsWith('/lotes')) {
        peticion.flush({ ok: true, data: lotes });
      } else if (peticion.request.url.endsWith('/propietarios')) {
        peticion.flush({ ok: true, data: propietarios });
      } else {
        peticion.flush({ ok: true, data: [] });
      }
    }
    await new Promise((resolver) => setTimeout(resolver, 0));

    const itemsPendientes = http.match(() => true);
    for (const peticion of itemsPendientes) {
      peticion.flush({
        ok: true,
        data: peticion.request.url.endsWith('/propietarios') ? propietarios : [],
      });
    }
    await new Promise((resolver) => setTimeout(resolver, 0));
    await fixture.whenStable();
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const agrupar = [...html.querySelectorAll<HTMLButtonElement>('button')].find((boton) =>
      boton.textContent.includes('Agrupar propietarios por lote'),
    );
    agrupar?.click();
    fixture.detectChanges();

    const grupos = [...html.querySelectorAll<HTMLElement>('.grupo-lote')];
    expect(grupos.length).toBe(2);
    expect(grupos[0]?.textContent).toContain('Lote 1');
    expect(grupos[0]?.textContent).toContain('Señor Beto Gomez');
    expect(grupos[0]?.textContent).toContain('Señora Ana Diaz');
    expect(grupos[1]?.textContent).toContain('Lote 2');
    http.verify();
  });
});

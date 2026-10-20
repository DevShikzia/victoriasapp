import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { DatosService } from '../../core/db/datos.service';
import { Propietarios } from './propietarios';

function esperar(ms = 0): Promise<void> {
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

async function crearComponente(): Promise<ComponentFixture<Propietarios>> {
  const fixture = TestBed.createComponent(Propietarios);
  fixture.detectChanges();
  // La primera carga sale de IndexedDB de forma asíncrona.
  for (let intento = 0; intento < 50; intento++) {
    const html = fixture.nativeElement as HTMLElement;
    if (!html.textContent.includes('Cargando propietarios')) {
      break;
    }
    await esperar(10);
    fixture.detectChanges();
  }
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('Propietarios (listado rápido)', () => {
  let datos: DatosService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Propietarios] }).compileComponents();
    datos = TestBed.inject(DatosService);
    await datos.limpiar();
    await datos.cargarEjemplo();
  });

  afterEach(async () => {
    await datos.limpiar();
  });

  it('muestra los propietarios ordenados por lote', async () => {
    const fixture = await crearComponente();

    const html = fixture.nativeElement as HTMLElement;
    const lotes = [...html.querySelectorAll('.propietario__lote')].map((nodo) =>
      nodo.textContent.trim(),
    );
    expect(lotes).toEqual(['7', '12', '42']);
    expect(html.textContent).toContain('3 propietarios');
  });

  it('busca por apellido', async () => {
    const fixture = await crearComponente();

    const html = fixture.nativeElement as HTMLElement;
    const input = html.querySelector<HTMLInputElement>('.buscador__campo');
    if (input === null) {
      throw new Error('No se encontró el buscador');
    }
    input.value = 'gomez';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(html.querySelectorAll('.propietario').length).toBe(1);
    expect(html.textContent).toContain('GOMEZ');
    expect(html.textContent).toContain('1 de 3');
  });

  it('cambia el orden a alfabético', async () => {
    const fixture = await crearComponente();

    const html = fixture.nativeElement as HTMLElement;
    const boton = [...html.querySelectorAll<HTMLButtonElement>('.orden__opcion')].find((nodo) =>
      nodo.textContent.includes('Alfabético'),
    );
    boton?.click();
    fixture.detectChanges();

    const nombres = [...html.querySelectorAll('.propietario__nombre')].map((nodo) =>
      nodo.textContent.trim(),
    );
    expect(nombres).toEqual(['DIAZ, MARIA', 'GOMEZ, LUIS', 'PEREZ, ANA']);
  });

  it('agrupa los propietarios por lote y permite ordenar por señor o señora', async () => {
    const fixture = await crearComponente();

    const html = fixture.nativeElement as HTMLElement;
    const agrupar = [...html.querySelectorAll<HTMLButtonElement>('.orden__opcion')].find((nodo) =>
      nodo.textContent.includes('Agrupar por lote'),
    );
    agrupar?.click();
    fixture.detectChanges();

    expect(html.querySelectorAll('.grupo').length).toBe(3);
    expect(html.textContent).toContain('Lote 42');
    expect(html.textContent).toContain('Alfabético por señor');
    expect(html.textContent).toContain('Alfabético por señora');
  });
});

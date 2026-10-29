import { TestBed } from '@angular/core/testing';

import { DatosService } from '../../core/db/datos.service';
import { sembrarDirectorioDePrueba } from '../../core/db/directorio.fixture';
import { Buscar } from './buscar';

function escribir(fixture: { nativeElement: unknown }, valor: string): void {
  const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input');
  if (input === null) {
    throw new Error('No se encontró el input de búsqueda');
  }
  input.value = valor;
  input.dispatchEvent(new Event('input'));
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

describe('Buscar (buscador global)', () => {
  let datos: DatosService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Buscar] }).compileComponents();
    datos = TestBed.inject(DatosService);
    await datos.limpiar();
    await sembrarDirectorioDePrueba();
  });

  afterEach(async () => {
    await datos.limpiar();
  });

  it('muestra el campo y la pista inicial', () => {
    const fixture = TestBed.createComponent(Buscar);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const input = html.querySelector<HTMLInputElement>('input');
    expect(input?.placeholder).toContain('Nombre');
    expect(html.textContent).toContain('Todo el barrio');
  });

  it('busca con debounce y muestra personas con su lote', async () => {
    const fixture = TestBed.createComponent(Buscar);
    fixture.detectChanges();

    escribir(fixture, 'gomez');
    fixture.detectChanges();
    await esperar(280);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('GOMEZ');
    expect(texto).toContain('Lote 12');
  });

  it('encuentra patentes por número parcial', async () => {
    const fixture = TestBed.createComponent(Buscar);
    fixture.detectChanges();

    escribir(fixture, '12');
    fixture.detectChanges();
    await esperar(280);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('AB123CD');
  });

  it('abre la ficha informativa al tocar un resultado', async () => {
    const fixture = TestBed.createComponent(Buscar);
    fixture.detectChanges();

    escribir(fixture, 'gomez');
    fixture.detectChanges();
    await esperar(280);
    fixture.detectChanges();

    const fila = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.fila');
    expect(fila).not.toBeNull();
    fila?.click();
    await esperar(60);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('Volver');
    expect(texto).toContain('GOMEZ');
  });
});

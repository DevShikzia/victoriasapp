import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NuevaVisita } from './visita/nueva-visita';
import { ListaVisitas } from './visitas/lista-visitas';

describe('Pantallas principales', () => {
  it('renderiza la pantalla de Nueva visita', async () => {
    await TestBed.configureTestingModule({
      imports: [NuevaVisita],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(NuevaVisita);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('Nueva visita');
    expect(texto).toContain('DNI');
    expect(texto).toContain('Patente');
  });

  it('renderiza el listado de visitas', async () => {
    await TestBed.configureTestingModule({
      imports: [ListaVisitas],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(ListaVisitas);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent;
    expect(texto).toContain('Visitas');
    expect(texto).toContain('por sincronizar');
  });
});

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  etiquetaTratamiento,
  type PropietarioLocal,
  type TratamientoPropietario,
} from '@victoriasapp/shared';

import { BuscadorService } from '../../core/busqueda/buscador.service';
import {
  buscarYOrdenarPropietarios,
  type CriterioOrdenPropietarios,
} from '../../core/busqueda/propietarios';
import type { DetalleFicha } from '../../core/busqueda/tipos';
import { DatosService } from '../../core/db/datos.service';
import { FichaDirectorio } from '../ficha-directorio/ficha-directorio';

/**
 * Listado rápido de propietarios del barrio activo, con búsqueda por nombre o
 * lote y orden por lote o alfabético. Funciona con el directorio cacheado, así
 * que no necesita conexión. Los datos salen de IndexedDB.
 */
@Component({
  selector: 'app-propietarios',
  imports: [FormsModule, FichaDirectorio],
  templateUrl: './propietarios.html',
  styleUrl: './propietarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Propietarios {
  private readonly datos = inject(DatosService);
  private readonly buscador = inject(BuscadorService);

  protected readonly propietarios = signal<readonly PropietarioLocal[]>([]);
  protected readonly consulta = signal('');
  protected readonly criterio = signal<CriterioOrdenPropietarios>('lote');
  protected readonly cargando = signal(true);
  protected readonly detalle = signal<DetalleFicha | null>(null);

  protected readonly resultados = computed(() =>
    buscarYOrdenarPropietarios(this.propietarios(), this.consulta(), this.criterio()),
  );

  protected readonly resumen = computed(() => {
    const total = this.propietarios().length;
    const visibles = this.resultados().length;
    if (this.consulta().trim() === '' || visibles === total) {
      return total === 1 ? '1 propietario' : `${String(total)} propietarios`;
    }
    return `${String(visibles)} de ${String(total)}`;
  });

  constructor() {
    // Si el sincronizador baja cambios del directorio, la lista se actualiza sola.
    effect(() => {
      this.datos.directorioVersion();
      void this.cargar();
    });
  }

  protected etiqueta(valor: TratamientoPropietario | null | undefined): string {
    return etiquetaTratamiento(valor) ?? '';
  }

  protected limpiarConsulta(): void {
    this.consulta.set('');
  }

  protected ordenarPor(criterio: CriterioOrdenPropietarios): void {
    this.criterio.set(criterio);
  }

  protected async abrir(propietario: PropietarioLocal): Promise<void> {
    const detalle = await this.buscador.detalle({ tipo: 'propietario', entidad: propietario });
    this.detalle.set(detalle);
  }

  protected cerrarDetalle(): void {
    this.detalle.set(null);
  }

  private async cargar(): Promise<void> {
    const propietarios = await this.datos.listarPropietarios();
    this.propietarios.set(propietarios);
    this.cargando.set(false);
  }
}

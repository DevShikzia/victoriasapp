import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type {
  FamiliarLocal,
  LoteLocal,
  PropietarioLocal,
  VehiculoLocal,
} from '@victoriasapp/shared';

import { BuscadorService } from '../../core/busqueda/buscador.service';
import { segmentosResaltados } from '../../core/busqueda/resaltado';
import {
  RESULTADOS_VACIOS,
  type DetalleFicha,
  type ResultadoBusqueda,
  type ResultadosGlobales,
} from '../../core/busqueda/tipos';
import { FichaDirectorio } from '../ficha-directorio/ficha-directorio';

const DEMORA_BUSQUEDA_MS = 200;

/**
 * Buscador global del directorio (offline): un solo campo encuentra
 * propietarios, familiares, vehículos y lotes. Al tocar un resultado se abre
 * una ficha informativa. Ver `docs/15-buscador-global-y-rediseno-mobile.md`.
 */
@Component({
  selector: 'app-buscar',
  imports: [FichaDirectorio],
  templateUrl: './buscar.html',
  styleUrl: './buscar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Buscar {
  private readonly buscador = inject(BuscadorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly input = viewChild<ElementRef<HTMLInputElement>>('inputBusqueda');

  protected readonly consulta = signal('');
  protected readonly resultados = signal<ResultadosGlobales>(RESULTADOS_VACIOS);
  protected readonly buscando = signal(false);
  protected readonly detalle = signal<DetalleFicha | null>(null);
  protected readonly cargandoDetalle = signal(false);
  protected readonly hayResultados = computed(() => this.resultados().total > 0);
  protected readonly segmentos = segmentosResaltados;

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private version = 0;

  constructor() {
    afterNextRender(() => {
      this.input()?.nativeElement.focus();
    });
    this.destroyRef.onDestroy(() => {
      this.cancelarTemporizador();
    });
  }

  protected alEscribir(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    this.consulta.set(valor);
    this.programar(valor);
  }

  protected probar(ejemplo: string): void {
    this.consulta.set(ejemplo);
    this.programar(ejemplo);
    this.input()?.nativeElement.focus();
  }

  protected limpiar(): void {
    this.cancelarTemporizador();
    this.version += 1;
    this.consulta.set('');
    this.resultados.set(RESULTADOS_VACIOS);
    this.buscando.set(false);
    this.input()?.nativeElement.focus();
  }

  protected abrirPropietario(entidad: PropietarioLocal): void {
    void this.abrirDetalle({ tipo: 'propietario', entidad });
  }

  protected abrirFamiliar(entidad: FamiliarLocal): void {
    void this.abrirDetalle({ tipo: 'familiar', entidad });
  }

  protected abrirVehiculo(entidad: VehiculoLocal): void {
    void this.abrirDetalle({ tipo: 'vehiculo', entidad });
  }

  protected abrirLote(entidad: LoteLocal): void {
    void this.abrirDetalle({ tipo: 'lote', entidad });
  }

  protected cerrarDetalle(): void {
    this.detalle.set(null);
  }

  protected descripcionVehiculo(vehiculo: VehiculoLocal): string {
    return [vehiculo.marca, vehiculo.modelo, vehiculo.color]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(' ');
  }

  private programar(valor: string): void {
    this.cancelarTemporizador();
    const limpio = valor.trim();
    if (limpio === '') {
      this.version += 1;
      this.resultados.set(RESULTADOS_VACIOS);
      this.buscando.set(false);
      return;
    }

    this.buscando.set(true);
    this.temporizador = setTimeout(() => {
      this.temporizador = null;
      void this.ejecutar(limpio);
    }, DEMORA_BUSQUEDA_MS);
  }

  private async ejecutar(consulta: string): Promise<void> {
    const version = ++this.version;
    try {
      const resultados = await this.buscador.buscar(consulta);
      if (version !== this.version) {
        return;
      }
      this.resultados.set(resultados);
    } finally {
      if (version === this.version) {
        this.buscando.set(false);
      }
    }
  }

  private async abrirDetalle(resultado: ResultadoBusqueda): Promise<void> {
    this.cargandoDetalle.set(true);
    try {
      this.detalle.set(await this.buscador.detalle(resultado));
    } finally {
      this.cargandoDetalle.set(false);
    }
  }

  private cancelarTemporizador(): void {
    if (this.temporizador !== null) {
      clearTimeout(this.temporizador);
      this.temporizador = null;
    }
  }
}

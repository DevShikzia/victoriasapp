import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Visita } from '@victoriasapp/shared';

import { DatosService } from '../../core/db/datos.service';

@Component({
  selector: 'app-lista-visitas',
  imports: [DatePipe, RouterLink],
  templateUrl: './lista-visitas.html',
  styleUrl: './lista-visitas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaVisitas implements OnInit {
  protected readonly datos = inject(DatosService);
  protected readonly ocupado = signal(false);
  protected readonly mensaje = signal<string | null>(null);

  /** Abiertas primero, después el resto (ya vienen ordenadas por entrada desc). */
  protected readonly ordenadas = computed<readonly Visita[]>(() => {
    const todas = this.datos.visitas();
    return [...todas].sort((a, b) => {
      const aAbierta = a.salidaEn === null ? 0 : 1;
      const bAbierta = b.salidaEn === null ? 0 : 1;
      if (aAbierta !== bAbierta) {
        return aAbierta - bAbierta;
      }
      return b.entradaEn.localeCompare(a.entradaEn);
    });
  });

  ngOnInit(): void {
    void this.datos.refrescar();
  }

  protected async marcarSalida(uuid: string): Promise<void> {
    this.ocupado.set(true);
    try {
      await this.datos.marcarSalida(uuid);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async cargarEjemplo(): Promise<void> {
    this.ocupado.set(true);
    this.mensaje.set(null);
    try {
      await this.datos.cargarEjemplo();
      const total = await this.datos.contarDirectorio();
      this.mensaje.set(`Directorio de ejemplo cargado (${total.toString()} registros).`);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected async limpiar(): Promise<void> {
    this.ocupado.set(true);
    this.mensaje.set(null);
    try {
      await this.datos.limpiar();
      this.mensaje.set('Datos locales borrados.');
    } finally {
      this.ocupado.set(false);
    }
  }
}

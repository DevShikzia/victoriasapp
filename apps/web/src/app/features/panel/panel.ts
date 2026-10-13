import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type OnDestroy,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { Visita, VisitaDto } from '@victoriasapp/shared';

import { DatosService } from '../../core/db/datos.service';
import { TiempoRealService } from '../../core/tiempo-real/tiempo-real.service';

interface FilaPanel {
  readonly uuid: string;
  readonly apellido: string;
  readonly nombre: string;
  readonly dni: string;
  readonly patente: string | null;
  readonly loteNumero: string | null;
  readonly motivo: string | null;
  readonly entradaEn: string;
  readonly salidaEn: string | null;
  readonly origen: 'local' | 'red';
}

function desdeLocal(visita: Visita): FilaPanel {
  return {
    uuid: visita.uuid,
    apellido: visita.apellido,
    nombre: visita.nombre,
    dni: visita.dni,
    patente: visita.patente,
    loteNumero: visita.loteNumero,
    motivo: visita.motivo,
    entradaEn: visita.entradaEn,
    salidaEn: visita.salidaEn,
    origen: 'local',
  };
}

function desdeRemoto(visita: VisitaDto): FilaPanel {
  return {
    uuid: visita.uuid,
    apellido: visita.apellido,
    nombre: visita.nombre,
    dni: visita.dni,
    patente: visita.patente,
    loteNumero: visita.loteNumero,
    motivo: visita.motivo,
    entradaEn: visita.entradaEn,
    salidaEn: visita.salidaEn,
    origen: 'red',
  };
}

function celdaCsv(valor: string): string {
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

@Component({
  selector: 'app-panel',
  imports: [DatePipe],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelEnVivo implements OnInit, OnDestroy {
  protected readonly datos = inject(DatosService);
  protected readonly tiempoReal = inject(TiempoRealService);
  protected readonly mensaje = signal<string | null>(null);

  /**
   * Visitas abiertas en vivo: lo local (de este dispositivo) más lo que llega
   * por el canal de tiempo real (otros puestos). Gana siempre la versión más
   * nueva por `uuid`.
   */
  protected readonly abiertas = computed<readonly FilaPanel[]>(() => {
    const filas = new Map<string, FilaPanel>();

    for (const local of this.datos.visitas()) {
      if (local.salidaEn !== null) {
        continue;
      }
      filas.set(local.uuid, desdeLocal(local));
    }

    for (const carga of this.tiempoReal.visitas()) {
      const visita = carga.visita;
      if (visita.salidaEn !== null) {
        filas.delete(visita.uuid);
        continue;
      }
      filas.set(visita.uuid, desdeRemoto(visita));
    }

    return [...filas.values()].sort((a, b) => (a.entradaEn < b.entradaEn ? 1 : -1));
  });

  ngOnInit(): void {
    void this.datos.refrescar();
    this.tiempoReal.conectar();
  }

  ngOnDestroy(): void {
    this.tiempoReal.desconectar();
  }

  protected exportarCsv(): void {
    const filas = this.abiertas();
    if (filas.length === 0) {
      this.mensaje.set('No hay visitas abiertas para exportar.');
      return;
    }

    const encabezado = [
      'apellido',
      'nombre',
      'dni',
      'patente',
      'lote',
      'motivo',
      'entrada',
      'salida',
      'origen',
    ];
    const cuerpo = filas.map((fila) => [
      fila.apellido,
      fila.nombre,
      fila.dni,
      fila.patente ?? '',
      fila.loteNumero ?? '',
      fila.motivo ?? '',
      fila.entradaEn,
      fila.salidaEn ?? '',
      fila.origen,
    ]);
    const csv = [encabezado, ...cuerpo].map((fila) => fila.map(celdaCsv).join(',')).join('\r\n');

    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `visitas-abiertas-${new Date().toISOString().slice(0, 10)}.csv`;
    enlace.click();
    URL.revokeObjectURL(url);

    this.mensaje.set(`Exportadas ${String(filas.length)} visitas abiertas.`);
  }
}

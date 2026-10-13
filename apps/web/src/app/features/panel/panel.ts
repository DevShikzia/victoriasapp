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
import { FormsModule } from '@angular/forms';
import type { Visita, VisitaDto } from '@victoriasapp/shared';

import { DatosService } from '../../core/db/datos.service';
import { mensajeDeError } from '../../core/http/mensaje-error';
import { TiempoRealService } from '../../core/tiempo-real/tiempo-real.service';
import { VisitasApiService, type FiltroVisitas } from '../../core/visitas/visitas-api.service';

type ModoPanel = 'vivo' | 'historico';
type EstadoFiltro = '' | 'dentro' | 'fuera';

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

function aCsv(encabezado: readonly string[], filas: readonly (readonly string[])[]): string {
  return [encabezado, ...filas].map((fila) => fila.map(celdaCsv).join(',')).join('\r\n');
}

function descargarCsv(nombre: string, csv: string): void {
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Fecha local en formato `YYYY-MM-DD` (para `<input type="date">`). */
function fechaClave(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${String(fecha.getFullYear())}-${mes}-${dia}`;
}

function inicioDelDia(fecha: string): string {
  return new Date(`${fecha}T00:00:00`).toISOString();
}

function finDelDia(fecha: string): string {
  return new Date(`${fecha}T23:59:59.999`).toISOString();
}

const COLUMNAS_VIVO = [
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

const COLUMNAS_HISTORICO = [
  'tipo',
  'apellido',
  'nombre',
  'dni',
  'patente',
  'lote',
  'propietario',
  'motivo',
  'acompanantes',
  'entrada',
  'salida',
];

@Component({
  selector: 'app-panel',
  imports: [DatePipe, FormsModule],
  templateUrl: './panel.html',
  styleUrl: './panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PanelEnVivo implements OnInit, OnDestroy {
  protected readonly datos = inject(DatosService);
  protected readonly tiempoReal = inject(TiempoRealService);
  private readonly api = inject(VisitasApiService);

  protected readonly modo = signal<ModoPanel>('vivo');
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

  // --- Histórico (consulta a la API) ---

  protected readonly historial = signal<readonly VisitaDto[]>([]);
  protected readonly cargandoHistorial = signal(false);
  protected readonly errorHistorial = signal<string | null>(null);
  protected readonly filtroQ = signal('');
  protected readonly filtroEstado = signal<EstadoFiltro>('');
  protected readonly filtroLote = signal('');
  protected readonly filtroDesde = signal(fechaClave(new Date(Date.now() - 6 * 86_400_000)));
  protected readonly filtroHasta = signal(fechaClave(new Date()));

  ngOnInit(): void {
    void this.datos.refrescar();
    this.tiempoReal.conectar();
  }

  ngOnDestroy(): void {
    this.tiempoReal.desconectar();
  }

  protected cambiarModo(modo: ModoPanel): void {
    this.modo.set(modo);
    this.mensaje.set(null);
    if (modo === 'historico' && this.historial().length === 0 && !this.cargandoHistorial()) {
      void this.buscarHistorial();
    }
  }

  protected async buscarHistorial(): Promise<void> {
    this.cargandoHistorial.set(true);
    this.errorHistorial.set(null);
    try {
      const estado = this.filtroEstado();
      const desde = this.filtroDesde().trim();
      const hasta = this.filtroHasta().trim();
      const filtro: FiltroVisitas = {
        q: this.filtroQ(),
        lote: this.filtroLote(),
        limite: 500,
        ...(estado === '' ? {} : { estado }),
        ...(desde === '' ? {} : { desde: inicioDelDia(desde) }),
        ...(hasta === '' ? {} : { hasta: finDelDia(hasta) }),
      };
      this.historial.set(await this.api.buscar(filtro));
    } catch (e) {
      this.errorHistorial.set(mensajeDeError(e));
    } finally {
      this.cargandoHistorial.set(false);
    }
  }

  protected exportarCsv(): void {
    const filas = this.abiertas();
    if (filas.length === 0) {
      this.mensaje.set('No hay visitas abiertas para exportar.');
      return;
    }
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
    descargarCsv(`visitas-abiertas-${fechaClave(new Date())}.csv`, aCsv(COLUMNAS_VIVO, cuerpo));
    this.mensaje.set(`Exportadas ${String(filas.length)} visitas abiertas.`);
  }

  protected exportarHistorial(): void {
    const filas = this.historial();
    if (filas.length === 0) {
      this.mensaje.set('No hay visitas en el histórico para exportar.');
      return;
    }
    const cuerpo = filas.map((visita) => [
      visita.tipo,
      visita.apellido,
      visita.nombre,
      visita.dni,
      visita.patente ?? '',
      visita.loteNumero ?? '',
      visita.propietarioNombre ?? '',
      visita.motivo ?? '',
      String(visita.acompanantes),
      visita.entradaEn,
      visita.salidaEn ?? '',
    ]);
    descargarCsv(
      `visitas-historico-${fechaClave(new Date())}.csv`,
      aCsv(COLUMNAS_HISTORICO, cuerpo),
    );
    this.mensaje.set(`Exportadas ${String(filas.length)} visitas del histórico.`);
  }
}

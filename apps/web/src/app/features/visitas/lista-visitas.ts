import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  esquemaNuevaVisita,
  normalizarNumeroDni,
  normalizarPatente,
  type NuevaVisitaInput,
  type TipoVisita,
  type Visita,
} from '@victoriasapp/shared';

import { DatosService } from '../../core/db/datos.service';

type CampoEdicionTexto =
  | 'apellido'
  | 'nombre'
  | 'patente'
  | 'loteNumero'
  | 'propietarioNombre'
  | 'motivo';

interface ModeloEdicion {
  tipo: TipoVisita;
  apellido: string;
  nombre: string;
  dni: string;
  patente: string;
  loteNumero: string;
  propietarioNombre: string;
  motivo: string;
}

/** Fecha local en formato `YYYY-MM-DD` (no usar `toISOString`, que es UTC). */
function fechaLocalIso(fecha: Date): string {
  const anio = String(fecha.getFullYear());
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function fechaDeVisita(visita: Visita): string {
  return fechaLocalIso(new Date(visita.entradaEn));
}

function formatearFecha(iso: string): string {
  const fecha = new Date(`${iso}T00:00:00`);
  return Number.isNaN(fecha.getTime()) ? iso : fecha.toLocaleDateString('es-AR');
}

function aTexto(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

@Component({
  selector: 'app-lista-visitas',
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './lista-visitas.html',
  styleUrl: './lista-visitas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ListaVisitas implements OnInit {
  protected readonly datos = inject(DatosService);
  protected readonly ocupado = signal(false);
  protected readonly filtrosAbiertos = signal(false);
  protected readonly soloAbiertas = signal(true);
  protected readonly filtroDesde = signal(fechaLocalIso(new Date()));
  protected readonly filtroHasta = signal(fechaLocalIso(new Date()));
  protected readonly filtroTexto = signal('');
  protected readonly mensaje = signal<string | null>(null);
  protected readonly errorEdicion = signal<string | null>(null);
  protected readonly editando = signal<Visita | null>(null);
  protected readonly edicion = signal<ModeloEdicion | null>(null);
  protected readonly guardandoEdicion = signal(false);

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

  protected readonly filtradas = computed<readonly Visita[]>(() => {
    const desde = this.filtroDesde();
    const hasta = this.filtroHasta();
    const texto = this.filtroTexto().trim().toLowerCase();
    return this.ordenadas().filter((visita) => {
      const fecha = fechaDeVisita(visita);
      if (fecha < desde || fecha > hasta) {
        return false;
      }
      if (this.soloAbiertas() && visita.salidaEn !== null) {
        return false;
      }
      if (texto === '') {
        return true;
      }
      return [
        visita.apellido,
        visita.nombre,
        visita.dni,
        visita.patente,
        visita.loteNumero,
        visita.propietarioNombre,
        visita.motivo,
      ].some((valor) => (valor ?? '').toLowerCase().includes(texto));
    });
  });

  protected readonly abiertasFiltradas = computed(
    () => this.filtradas().filter((visita) => visita.salidaEn === null).length,
  );

  protected readonly rangoTexto = computed(() => {
    const desde = this.filtroDesde();
    const hasta = this.filtroHasta();
    if (desde === hasta) {
      return desde === fechaLocalIso(new Date()) ? 'hoy' : formatearFecha(desde);
    }
    return `del ${formatearFecha(desde)} al ${formatearFecha(hasta)}`;
  });

  ngOnInit(): void {
    void this.datos.refrescar();
  }

  protected alternarFiltros(): void {
    this.filtrosAbiertos.update((abierto) => !abierto);
  }

  protected alternarSoloAbiertas(): void {
    this.soloAbiertas.update((soloAbiertas) => !soloAbiertas);
  }

  protected verHoy(): void {
    const hoy = fechaLocalIso(new Date());
    this.filtroDesde.set(hoy);
    this.filtroHasta.set(hoy);
    this.filtroTexto.set('');
  }

  protected verTodos(): void {
    this.filtroDesde.set('2000-01-01');
    this.filtroHasta.set('2100-12-31');
    this.filtroTexto.set('');
  }

  protected async marcarSalida(uuid: string): Promise<void> {
    this.ocupado.set(true);
    try {
      await this.datos.marcarSalida(uuid);
    } finally {
      this.ocupado.set(false);
    }
  }

  protected iniciarEdicion(visita: Visita): void {
    this.editando.set(visita);
    this.edicion.set({
      tipo: visita.tipo,
      apellido: visita.apellido,
      nombre: visita.nombre,
      dni: visita.dni,
      patente: visita.patente ?? '',
      loteNumero: visita.loteNumero ?? '',
      propietarioNombre: visita.propietarioNombre ?? '',
      motivo: visita.motivo ?? '',
    });
    this.errorEdicion.set(null);
    this.mensaje.set(null);
  }

  protected cancelarEdicion(): void {
    this.editando.set(null);
    this.edicion.set(null);
    this.errorEdicion.set(null);
  }

  protected actualizarTipoEdicion(valor: TipoVisita): void {
    this.edicion.update((modelo) => (modelo === null ? modelo : { ...modelo, tipo: valor }));
  }

  protected actualizarCampoEdicion(campo: CampoEdicionTexto, valor: string): void {
    this.edicion.update((modelo) => (modelo === null ? modelo : { ...modelo, [campo]: valor }));
  }

  protected actualizarDniEdicion(valor: string): void {
    this.edicion.update((modelo) =>
      modelo === null ? modelo : { ...modelo, dni: normalizarNumeroDni(valor).slice(0, 8) },
    );
  }

  protected async guardarEdicion(): Promise<void> {
    const original = this.editando();
    const modelo = this.edicion();
    if (original === null || modelo === null) {
      return;
    }

    const entrada: NuevaVisitaInput = {
      tipo: modelo.tipo,
      apellido: modelo.apellido.trim(),
      nombre: modelo.nombre.trim(),
      dni: normalizarNumeroDni(modelo.dni),
      fechaNacimiento: original.fechaNacimiento,
      sexo: original.sexo,
      formatoDocumento: original.formatoDocumento,
      documentoRaw: original.documentoRaw,
      patente: aTexto(modelo.patente) === null ? null : normalizarPatente(modelo.patente),
      loteNumero: aTexto(modelo.loteNumero),
      propietarioNombre: aTexto(modelo.propietarioNombre),
      motivo: aTexto(modelo.motivo),
      acompanantes: original.acompanantes,
      entradaEn: original.entradaEn,
    };

    const validacion = esquemaNuevaVisita.safeParse(entrada);
    if (!validacion.success) {
      this.errorEdicion.set(
        validacion.error.issues
          .map((issue) => `${issue.path.join('.') || 'formulario'}: ${issue.message}`)
          .join(' '),
      );
      return;
    }

    this.guardandoEdicion.set(true);
    this.errorEdicion.set(null);
    try {
      await this.datos.editarVisita(original.uuid, validacion.data);
      this.mensaje.set(
        `Visita actualizada: ${validacion.data.apellido}, ${validacion.data.nombre}.`,
      );
      this.cancelarEdicion();
    } finally {
      this.guardandoEdicion.set(false);
    }
  }
}

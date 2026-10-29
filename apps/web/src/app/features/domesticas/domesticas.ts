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
import {
  esquemaActualizarDomestica,
  esquemaCrearDomestica,
  normalizarNumeroDni,
  type DomesticaLocal,
  type RegistroDomesticaLocal,
} from '@victoriasapp/shared';

import { SesionService } from '../../core/auth/sesion.service';
import { DatosService } from '../../core/db/datos.service';
import { DomesticasApiService } from '../../core/domesticas/domesticas-api.service';
import { mensajeDeError } from '../../core/http/mensaje-error';
import { SincronizadorService } from '../../core/sync/sincronizador.service';
import { EscanerDni, type ResultadoEscaner } from '../visita/escaner-dni';

type Vista = 'listado' | 'historial';
type EstadoHistorial = 'todas' | 'dentro' | 'fuera';

interface ModeloEntrada {
  readonly domestica: DomesticaLocal;
  readonly loteUuid: string;
  readonly descripcion: string;
}

interface ModeloPerfil {
  readonly uuid: string | null;
  readonly nombre: string;
  readonly apellido: string;
  readonly dni: string;
  readonly telefono: string;
  readonly lotePrincipalUuid: string;
  readonly lotesHabituales: readonly string[];
  readonly activo: boolean;
  readonly notas: string;
}

interface OpcionLote {
  readonly uuid: string;
  readonly etiqueta: string;
}

interface RegistroHistorial {
  readonly registro: RegistroDomesticaLocal;
  readonly nombre: string;
  readonly dni: string;
  readonly lote: string;
}

const DESCRIPCIONES_RAPIDAS = ['Limpieza', 'Cocina', 'Planchado', 'Cuidado', 'Otros'] as const;

function fechaLocalIso(fecha: Date): string {
  const anio = String(fecha.getFullYear());
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function aTexto(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });
}

@Component({
  selector: 'app-domesticas',
  imports: [DatePipe, FormsModule, EscanerDni],
  templateUrl: './domesticas.html',
  styleUrl: './domesticas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Domesticas implements OnInit {
  protected readonly datos = inject(DatosService);
  private readonly api = inject(DomesticasApiService);
  private readonly sesion = inject(SesionService);
  private readonly sincro = inject(SincronizadorService);

  protected readonly vista = signal<Vista>('listado');
  protected readonly busqueda = signal('');
  protected readonly filtroLoteUuid = signal('');
  protected readonly verInactivas = signal(false);
  protected readonly descripcionesRapidas = DESCRIPCIONES_RAPIDAS;
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly entrada = signal<ModeloEntrada | null>(null);
  protected readonly salida = signal<RegistroDomesticaLocal | null>(null);
  protected readonly descripcionSalida = signal('');

  protected readonly perfil = signal<ModeloPerfil | null>(null);
  protected readonly mostrarEscanerPerfil = signal(false);
  protected readonly guardandoPerfil = signal(false);
  protected readonly errorPerfil = signal<string | null>(null);

  protected readonly historialDesde = signal(fechaLocalIso(new Date()));
  protected readonly historialHasta = signal(fechaLocalIso(new Date()));
  protected readonly historialLoteUuid = signal('');
  protected readonly historialDomesticaUuid = signal('');
  protected readonly historialEstado = signal<EstadoHistorial>('todas');
  protected readonly historialTexto = signal('');

  protected readonly puedeAdministrar = computed(() => {
    const rol = this.sesion.usuario()?.rol;
    return rol === 'admin' || rol === 'supervisor';
  });

  protected readonly lotesPorUuid = computed(
    () => new Map(this.datos.lotes().map((lote) => [lote.uuid, lote])),
  );

  protected readonly domesticasPorUuid = computed(
    () => new Map(this.datos.domesticas().map((domestica) => [domestica.uuid, domestica])),
  );

  protected readonly abiertosPorDomestica = computed(() => {
    const abiertos = new Map<string, RegistroDomesticaLocal>();
    for (const registro of this.datos.registrosDomesticas()) {
      if (registro.salidaEn === null && !abiertos.has(registro.domesticaUuid)) {
        abiertos.set(registro.domesticaUuid, registro);
      }
    }
    return abiertos;
  });

  protected readonly domesticasFiltradas = computed<readonly DomesticaLocal[]>(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const lote = this.filtroLoteUuid();
    return this.datos
      .domesticas()
      .filter((domestica) => domestica.activo || this.verInactivas())
      .filter((domestica) => {
        if (
          lote !== '' &&
          domestica.lotePrincipalUuid !== lote &&
          !domestica.lotesHabituales.includes(lote)
        ) {
          return false;
        }
        if (texto === '') {
          return true;
        }
        return [domestica.nombre, domestica.apellido, domestica.dni].some((valor) =>
          valor.toLowerCase().includes(texto),
        );
      })
      .sort(
        (a, b) => compararTexto(a.apellido, b.apellido) || compararTexto(a.nombre, b.nombre),
      );
  });

  protected readonly opcionesEntrada = computed<readonly OpcionLote[]>(() => {
    const modelo = this.entrada();
    if (modelo === null) {
      return [];
    }
    const domestic = modelo.domestica;
    const habituales = new Set(domestic.lotesHabituales);
    return this.datos
      .lotes()
      .map((lote) => {
        const principal = lote.uuid === domestic.lotePrincipalUuid;
        const habitual = habituales.has(lote.uuid);
        const sufijo = principal ? ' · principal' : habitual ? ' · habitual' : '';
        return {
          uuid: lote.uuid,
          etiqueta: `${lote.numero}${lote.calle === null ? '' : ` · ${lote.calle}`}${sufijo}`,
          orden: principal ? 0 : habitual ? 1 : 2,
        };
      })
      .sort((a, b) => a.orden - b.orden || compararTexto(a.etiqueta, b.etiqueta))
      .map(({ uuid, etiqueta }) => ({ uuid, etiqueta }));
  });

  protected readonly historialRegistros = computed<readonly RegistroHistorial[]>(() => {
    const desde = this.historialDesde();
    const hasta = this.historialHasta();
    const loteUuid = this.historialLoteUuid();
    const domesticaUuid = this.historialDomesticaUuid();
    const estado = this.historialEstado();
    const texto = this.historialTexto().trim().toLowerCase();
    const domesticas = this.domesticasPorUuid();
    const lotes = this.lotesPorUuid();

    return this.datos
      .registrosDomesticas()
      .filter((registro) => {
        const fecha = fechaLocalIso(new Date(registro.entradaEn));
        if (fecha < desde || fecha > hasta) {
          return false;
        }
        if (loteUuid !== '' && registro.loteUuid !== loteUuid) {
          return false;
        }
        if (domesticaUuid !== '' && registro.domesticaUuid !== domesticaUuid) {
          return false;
        }
        if (estado === 'dentro' && registro.salidaEn !== null) {
          return false;
        }
        if (estado === 'fuera' && registro.salidaEn === null) {
          return false;
        }
        if (texto !== '') {
          const domestica = domesticas.get(registro.domesticaUuid);
          const lote = lotes.get(registro.loteUuid);
          const valores = [
            domestica?.dni,
            domestica?.apellido,
            domestica?.nombre,
            lote?.numero,
            registro.descripcion,
          ];
          if (!valores.some((valor) => (valor ?? '').toLowerCase().includes(texto))) {
            return false;
          }
        }
        return true;
      })
      .map((registro) => {
        const domestica = domesticas.get(registro.domesticaUuid);
        const lote = lotes.get(registro.loteUuid);
        return {
          registro,
          nombre:
            domestica === undefined
              ? 'Doméstica eliminada'
              : `${domestica.apellido}, ${domestica.nombre}`,
          dni: domestica?.dni ?? '—',
          lote: lote?.numero ?? '—',
        };
      });
  });

  ngOnInit(): void {
    void this.datos.refrescar();
  }

  protected cambiarVista(vista: Vista): void {
    this.vista.set(vista);
    this.entrada.set(null);
    this.salida.set(null);
    this.perfil.set(null);
    this.limpiarMensajes();
  }

  protected verHistorialHoy(): void {
    const hoy = fechaLocalIso(new Date());
    this.historialDesde.set(hoy);
    this.historialHasta.set(hoy);
  }

  protected nombreDomestica(uuid: string): string {
    const domestica = this.domesticasPorUuid().get(uuid);
    return domestica === undefined
      ? 'Doméstica'
      : `${domestica.apellido}, ${domestica.nombre}`;
  }

  protected limpiarMensajes(): void {
    this.mensaje.set(null);
    this.error.set(null);
  }

  protected loteNumero(uuid: string | null): string {
    if (uuid === null) {
      return '—';
    }
    return this.lotesPorUuid().get(uuid)?.numero ?? '—';
  }

  protected lotesHabitualesNumeros(domestica: DomesticaLocal): readonly string[] {
    return domestica.lotesHabituales
      .map((uuid) => this.loteNumero(uuid))
      .filter((numero) => numero !== '—');
  }

  protected duracion(registro: RegistroDomesticaLocal): string {
    const inicio = new Date(registro.entradaEn).getTime();
    const fin = registro.salidaEn === null ? Date.now() : new Date(registro.salidaEn).getTime();
    const minutos = Math.max(0, Math.round((fin - inicio) / 60_000));
    const horas = Math.floor(minutos / 60);
    const resto = minutos % 60;
    return horas > 0 ? `${String(horas)} h ${String(resto)} min` : `${String(resto)} min`;
  }

  protected abrirEntrada(domestica: DomesticaLocal): void {
    this.limpiarMensajes();
    if (this.abiertosPorDomestica().has(domestica.uuid)) {
      this.error.set('Ya tiene una entrada abierta. Registrá la salida primero.');
      return;
    }
    const lotes = this.datos.lotes();
    const loteUuid =
      domestica.lotePrincipalUuid ?? (lotes.length > 0 ? lotes[0].uuid : '');
    if (loteUuid === '') {
      this.error.set('No hay lotes cargados. Sincronizá el directorio.');
      return;
    }
    this.entrada.set({ domestica, loteUuid, descripcion: '' });
  }

  protected cancelarEntrada(): void {
    this.entrada.set(null);
  }

  protected actualizarLoteEntrada(valor: string): void {
    this.entrada.update((modelo) => (modelo === null ? modelo : { ...modelo, loteUuid: valor }));
  }

  protected actualizarDescripcionEntrada(valor: string): void {
    this.entrada.update((modelo) =>
      modelo === null ? modelo : { ...modelo, descripcion: valor },
    );
  }

  protected elegirDescripcionEntrada(texto: string): void {
    this.actualizarDescripcionEntrada(texto);
  }

  protected async guardarEntrada(): Promise<void> {
    const modelo = this.entrada();
    if (modelo === null) {
      return;
    }
    if (modelo.loteUuid === '') {
      this.error.set('Elegí un lote.');
      return;
    }
    const registro = await this.datos.registrarEntradaDomestica(
      modelo.domestica.uuid,
      modelo.loteUuid,
      modelo.descripcion,
    );
    if (registro === null) {
      this.error.set('Ya tiene una entrada abierta. Registrá la salida primero.');
      return;
    }
    this.entrada.set(null);
    this.mensaje.set(
      `Entrada registrada: ${modelo.domestica.apellido}, ${modelo.domestica.nombre}.`,
    );
    void this.sincro.sincronizar();
  }

  protected abrirSalida(registro: RegistroDomesticaLocal): void {
    this.limpiarMensajes();
    this.salida.set(registro);
    this.descripcionSalida.set(registro.descripcion ?? '');
  }

  protected cancelarSalida(): void {
    this.salida.set(null);
  }

  protected actualizarDescripcionSalida(valor: string): void {
    this.descripcionSalida.set(valor);
  }

  protected async confirmarSalida(): Promise<void> {
    const registro = this.salida();
    if (registro === null) {
      return;
    }
    const actualizado = await this.datos.registrarSalidaDomestica(
      registro.uuid,
      this.descripcionSalida(),
    );
    if (actualizado === null) {
      this.error.set('No se pudo registrar la salida.');
      return;
    }
    const domestica = this.domesticasPorUuid().get(registro.domesticaUuid);
    this.salida.set(null);
    this.mensaje.set(
      `Salida registrada: ${domestica === undefined ? '' : `${domestica.apellido}, ${domestica.nombre}`}.`,
    );
    void this.sincro.sincronizar();
  }

  protected abrirNuevoPerfil(): void {
    this.limpiarMensajes();
    const lotes = this.datos.lotes();
    if (lotes.length === 0) {
      this.error.set('No hay lotes cargados. Sincronizá el directorio.');
      return;
    }
    this.errorPerfil.set(null);
    this.mostrarEscanerPerfil.set(false);
    this.perfil.set({
      uuid: null,
      nombre: '',
      apellido: '',
      dni: '',
      telefono: '',
      lotePrincipalUuid: lotes[0]?.uuid ?? '',
      lotesHabituales: [],
      activo: true,
      notas: '',
    });
  }

  protected editarPerfil(domestica: DomesticaLocal): void {
    this.limpiarMensajes();
    this.errorPerfil.set(null);
    this.mostrarEscanerPerfil.set(false);
    this.perfil.set({
      uuid: domestica.uuid,
      nombre: domestica.nombre,
      apellido: domestica.apellido,
      dni: domestica.dni,
      telefono: domestica.telefono ?? '',
      lotePrincipalUuid: domestica.lotePrincipalUuid ?? '',
      lotesHabituales: [...domestica.lotesHabituales],
      activo: domestica.activo,
      notas: domestica.notas ?? '',
    });
  }

  protected cancelarPerfil(): void {
    this.perfil.set(null);
    this.errorPerfil.set(null);
    this.mostrarEscanerPerfil.set(false);
  }

  protected actualizarPerfil<K extends keyof ModeloPerfil>(
    campo: K,
    valor: ModeloPerfil[K],
  ): void {
    this.perfil.update((modelo) => (modelo === null ? modelo : { ...modelo, [campo]: valor }));
  }

  protected actualizarDniPerfil(valor: string): void {
    this.actualizarPerfil('dni', normalizarNumeroDni(valor).slice(0, 8));
  }

  protected alternarHabitual(uuid: string, evento: Event): void {
    const marcado = (evento.target as HTMLInputElement).checked;
    this.perfil.update((modelo) => {
      if (modelo === null) {
        return modelo;
      }
      const sinUuid = modelo.lotesHabituales.filter((item) => item !== uuid);
      return { ...modelo, lotesHabituales: marcado ? [...sinUuid, uuid] : sinUuid };
    });
  }

  protected alternarEscanerPerfil(): void {
    this.mostrarEscanerPerfil.update((visible) => !visible);
  }

  protected alEscanearPerfil(resultado: ResultadoEscaner): void {
    this.perfil.update((modelo) =>
      modelo === null
        ? modelo
        : {
            ...modelo,
            dni: resultado.data.numeroDni || modelo.dni,
            apellido: resultado.data.apellido || modelo.apellido,
            nombre: resultado.data.nombre || modelo.nombre,
          },
    );
    this.mostrarEscanerPerfil.set(false);
  }

  protected async guardarPerfil(): Promise<void> {
    const modelo = this.perfil();
    if (modelo === null) {
      return;
    }
    this.errorPerfil.set(null);
    if (modelo.lotePrincipalUuid === '') {
      this.errorPerfil.set('Elegí el lote principal.');
      return;
    }

    const base = {
      nombre: modelo.nombre.trim(),
      apellido: modelo.apellido.trim(),
      dni: normalizarNumeroDni(modelo.dni),
      telefono: aTexto(modelo.telefono),
      lotePrincipalUuid: modelo.lotePrincipalUuid,
      lotesHabituales: [...modelo.lotesHabituales],
      activo: modelo.activo,
      notas: aTexto(modelo.notas),
    };

    this.guardandoPerfil.set(true);
    try {
      if (modelo.uuid === null) {
        const validacion = esquemaCrearDomestica.safeParse(base);
        if (!validacion.success) {
          this.errorPerfil.set(validacion.error.issues.map((issue) => issue.message).join(' '));
          return;
        }
        await this.api.crear(validacion.data);
      } else {
        const validacion = esquemaActualizarDomestica.safeParse(base);
        if (!validacion.success) {
          this.errorPerfil.set(validacion.error.issues.map((issue) => issue.message).join(' '));
          return;
        }
        await this.api.actualizar(modelo.uuid, validacion.data);
      }
      const sincronizado = await this.sincro.sincronizar();
      this.perfil.set(null);
      this.mensaje.set('Doméstica guardada.');
      if (!sincronizado) {
        this.error.set(
          'Se guardó en el servidor, pero la lista local no se actualizó. Sincronizá cuando puedas.',
        );
      }
    } catch (e) {
      this.errorPerfil.set(mensajeDeError(e));
    } finally {
      this.guardandoPerfil.set(false);
    }
  }

  protected async desactivarPerfil(domestica: DomesticaLocal): Promise<void> {
    if (
      !window.confirm(
        `¿Desactivar a ${domestica.apellido}, ${domestica.nombre}? No se borra el historial.`,
      )
    ) {
      return;
    }
    this.limpiarMensajes();
    try {
      await this.api.desactivar(domestica.uuid);
      await this.sincro.sincronizar();
      this.mensaje.set('Doméstica desactivada.');
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }
}

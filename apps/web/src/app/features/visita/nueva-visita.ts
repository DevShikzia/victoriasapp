import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type {
  DniFormato,
  LoteLocal,
  NuevaVisitaInput,
  PropietarioLocal,
  Sexo,
  TipoVisita,
  VehiculoLocal,
} from '@victoriasapp/shared';
import { esquemaNuevaVisita, normalizarPatente } from '@victoriasapp/shared';

import { DatosService } from '../../core/db/datos.service';
import { EscanerDni, type ResultadoEscaner } from './escaner-dni';

/** Modelo del formulario: todo string para enlazar con inputs nativos. */
interface ModeloFormulario {
  tipo: TipoVisita;
  apellido: string;
  nombre: string;
  dni: string;
  fechaNacimiento: string;
  sexo: string;
  patente: string;
  loteNumero: string;
  propietarioNombre: string;
  motivo: string;
  acompanantes: number;
}

function modeloVacio(): ModeloFormulario {
  return {
    tipo: 'ingreso',
    apellido: '',
    nombre: '',
    dni: '',
    fechaNacimiento: '',
    sexo: '',
    patente: '',
    loteNumero: '',
    propietarioNombre: '',
    motivo: '',
    acompanantes: 0,
  };
}

function aTexto(valor: string): string | null {
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

@Component({
  selector: 'app-nueva-visita',
  imports: [FormsModule, RouterLink, EscanerDni],
  templateUrl: './nueva-visita.html',
  styleUrl: './nueva-visita.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NuevaVisita {
  private readonly datos = inject(DatosService);

  protected readonly modelo = signal<ModeloFormulario>(modeloVacio());
  protected readonly guardando = signal(false);
  protected readonly errores = signal<readonly string[]>([]);
  protected readonly guardada = signal<string | null>(null);
  protected readonly mostrarEscaner = signal(false);
  protected readonly origenDocumento = signal<DniFormato>('manual');
  protected readonly documentoRaw = signal<string | null>(null);

  protected readonly sugerenciasLotes = signal<readonly LoteLocal[]>([]);
  protected readonly sugerenciasPropietarios = signal<readonly PropietarioLocal[]>([]);
  protected readonly sugerenciasVehiculos = signal<readonly VehiculoLocal[]>([]);

  protected readonly acompanantesValidos = computed(() => {
    const n = this.modelo().acompanantes;
    return Number.isInteger(n) && n >= 0 && n <= 50;
  });

  protected actualizar<K extends keyof ModeloFormulario>(
    campo: K,
    valor: ModeloFormulario[K],
  ): void {
    this.modelo.update((m) => ({ ...m, [campo]: valor }));
  }

  protected alCambiarLote(valor: string): void {
    this.actualizar('loteNumero', valor);
    void this.buscarLotes(valor);
  }

  protected alCambiarPropietario(valor: string): void {
    this.actualizar('propietarioNombre', valor);
    void this.buscarPropietarios(valor);
  }

  protected alCambiarPatente(valor: string): void {
    this.actualizar('patente', valor);
    void this.buscarVehiculos(valor);
  }

  private async buscarLotes(consulta: string): Promise<void> {
    this.sugerenciasLotes.set(await this.datos.buscarLotes(consulta));
  }

  private async buscarPropietarios(consulta: string): Promise<void> {
    this.sugerenciasPropietarios.set(await this.datos.buscarPropietarios(consulta));
  }

  private async buscarVehiculos(consulta: string): Promise<void> {
    this.sugerenciasVehiculos.set(await this.datos.buscarVehiculos(consulta));
  }

  /** Al elegir un propietario del listado, completa el lote. */
  protected async alElegirPropietario(): Promise<void> {
    const encontrado = await this.datos.propietarioPorNombre(this.modelo().propietarioNombre);
    if (encontrado !== undefined && encontrado.loteNumero !== null) {
      this.actualizar('loteNumero', encontrado.loteNumero);
    }
  }

  /** Al salir del lote, completa el propietario si existe. */
  protected async alSalirDelLote(): Promise<void> {
    if (this.modelo().propietarioNombre.trim() !== '') {
      return;
    }
    const lote = await this.datos.lotePorNumero(this.modelo().loteNumero);
    if (lote !== undefined && lote.propietarioNombre !== null) {
      this.actualizar('propietarioNombre', lote.propietarioNombre);
    }
  }

  /** Al salir de la patente, busca el vehículo y completa dueño y lote. */
  protected async alSalirDePatente(): Promise<void> {
    const patente = this.modelo().patente;
    if (patente.trim() === '') {
      return;
    }
    const vehiculo = await this.datos.vehiculoPorPatente(patente);
    if (vehiculo === undefined) {
      return;
    }
    if (this.modelo().propietarioNombre.trim() === '') {
      this.actualizar('propietarioNombre', vehiculo.propietarioNombre ?? '');
    }
    if (this.modelo().loteNumero.trim() === '') {
      this.actualizar('loteNumero', vehiculo.loteNumero ?? '');
    }
  }

  protected alternarEscaner(): void {
    this.mostrarEscaner.update((v) => !v);
  }

  protected alEscanear(resultado: ResultadoEscaner): void {
    const data = resultado.data;
    this.modelo.update((m) => ({
      ...m,
      apellido: data.apellido !== '' ? data.apellido : m.apellido,
      nombre: data.nombre !== '' ? data.nombre : m.nombre,
      dni: data.numeroDni !== '' ? data.numeroDni : m.dni,
      fechaNacimiento: data.fechaNacimiento ?? m.fechaNacimiento,
      sexo: data.sexo ?? m.sexo,
    }));
    this.origenDocumento.set(resultado.formato);
    this.documentoRaw.set(resultado.raw);
    this.mostrarEscaner.set(false);
  }

  protected async guardar(): Promise<void> {
    this.guardada.set(null);
    const m = this.modelo();
    const entrada: NuevaVisitaInput = {
      tipo: m.tipo,
      apellido: m.apellido,
      nombre: m.nombre,
      dni: m.dni,
      fechaNacimiento: aTexto(m.fechaNacimiento),
      sexo: m.sexo === '' ? null : (m.sexo as Sexo),
      formatoDocumento: this.origenDocumento(),
      documentoRaw: this.documentoRaw(),
      patente: aTexto(m.patente) === null ? null : normalizarPatente(m.patente),
      loteNumero: aTexto(m.loteNumero),
      propietarioNombre: aTexto(m.propietarioNombre),
      motivo: aTexto(m.motivo),
      acompanantes: m.acompanantes,
      entradaEn: new Date().toISOString(),
    };

    const validacion = esquemaNuevaVisita.safeParse(entrada);
    if (!validacion.success) {
      this.errores.set(
        validacion.error.issues.map((issue) => {
          const campo = issue.path.join('.') || 'formulario';
          return `${campo}: ${issue.message}`;
        }),
      );
      return;
    }

    this.errores.set([]);
    this.guardando.set(true);
    try {
      await this.datos.guardarVisita(validacion.data);
      const quien = `${validacion.data.apellido}, ${validacion.data.nombre}`;
      this.guardada.set(`Visita registrada: ${quien}`);
      this.modelo.set(modeloVacio());
      this.origenDocumento.set('manual');
      this.documentoRaw.set(null);
      this.sugerenciasLotes.set([]);
      this.sugerenciasPropietarios.set([]);
      this.sugerenciasVehiculos.set([]);
    } finally {
      this.guardando.set(false);
    }
  }
}

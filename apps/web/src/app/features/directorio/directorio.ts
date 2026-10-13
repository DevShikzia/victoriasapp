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
  ENTIDADES_DIRECTORIO,
  type EntidadDirectorio,
  type ResultadoImportacion,
} from '@victoriasapp/shared';

import {
  DirectorioAdminService,
  type FiltroDirectorio,
  type RegistroDirectorio,
} from '../../core/directorio/directorio-admin.service';
import { mensajeDeError } from '../../core/http/mensaje-error';
import { SincronizadorService } from '../../core/sync/sincronizador.service';
import {
  CONFIG_ENTIDADES,
  ENTIDADES_REFERENCIA,
  type CampoEntidad,
  type ColumnaEntidad,
} from './config-entidades';

type ValorFormulario = string | boolean;
type ModeloFormulario = Record<string, ValorFormulario>;

/** Lee una propiedad de un registro de forma segura (la clave existe en el DTO). */
function valorDe(registro: RegistroDirectorio, clave: string): unknown {
  return (registro as unknown as Record<string, unknown>)[clave];
}

function texto(valor: unknown): string {
  if (typeof valor === 'string') {
    return valor;
  }
  if (typeof valor === 'number' || typeof valor === 'boolean') {
    return String(valor);
  }
  return '';
}

/** Etiqueta legible de un registro según su entidad (para refs y listados). */
function etiquetaDeRegistro(entidad: EntidadDirectorio, registro: RegistroDirectorio): string {
  switch (entidad) {
    case 'barrio':
      return texto(valorDe(registro, 'nombre'));
    case 'lote': {
      const numero = texto(valorDe(registro, 'numero'));
      return numero === '' ? '(lote)' : `Lote ${numero}`;
    }
    case 'propietario': {
      const apellido = texto(valorDe(registro, 'apellido'));
      const nombre = texto(valorDe(registro, 'nombre'));
      return apellido === '' ? nombre : `${apellido}, ${nombre}`;
    }
    case 'familiar': {
      const nombre = texto(valorDe(registro, 'nombre'));
      return nombre === '' ? '(familiar)' : nombre;
    }
    case 'vehiculo':
      return texto(valorDe(registro, 'patente'));
  }
}

@Component({
  selector: 'app-directorio',
  imports: [FormsModule],
  templateUrl: './directorio.html',
  styleUrl: './directorio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Directorio implements OnInit {
  private readonly api = inject(DirectorioAdminService);
  private readonly sincro = inject(SincronizadorService);

  protected readonly entidades = ENTIDADES_DIRECTORIO;
  protected readonly entidad = signal<EntidadDirectorio>('propietario');
  protected readonly consulta = signal('');

  protected readonly items = signal<readonly RegistroDirectorio[]>([]);
  private readonly referencias = signal<
    Readonly<Record<EntidadDirectorio, readonly RegistroDirectorio[]>>
  >({ barrio: [], lote: [], propietario: [], familiar: [], vehiculo: [] });

  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly importando = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly modelo = signal<ModeloFormulario>({});
  protected readonly editandoId = signal<string | null>(null);

  protected readonly barrioImport = signal('El Pare');
  protected readonly csv = signal('');
  protected readonly resultadoImport = signal<ResultadoImportacion | null>(null);

  protected readonly config = computed(() => CONFIG_ENTIDADES[this.entidad()]);
  protected readonly columnas = computed<readonly ColumnaEntidad[]>(() => this.config().columnas);
  protected readonly campos = computed<readonly CampoEntidad[]>(() => this.config().campos);
  protected readonly busqueda = computed(() => this.config().busqueda);

  ngOnInit(): void {
    void this.iniciar();
  }

  private async iniciar(): Promise<void> {
    await this.cargarReferencias();
    await this.recargar();
  }

  // --- Listado ---

  protected async recargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.api.listar(this.entidad(), this.filtroActual()));
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  private filtroActual(): FiltroDirectorio {
    const texto = this.consulta().trim();
    if (texto === '') {
      return {};
    }
    const clave = this.config().busqueda.clave;
    if (clave === 'patente') {
      return { patente: texto };
    }
    if (clave === 'lote') {
      return { lote: texto };
    }
    return { q: texto };
  }

  protected async cambiarEntidad(entidad: EntidadDirectorio): Promise<void> {
    if (entidad === this.entidad()) {
      return;
    }
    this.entidad.set(entidad);
    this.consulta.set('');
    this.mensaje.set(null);
    this.error.set(null);
    this.cancelarEdicion();
    await this.recargar();
  }

  protected valorVisible(registro: RegistroDirectorio, columna: ColumnaEntidad): string {
    const valor = valorDe(registro, columna.clave);
    if (columna.fuente !== undefined) {
      return valor === null || valor === undefined
        ? '—'
        : this.etiquetaReferencia(columna.fuente, texto(valor));
    }
    if (typeof valor === 'boolean') {
      return valor ? 'Sí' : 'No';
    }
    if (valor === null || valor === undefined || valor === '') {
      return '—';
    }
    return texto(valor);
  }

  protected etiquetaRegistro(registro: RegistroDirectorio): string {
    return this.valorVisible(registro, this.columnas()[0] ?? { clave: 'id', etiqueta: 'id' });
  }

  // --- Formulario ---

  protected nuevo(): void {
    this.editandoId.set(null);
    this.modelo.set(this.modeloVacio());
    this.mensaje.set(null);
    this.error.set(null);
  }

  protected editar(registro: RegistroDirectorio): void {
    const modelo: ModeloFormulario = {};
    for (const campo of this.campos()) {
      const valor = valorDe(registro, campo.clave);
      modelo[campo.clave] =
        campo.tipo === 'booleano'
          ? valor === true
          : valor === null || valor === undefined
            ? ''
            : texto(valor);
    }
    this.editandoId.set(texto(valorDe(registro, 'id')));
    this.modelo.set(modelo);
    this.mensaje.set(null);
    this.error.set(null);
  }

  protected cancelarEdicion(): void {
    this.editandoId.set(null);
    this.modelo.set({});
  }

  protected valorModelo(clave: string): ValorFormulario {
    return this.modelo()[clave] ?? '';
  }

  protected actualizarCampo(clave: string, valor: ValorFormulario): void {
    this.modelo.update((m) => ({ ...m, [clave]: valor }));
  }

  protected opciones(campo: CampoEntidad): readonly RegistroDirectorio[] {
    return campo.fuente === undefined ? [] : this.referencias()[campo.fuente];
  }

  protected etiquetaOpcionDe(campo: CampoEntidad, registro: RegistroDirectorio): string {
    return campo.fuente === undefined
      ? texto(valorDe(registro, 'id'))
      : etiquetaDeRegistro(campo.fuente, registro);
  }

  protected nombrePlural(entidad: EntidadDirectorio): string {
    return CONFIG_ENTIDADES[entidad].plural;
  }

  protected async guardar(): Promise<void> {
    const cfg = this.config();
    const modelo = this.modelo();
    const cuerpo: Record<string, unknown> = {};
    const faltantes: string[] = [];

    for (const campo of cfg.campos) {
      const valor = modelo[campo.clave];
      if (campo.tipo === 'booleano') {
        cuerpo[campo.clave] = valor === true;
        continue;
      }
      const limpio = typeof valor === 'string' ? valor.trim() : '';
      cuerpo[campo.clave] = limpio === '' ? null : limpio;
      if (campo.requerido === true && limpio === '') {
        faltantes.push(campo.etiqueta);
      }
    }

    if (faltantes.length > 0) {
      this.error.set(`Faltan campos obligatorios: ${faltantes.join(', ')}.`);
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    try {
      const id = this.editandoId();
      if (id === null) {
        await this.api.crear(cfg.entidad, cuerpo);
        this.mensaje.set(`${cfg.singular} creado.`);
      } else {
        await this.api.actualizar(cfg.entidad, id, cuerpo);
        this.mensaje.set(`${cfg.singular} actualizado.`);
      }
      await Promise.all([this.recargar(), this.cargarReferencias()]);
      this.cancelarEdicion();
      this.refrescarCacheLocal();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  protected async eliminar(registro: RegistroDirectorio): Promise<void> {
    const cfg = this.config();
    const etiqueta = this.etiquetaRegistro(registro);
    if (!window.confirm(`¿Borrar ${cfg.singular.toLowerCase()} "${etiqueta}"?`)) {
      return;
    }
    this.error.set(null);
    try {
      await this.api.eliminar(cfg.entidad, texto(valorDe(registro, 'id')));
      this.mensaje.set(`${cfg.singular} borrado.`);
      await Promise.all([this.recargar(), this.cargarReferencias()]);
      this.refrescarCacheLocal();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }

  // --- Importación CSV ---

  protected alElegirArchivo(evento: Event): void {
    const origen = evento.target;
    if (!(origen instanceof HTMLInputElement)) {
      return;
    }
    const archivo = origen.files?.[0];
    if (archivo === undefined) {
      return;
    }
    void archivo.text().then((contenido) => {
      this.csv.set(contenido);
    });
  }

  protected async importar(): Promise<void> {
    this.error.set(null);
    this.resultadoImport.set(null);
    this.importando.set(true);
    try {
      const resultado = await this.api.importarCsv(this.barrioImport(), this.csv());
      this.resultadoImport.set(resultado);
      this.mensaje.set(
        `Importación: ${String(resultado.creados)} creados, ${String(resultado.actualizados)} actualizados.`,
      );
      await Promise.all([this.recargar(), this.cargarReferencias()]);
      this.refrescarCacheLocal();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.importando.set(false);
    }
  }

  // --- Internos ---

  private modeloVacio(): ModeloFormulario {
    const modelo: ModeloFormulario = {};
    for (const campo of this.campos()) {
      modelo[campo.clave] = campo.tipo === 'booleano' ? true : '';
    }
    return modelo;
  }

  private async cargarReferencias(): Promise<void> {
    const listas: Record<EntidadDirectorio, readonly RegistroDirectorio[]> = {
      barrio: [],
      lote: [],
      propietario: [],
      familiar: [],
      vehiculo: [],
    };
    await Promise.all(
      ENTIDADES_REFERENCIA.map(async (entidad) => {
        listas[entidad] = await this.api.listar(entidad);
      }),
    );
    this.referencias.set(listas);
  }

  private etiquetaReferencia(entidad: EntidadDirectorio, id: string): string {
    const encontrado = this.referencias()[entidad].find(
      (registro) => texto(valorDe(registro, 'id')) === id,
    );
    return encontrado === undefined ? id : etiquetaDeRegistro(entidad, encontrado);
  }

  private refrescarCacheLocal(): void {
    void this.sincro.sincronizar();
  }
}

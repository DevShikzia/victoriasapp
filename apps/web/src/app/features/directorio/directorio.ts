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
  etiquetaTratamiento,
  normalizarTratamiento,
  rangoTratamiento,
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

type ValorFormulario = string | boolean | readonly string[];
type ModeloFormulario = Record<string, ValorFormulario>;

/** Opción unificada para los selects simples y múltiples. */
interface OpcionFormulario {
  readonly valor: string;
  readonly etiqueta: string;
}

/** Convierte un valor desconocido en una lista de ids de texto. */
function idsDe(valor: unknown): readonly string[] {
  if (!Array.isArray(valor)) {
    return [];
  }
  const ids: string[] = [];
  const items: readonly unknown[] = valor;
  for (const item of items) {
    if (typeof item === 'string' && item.trim() !== '') {
      ids.push(item);
    }
  }
  return ids;
}

function comoArreglo(valor: ValorFormulario | undefined): readonly string[] {
  if (typeof valor === 'boolean' || typeof valor === 'string' || valor === undefined) {
    return [];
  }
  return valor;
}

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
    case 'vehiculo': {
      const patente = texto(valorDe(registro, 'patente'));
      if (patente !== '') {
        return patente;
      }
      const descripcion = `${texto(valorDe(registro, 'marca'))} ${texto(
        valorDe(registro, 'modelo'),
      )}`.trim();
      return descripcion === '' ? '(vehículo)' : descripcion;
    }
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

  /** El barrio ya no se edita acá: se elige al iniciar sesión. */
  protected readonly entidades = ENTIDADES_DIRECTORIO.filter((entidad) => entidad !== 'barrio');
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
    if (this.entidad() === 'lote' && columna.clave === 'propietarios') {
      const propietarios = this.propietariosDeLote(texto(valorDe(registro, 'id')));
      return propietarios.length === 0
        ? '—'
        : propietarios.map((propietario) => this.etiquetaPropietario(propietario)).join(' / ');
    }
    if (this.entidad() === 'vehiculo' && columna.clave === 'usuarios') {
      const usuarios = this.usuariosDeVehiculo(registro);
      return usuarios.length === 0 ? '—' : usuarios.join(' · ');
    }

    const valor = valorDe(registro, columna.clave);
    if (columna.fuente !== undefined) {
      return valor === null || valor === undefined
        ? '—'
        : this.etiquetaReferencia(columna.fuente, texto(valor));
    }
    if (columna.clave === 'tratamiento') {
      return (
        etiquetaTratamiento(normalizarTratamiento(typeof valor === 'string' ? valor : null)) ?? '—'
      );
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
      if (campo.clave === 'usuarios') {
        modelo[campo.clave] = [
          ...idsDe(valorDe(registro, 'propietarioIds')).map((id) => `p:${id}`),
          ...idsDe(valorDe(registro, 'familiarIds')).map((id) => `f:${id}`),
        ];
        continue;
      }
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
    if (this.entidad() === 'vehiculo' && clave === 'loteId') {
      const loteId = typeof valor === 'string' ? valor : '';
      const validos = new Set(this.opcionesUsuariosDeLote(loteId).map((opcion) => opcion.valor));
      this.modelo.update((modelo) => ({
        ...modelo,
        loteId,
        usuarios: comoArreglo(modelo['usuarios']).filter((usuario) => validos.has(usuario)),
      }));
      return;
    }
    this.modelo.update((modelo) => ({ ...modelo, [clave]: valor }));
  }

  protected opciones(campo: CampoEntidad): readonly OpcionFormulario[] {
    if (campo.tipo === 'multiseleccion' && campo.opcionesDeLote === true) {
      return this.opcionesUsuariosDeLote(texto(this.modelo()['loteId']));
    }
    if (campo.opciones !== undefined) {
      return campo.opciones;
    }
    if (campo.fuente === undefined) {
      return [];
    }
    const fuente = campo.fuente;
    return this.referencias()[fuente].map((registro) => ({
      valor: texto(valorDe(registro, 'id')),
      etiqueta: etiquetaDeRegistro(fuente, registro),
    }));
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
      if (campo.tipo === 'multiseleccion') {
        const seleccionados = comoArreglo(valor);
        if (campo.clave === 'usuarios') {
          // El formulario usa valores `p:<id>` / `f:<id>`; la API recibe listas.
          cuerpo['propietarioIds'] = seleccionados
            .filter((usuario) => usuario.startsWith('p:'))
            .map((usuario) => usuario.slice(2));
          cuerpo['familiarIds'] = seleccionados
            .filter((usuario) => usuario.startsWith('f:'))
            .map((usuario) => usuario.slice(2));
        } else {
          cuerpo[campo.clave] = seleccionados;
        }
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
      const resultado = await this.api.importarCsv(this.csv());
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
      if (campo.tipo === 'booleano') {
        modelo[campo.clave] = true;
      } else if (campo.tipo === 'multiseleccion') {
        modelo[campo.clave] = [];
      } else {
        modelo[campo.clave] = '';
      }
    }
    return modelo;
  }

  /** Propietarios de un lote, ordenados por jerarquía (señor, señora, …). */
  private propietariosDeLote(loteId: string): readonly RegistroDirectorio[] {
    if (loteId === '') {
      return [];
    }
    return this.referencias()
      .propietario.filter((propietario) => texto(valorDe(propietario, 'loteId')) === loteId)
      .slice()
      .sort((a, b) => this.compararPropietarios(a, b));
  }

  private compararPropietarios(a: RegistroDirectorio, b: RegistroDirectorio): number {
    const tratamientoA = normalizarTratamiento(texto(valorDe(a, 'tratamiento')));
    const tratamientoB = normalizarTratamiento(texto(valorDe(b, 'tratamiento')));
    const porTratamiento = rangoTratamiento(tratamientoA) - rangoTratamiento(tratamientoB);
    if (porTratamiento !== 0) {
      return porTratamiento;
    }
    const porApellido = texto(valorDe(a, 'apellido')).localeCompare(
      texto(valorDe(b, 'apellido')),
      'es',
      { sensitivity: 'base', numeric: true },
    );
    return porApellido !== 0
      ? porApellido
      : texto(valorDe(a, 'nombre')).localeCompare(texto(valorDe(b, 'nombre')), 'es', {
          sensitivity: 'base',
          numeric: true,
        });
  }

  private etiquetaPropietario(propietario: RegistroDirectorio): string {
    const tratamiento = etiquetaTratamiento(
      normalizarTratamiento(texto(valorDe(propietario, 'tratamiento'))),
    );
    const nombre = `${texto(valorDe(propietario, 'nombre'))} ${texto(
      valorDe(propietario, 'apellido'),
    )}`.trim();
    return tratamiento === null ? nombre : `${tratamiento} ${nombre}`;
  }

  /** Nombres de los propietarios y familiares que usan un vehículo. */
  private usuariosDeVehiculo(vehiculo: RegistroDirectorio): readonly string[] {
    const usuarios: string[] = [];
    for (const id of idsDe(valorDe(vehiculo, 'propietarioIds'))) {
      const propietario = this.referencias().propietario.find(
        (registro) => texto(valorDe(registro, 'id')) === id,
      );
      if (propietario !== undefined) {
        usuarios.push(`${etiquetaDeRegistro('propietario', propietario)} (propietario)`);
      }
    }
    for (const id of idsDe(valorDe(vehiculo, 'familiarIds'))) {
      const familiar = this.referencias().familiar.find(
        (registro) => texto(valorDe(registro, 'id')) === id,
      );
      if (familiar !== undefined) {
        usuarios.push(`${etiquetaDeRegistro('familiar', familiar)} (familiar)`);
      }
    }
    return usuarios;
  }

  /** Opciones del multiselect: propietarios y familiares del lote elegido. */
  private opcionesUsuariosDeLote(loteId: string): readonly OpcionFormulario[] {
    if (loteId === '') {
      return [];
    }
    const propietarios = this.propietariosDeLote(loteId);
    const idsPropietarios = new Set(
      propietarios.map((propietario) => texto(valorDe(propietario, 'id'))),
    );
    const familiares = this.referencias()
      .familiar.filter((familiar) => {
        const loteFamiliar = texto(valorDe(familiar, 'loteId'));
        if (loteFamiliar !== '') {
          return loteFamiliar === loteId;
        }
        return idsPropietarios.has(texto(valorDe(familiar, 'propietarioId')));
      })
      .slice()
      .sort((a, b) =>
        texto(valorDe(a, 'nombre')).localeCompare(texto(valorDe(b, 'nombre')), 'es', {
          sensitivity: 'base',
          numeric: true,
        }),
      );

    return [
      ...propietarios.map((propietario) => ({
        valor: `p:${texto(valorDe(propietario, 'id'))}`,
        etiqueta: `${this.etiquetaPropietario(propietario)} · propietario`,
      })),
      ...familiares.map((familiar) => ({
        valor: `f:${texto(valorDe(familiar, 'id'))}`,
        etiqueta: `${etiquetaDeRegistro('familiar', familiar)} · familiar`,
      })),
    ];
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

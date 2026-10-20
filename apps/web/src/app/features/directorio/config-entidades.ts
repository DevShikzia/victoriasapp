import type { EntidadDirectorio } from '@victoriasapp/shared';

/**
 * Definición declarativa de cada entidad del directorio para la pantalla de
 * administración: qué columnas muestra el listado, qué campos tiene el
 * formulario y por qué campo busca.
 */

/** Campo del formulario. */
export interface CampoEntidad {
  readonly clave: string;
  readonly etiqueta: string;
  readonly tipo: 'texto' | 'booleano' | 'seleccion';
  readonly requerido?: boolean;
  /** Para `seleccion`: de qué entidad salen las opciones. */
  readonly fuente?: EntidadDirectorio;
  /** Para `seleccion` con valores fijos (por ejemplo, el tratamiento). */
  readonly opciones?: readonly { readonly valor: string; readonly etiqueta: string }[];
}

/** Columna del listado. */
export interface ColumnaEntidad {
  readonly clave: string;
  readonly etiqueta: string;
  /** Si es una referencia a otra entidad, se muestra su etiqueta legible. */
  readonly fuente?: EntidadDirectorio;
}

export interface ConfigEntidad {
  readonly entidad: EntidadDirectorio;
  readonly singular: string;
  readonly plural: string;
  readonly columnas: readonly ColumnaEntidad[];
  readonly campos: readonly CampoEntidad[];
  /** Campo y etiqueta de búsqueda del listado. */
  readonly busqueda: {
    readonly clave: 'q' | 'patente' | 'lote';
    readonly etiqueta: string;
  };
}

export const CONFIG_ENTIDADES: Readonly<Record<EntidadDirectorio, ConfigEntidad>> = {
  barrio: {
    entidad: 'barrio',
    singular: 'Barrio',
    plural: 'Barrios',
    columnas: [
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'direccion', etiqueta: 'Dirección' },
      { clave: 'activo', etiqueta: 'Activo' },
    ],
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { clave: 'direccion', etiqueta: 'Dirección', tipo: 'texto' },
      { clave: 'activo', etiqueta: 'Activo', tipo: 'booleano' },
    ],
    busqueda: { clave: 'q', etiqueta: 'Buscar por nombre' },
  },
  lote: {
    entidad: 'lote',
    singular: 'Lote',
    plural: 'Lotes',
    columnas: [
      { clave: 'numero', etiqueta: 'Número' },
      { clave: 'calle', etiqueta: 'Calle' },
      { clave: 'barrioId', etiqueta: 'Barrio', fuente: 'barrio' },
      { clave: 'propietarioId', etiqueta: 'Propietario', fuente: 'propietario' },
    ],
    campos: [
      { clave: 'numero', etiqueta: 'Número', tipo: 'texto', requerido: true },
      { clave: 'barrioId', etiqueta: 'Barrio', tipo: 'seleccion', fuente: 'barrio' },
      { clave: 'propietarioId', etiqueta: 'Propietario', tipo: 'seleccion', fuente: 'propietario' },
      { clave: 'calle', etiqueta: 'Calle', tipo: 'texto' },
      { clave: 'notas', etiqueta: 'Notas', tipo: 'texto' },
    ],
    busqueda: { clave: 'q', etiqueta: 'Buscar por número' },
  },
  propietario: {
    entidad: 'propietario',
    singular: 'Propietario',
    plural: 'Propietarios',
    columnas: [
      { clave: 'apellido', etiqueta: 'Apellido' },
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'tratamiento', etiqueta: 'Tratamiento' },
      { clave: 'loteId', etiqueta: 'Lote', fuente: 'lote' },
      { clave: 'telefono', etiqueta: 'Teléfono' },
      { clave: 'activo', etiqueta: 'Activo' },
    ],
    campos: [
      { clave: 'apellido', etiqueta: 'Apellido', tipo: 'texto', requerido: true },
      { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      {
        clave: 'tratamiento',
        etiqueta: 'Tratamiento',
        tipo: 'seleccion',
        opciones: [
          { valor: 'senor', etiqueta: 'Señor' },
          { valor: 'senora', etiqueta: 'Señora' },
        ],
      },
      { clave: 'loteId', etiqueta: 'Lote', tipo: 'seleccion', fuente: 'lote' },
      { clave: 'telefono', etiqueta: 'Teléfono', tipo: 'texto' },
      { clave: 'email', etiqueta: 'Email', tipo: 'texto' },
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'texto' },
      { clave: 'activo', etiqueta: 'Activo', tipo: 'booleano' },
    ],
    busqueda: { clave: 'q', etiqueta: 'Buscar por nombre o apellido' },
  },
  familiar: {
    entidad: 'familiar',
    singular: 'Familiar',
    plural: 'Familiares',
    columnas: [
      { clave: 'nombre', etiqueta: 'Nombre' },
      { clave: 'parentesco', etiqueta: 'Parentesco' },
      { clave: 'propietarioId', etiqueta: 'Propietario', fuente: 'propietario' },
      { clave: 'activo', etiqueta: 'Activo' },
    ],
    campos: [
      { clave: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { clave: 'propietarioId', etiqueta: 'Propietario', tipo: 'seleccion', fuente: 'propietario' },
      { clave: 'loteId', etiqueta: 'Lote', tipo: 'seleccion', fuente: 'lote' },
      { clave: 'parentesco', etiqueta: 'Parentesco', tipo: 'texto' },
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'texto' },
      { clave: 'activo', etiqueta: 'Activo', tipo: 'booleano' },
    ],
    busqueda: { clave: 'q', etiqueta: 'Buscar por nombre' },
  },
  vehiculo: {
    entidad: 'vehiculo',
    singular: 'Vehículo',
    plural: 'Vehículos',
    columnas: [
      { clave: 'patente', etiqueta: 'Patente' },
      { clave: 'marca', etiqueta: 'Marca' },
      { clave: 'modelo', etiqueta: 'Modelo' },
      { clave: 'propietarioId', etiqueta: 'Propietario', fuente: 'propietario' },
      { clave: 'loteId', etiqueta: 'Lote', fuente: 'lote' },
    ],
    campos: [
      { clave: 'patente', etiqueta: 'Patente', tipo: 'texto', requerido: true },
      { clave: 'propietarioId', etiqueta: 'Propietario', tipo: 'seleccion', fuente: 'propietario' },
      { clave: 'familiarId', etiqueta: 'Familiar', tipo: 'seleccion', fuente: 'familiar' },
      { clave: 'loteId', etiqueta: 'Lote', tipo: 'seleccion', fuente: 'lote' },
      { clave: 'marca', etiqueta: 'Marca', tipo: 'texto' },
      { clave: 'modelo', etiqueta: 'Modelo', tipo: 'texto' },
      { clave: 'color', etiqueta: 'Color', tipo: 'texto' },
      { clave: 'descripcion', etiqueta: 'Descripción', tipo: 'texto' },
    ],
    busqueda: { clave: 'patente', etiqueta: 'Buscar por patente' },
  },
};

/** Entidades de las que la pantalla carga listas para resolver referencias y selects. */
export const ENTIDADES_REFERENCIA: readonly EntidadDirectorio[] = [
  'barrio',
  'lote',
  'propietario',
  'familiar',
];

import type {
  FamiliarLocal,
  LoteLocal,
  PropietarioLocal,
  VehiculoLocal,
} from '@victoriasapp/shared';

/** Entidades que puede devolver el buscador global. */
export type TipoResultado = 'propietario' | 'familiar' | 'vehiculo' | 'lote';

/** Resultado individual, con la entidad original para armar la ficha. */
export type ResultadoBusqueda =
  | { readonly tipo: 'propietario'; readonly entidad: PropietarioLocal }
  | { readonly tipo: 'familiar'; readonly entidad: FamiliarLocal }
  | { readonly tipo: 'vehiculo'; readonly entidad: VehiculoLocal }
  | { readonly tipo: 'lote'; readonly entidad: LoteLocal };

/** Resultados agrupados por tipo, ya ordenados por relevancia. */
export interface ResultadosGlobales {
  readonly propietarios: readonly PropietarioLocal[];
  readonly familiares: readonly FamiliarLocal[];
  readonly vehiculos: readonly VehiculoLocal[];
  readonly lotes: readonly LoteLocal[];
  readonly total: number;
}

export const RESULTADOS_VACIOS: ResultadosGlobales = {
  propietarios: [],
  familiares: [],
  vehiculos: [],
  lotes: [],
  total: 0,
};

/** Una fila etiqueta/valor de la ficha. */
export interface FilaDetalle {
  readonly etiqueta: string;
  readonly valor: string;
}

/**
 * Modelo listo para mostrar la ficha de un resultado: datos propios más las
 * personas y vehículos relacionados (por propietario y/o lote).
 */
export interface DetalleFicha {
  readonly tipo: TipoResultado;
  readonly titulo: string;
  readonly subtitulo: string | null;
  readonly filas: readonly FilaDetalle[];
  readonly propietarios: readonly PropietarioLocal[];
  readonly familiares: readonly FamiliarLocal[];
  readonly vehiculos: readonly VehiculoLocal[];
}

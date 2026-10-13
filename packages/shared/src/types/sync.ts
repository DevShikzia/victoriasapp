/**
 * Tipos del patrón **outbox** (cola de cambios pendientes de sincronizar).
 * Ver docs/07-offline-y-sincronizacion.md.
 */

export const ENTIDADES_SYNC = ['visita', 'propietario', 'vehiculo', 'lote', 'familiar'] as const;
export type EntidadSync = (typeof ENTIDADES_SYNC)[number];

export const OPERACIONES_SYNC = ['create', 'update', 'delete'] as const;
export type OperacionSync = (typeof OPERACIONES_SYNC)[number];

/** Un cambio local pendiente de enviar a la API. */
export interface OutboxItem {
  readonly id: string;
  readonly entidad: EntidadSync;
  readonly operacion: OperacionSync;
  readonly uuid: string;
  readonly payload: Record<string, unknown>;
  /** ISO de creación local. */
  readonly creadoEn: string;
  readonly intentos: number;
  readonly ultimoError: string | null;
}

/** Resultado del `POST /api/sync`. */
export interface ResultadoSync {
  readonly aplicados: readonly string[];
  readonly duplicados: readonly string[];
  readonly errores: readonly ErrorSync[];
}

export interface ErrorSync {
  readonly uuid: string;
  readonly mensaje: string;
}

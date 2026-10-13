/**
 * Tipos del canal de **tiempo real** (Socket.IO), compartidos por la API y el
 * PWA. El servidor emite y el panel escucha; los nombres de evento y la forma de
 * la carga son el contrato entre ambos.
 *
 * Ver docs/01-arquitectura.md y docs/05-api-rest.md.
 */

import type { EntidadDirectorio } from './directorio.js';
import type { VisitaDto } from './visita.js';

/** Namespace de Socket.IO. */
export const NAMESPACE_TIEMPO_REAL = '/realtime';

export const EVENTOS_TIEMPO_REAL = [
  'conectado',
  'visita:creada',
  'visita:actualizada',
  'directorio:actualizado',
] as const;
export type NombreEventoTiempoReal = (typeof EVENTOS_TIEMPO_REAL)[number];

/** Carga de los eventos que llevan una visita. */
export interface CargaVisita {
  readonly visita: VisitaDto;
}

/** Carga de `directorio:actualizado`: indica qué cambió para que el cliente refresque. */
export interface CargaDirectorio {
  readonly entidad: EntidadDirectorio;
  readonly uuid: string;
  readonly operacion: 'crear' | 'actualizar' | 'eliminar';
}

/** Carga de `conectado`: confirma la autenticación del socket. */
export interface CargaConectado {
  readonly usuario: string;
  readonly nombre: string;
  readonly rol: string;
}

/** Mapa nombre de evento → forma del payload (para tipar el cliente). */
export interface MapaEventosTiempoReal {
  readonly conectado: CargaConectado;
  readonly 'visita:creada': CargaVisita;
  readonly 'visita:actualizada': CargaVisita;
  readonly 'directorio:actualizado': CargaDirectorio;
}

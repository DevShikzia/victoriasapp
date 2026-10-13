import Dexie, { type Table } from 'dexie';
import type {
  FamiliarLocal,
  LoteLocal,
  MetaLocal,
  OutboxItem,
  PropietarioLocal,
  SesionLocal,
  VehiculoLocal,
  Visita,
} from '@victoriasapp/shared';

/**
 * Base de datos local del PWA (IndexedDB vía Dexie).
 *
 * El celular es la fuente de verdad mientras no hay red: cada visita se guarda
 * acá **y** en `outbox` en la misma transacción, para no perder nada.
 * Ver docs/07-offline-y-sincronizacion.md.
 */
export class BaseLocal extends Dexie {
  declare readonly visitas: Table<Visita, string>;
  declare readonly outbox: Table<OutboxItem, string>;
  declare readonly lotes: Table<LoteLocal, string>;
  declare readonly propietarios: Table<PropietarioLocal, string>;
  declare readonly familiares: Table<FamiliarLocal, string>;
  declare readonly vehiculos: Table<VehiculoLocal, string>;
  declare readonly sesion: Table<SesionLocal, string>;
  declare readonly meta: Table<MetaLocal, string>;

  constructor() {
    super('victoriasapp');
    this.version(1).stores({
      visitas: 'uuid, entradaEn, dni, patente, loteNumero, estadoSync',
      outbox: 'id, entidad, uuid, creadoEn',
      lotes: 'uuid, numero',
      propietarios: 'uuid, apellido, nombre, loteNumero',
      familiares: 'uuid, nombre, propietarioNombre, loteNumero',
      vehiculos: 'uuid, patente, loteNumero',
      sesion: 'usuario',
      meta: 'clave',
    });
  }
}

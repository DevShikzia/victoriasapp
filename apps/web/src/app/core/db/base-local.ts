import Dexie, { type Table } from 'dexie';
import type {
  DomesticaLocal,
  FamiliarLocal,
  LoteLocal,
  MetaLocal,
  OutboxItem,
  PropietarioLocal,
  RegistroDomesticaLocal,
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
  declare readonly domesticas: Table<DomesticaLocal, string>;
  declare readonly registrosDomesticas: Table<RegistroDomesticaLocal, string>;
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
    // v2: los vehículos ahora pueden tener varios usuarios. Completamos el
    // campo nuevo en las cachés viejas para que la búsqueda siga funcionando.
    this.version(2)
      .stores({
        visitas: 'uuid, entradaEn, dni, patente, loteNumero, estadoSync',
        outbox: 'id, entidad, uuid, creadoEn',
        lotes: 'uuid, numero',
        propietarios: 'uuid, apellido, nombre, loteNumero',
        familiares: 'uuid, nombre, propietarioNombre, loteNumero',
        vehiculos: 'uuid, patente, loteNumero',
        sesion: 'usuario',
        meta: 'clave',
      })
      .upgrade(async (transaccion) => {
        await transaccion
          .table<VehiculoLocal>('vehiculos')
          .toCollection()
          .modify((vehiculo) => {
            const mutable: {
              usuariosNombres?: readonly string[];
              propietarioNombre?: string | null;
            } = vehiculo;
            mutable.usuariosNombres ??=
              mutable.propietarioNombre === null || mutable.propietarioNombre === undefined
                ? []
                : [mutable.propietarioNombre];
          });
      });
    // v3: elimina los datos de ejemplo (`demo-*`) que hayan quedado en cachés
    // viejas. Se ejecuta una sola vez por dispositivo.
    this.version(3)
      .stores({
        visitas: 'uuid, entradaEn, dni, patente, loteNumero, estadoSync',
        outbox: 'id, entidad, uuid, creadoEn',
        lotes: 'uuid, numero',
        propietarios: 'uuid, apellido, nombre, loteNumero',
        familiares: 'uuid, nombre, propietarioNombre, loteNumero',
        vehiculos: 'uuid, patente, loteNumero',
        sesion: 'usuario',
        meta: 'clave',
      })
      .upgrade(async (transaccion) => {
        const tablas = ['visitas', 'outbox', 'lotes', 'propietarios', 'familiares', 'vehiculos'];
        for (const nombre of tablas) {
          await transaccion
            .table(nombre)
            .filter(
              (item: { uuid?: unknown }) =>
                typeof item.uuid === 'string' && item.uuid.startsWith('demo-'),
            )
            .delete();
        }
      });
    // v4: perfiles de domésticas y sus registros de entrada/salida.
    this.version(4).stores({
      visitas: 'uuid, entradaEn, dni, patente, loteNumero, estadoSync',
      outbox: 'id, entidad, uuid, creadoEn',
      lotes: 'uuid, numero',
      propietarios: 'uuid, apellido, nombre, loteNumero',
      familiares: 'uuid, nombre, propietarioNombre, loteNumero',
      vehiculos: 'uuid, patente, loteNumero',
      domesticas: 'uuid, dni, apellido, nombre, lotePrincipalUuid, activo',
      registrosDomesticas: 'uuid, domesticaUuid, loteUuid, entradaEn, salidaEn, estadoSync',
      sesion: 'usuario',
      meta: 'clave',
    });
  }
}

let instancia: BaseLocal | null = null;

/** Devuelve la única instancia de la base local (evita abrir la DB dos veces). */
export function obtenerBaseLocal(): BaseLocal {
  instancia ??= new BaseLocal();
  return instancia;
}

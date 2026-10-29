import type {
  FamiliarLocal,
  LoteLocal,
  PropietarioLocal,
  VehiculoLocal,
} from '@victoriasapp/shared';

import { obtenerBaseLocal } from './base-local';

const AHORA = new Date().toISOString();

/**
 * Carga datos de prueba en IndexedDB para los specs.
 *
 * No se usa en la aplicación: los datos de ejemplo se eliminaron del PWA y
 * esta función solo existe para conservar la cobertura de los tests.
 */
export async function sembrarDirectorioDePrueba(): Promise<void> {
  const db = obtenerBaseLocal();

  const lotes: readonly LoteLocal[] = [
    {
      uuid: 'demo-lote-42',
      numero: '42',
      calle: 'Los Álamos',
      propietarioNombre: 'PEREZ, ANA',
      actualizadoEn: AHORA,
    },
    {
      uuid: 'demo-lote-12',
      numero: '12',
      calle: 'Los Ceibos',
      propietarioNombre: 'GOMEZ, LUIS',
      actualizadoEn: AHORA,
    },
    {
      uuid: 'demo-lote-7',
      numero: '7',
      calle: 'Las Acacias',
      propietarioNombre: 'DIAZ, MARIA',
      actualizadoEn: AHORA,
    },
  ];

  const propietarios: readonly PropietarioLocal[] = [
    {
      uuid: 'demo-prop-1',
      nombre: 'ANA',
      apellido: 'PEREZ',
      tratamiento: 'senora',
      telefono: '11-5555-0001',
      email: null,
      descripcion: 'Titular del lote 42',
      loteNumero: '42',
      actualizadoEn: AHORA,
    },
    {
      uuid: 'demo-prop-2',
      nombre: 'LUIS',
      apellido: 'GOMEZ',
      tratamiento: 'senor',
      telefono: '11-5555-0002',
      email: null,
      descripcion: null,
      loteNumero: '12',
      actualizadoEn: AHORA,
    },
    {
      uuid: 'demo-prop-3',
      nombre: 'MARIA',
      apellido: 'DIAZ',
      tratamiento: 'senora',
      telefono: null,
      email: null,
      descripcion: 'Alquila el lote 7',
      loteNumero: '7',
      actualizadoEn: AHORA,
    },
  ];

  const familiares: readonly FamiliarLocal[] = [
    {
      uuid: 'demo-fam-1',
      nombre: 'JUAN PEREZ',
      parentesco: 'hijo',
      propietarioNombre: 'PEREZ, ANA',
      loteNumero: '42',
      actualizadoEn: AHORA,
    },
  ];

  const vehiculos: readonly VehiculoLocal[] = [
    {
      uuid: 'demo-veh-1',
      patente: 'AB123CD',
      marca: 'Toyota',
      modelo: 'Corolla',
      color: 'Gris',
      usuariosNombres: ['PEREZ, ANA'],
      propietarioNombre: 'PEREZ, ANA',
      loteNumero: '42',
      actualizadoEn: AHORA,
    },
    {
      uuid: 'demo-veh-2',
      patente: 'AC456EF',
      marca: 'Ford',
      modelo: 'Ranger',
      color: 'Negro',
      usuariosNombres: ['GOMEZ, LUIS'],
      propietarioNombre: 'GOMEZ, LUIS',
      loteNumero: '12',
      actualizadoEn: AHORA,
    },
  ];

  await db.transaction(
    'rw',
    db.lotes,
    db.propietarios,
    db.familiares,
    db.vehiculos,
    async () => {
      await db.lotes.bulkPut([...lotes]);
      await db.propietarios.bulkPut([...propietarios]);
      await db.familiares.bulkPut([...familiares]);
      await db.vehiculos.bulkPut([...vehiculos]);
    },
  );
}

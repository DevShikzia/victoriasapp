import type {
  FamiliarLocal,
  LoteLocal,
  PropietarioLocal,
  VehiculoLocal,
} from '@victoriasapp/shared';

/** Datos ficticios para probar el flujo sin depender de la API. */
export interface DatosDeEjemplo {
  readonly lotes: readonly LoteLocal[];
  readonly propietarios: readonly PropietarioLocal[];
  readonly familiares: readonly FamiliarLocal[];
  readonly vehiculos: readonly VehiculoLocal[];
}

const AHORA = new Date().toISOString();

export function datosDeEjemplo(): DatosDeEjemplo {
  const lotes: LoteLocal[] = [
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

  const propietarios: PropietarioLocal[] = [
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

  const familiares: FamiliarLocal[] = [
    {
      uuid: 'demo-fam-1',
      nombre: 'JUAN PEREZ',
      parentesco: 'hijo',
      propietarioNombre: 'PEREZ, ANA',
      loteNumero: '42',
      actualizadoEn: AHORA,
    },
  ];

  const vehiculos: VehiculoLocal[] = [
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

  return { lotes, propietarios, familiares, vehiculos };
}

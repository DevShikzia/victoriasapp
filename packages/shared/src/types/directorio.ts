/**
 * Tipos del **directorio** del barrio, en su versión cacheada para uso offline.
 *
 * Son una proyección simplificada de las colecciones de la API (lotes,
 * propietarios, familiares, vehículos) más el `uuid` y `actualizadoEn` que usa
 * la sincronización.
 */

export interface LoteLocal {
  readonly uuid: string;
  readonly numero: string;
  readonly calle: string | null;
  readonly propietarioNombre: string | null;
  readonly actualizadoEn: string;
}

export interface PropietarioLocal {
  readonly uuid: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly telefono: string | null;
  readonly email: string | null;
  readonly descripcion: string | null;
  readonly loteNumero: string | null;
  readonly actualizadoEn: string;
}

export interface FamiliarLocal {
  readonly uuid: string;
  readonly nombre: string;
  readonly parentesco: string | null;
  readonly propietarioNombre: string;
  readonly loteNumero: string | null;
  readonly actualizadoEn: string;
}

export interface VehiculoLocal {
  readonly uuid: string;
  readonly patente: string;
  readonly marca: string | null;
  readonly modelo: string | null;
  readonly color: string | null;
  readonly propietarioNombre: string | null;
  readonly loteNumero: string | null;
  readonly actualizadoEn: string;
}

/** Datos de sesión recordados en el dispositivo. */
export interface SesionLocal {
  readonly usuario: string;
  readonly nombre: string;
  readonly rol: string;
  readonly accessToken: string;
  readonly expiraEn: string;
}

/** Metadatos locales (última sync, versión de esquema). */
export interface MetaLocal {
  readonly clave: string;
  readonly valor: string;
}

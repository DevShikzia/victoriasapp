/**
 * Tipos del **directorio** del barrio, en su versión cacheada para uso offline.
 *
 * Son una proyección simplificada de las colecciones de la API (lotes,
 * propietarios, familiares, vehículos) más el `uuid` y `actualizadoEn` que usa
 * la sincronización.
 */

import type { RolUsuario } from './dominio.js';

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
  /** Nombre de usuario; es la clave primaria de la tabla `sesion`. */
  readonly usuario: string;
  readonly id: string;
  readonly nombre: string;
  readonly rol: RolUsuario;
  readonly garitaId: string | null;
  readonly accessToken: string;
  /** Vencimiento del access token, en ISO. */
  readonly expiraEn: string;
}

/** Metadatos locales (última sync, versión de esquema). */
export interface MetaLocal {
  readonly clave: string;
  readonly valor: string;
}

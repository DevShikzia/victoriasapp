import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  BarrioDto,
  EntidadDirectorio,
  FamiliarDto,
  LoteDto,
  PropietarioDto,
  ResultadoImportacion,
  VehiculoDto,
} from '@victoriasapp/shared';
import { firstValueFrom } from 'rxjs';

import { CONFIG } from '../config/config';

interface RespuestaApi<T> {
  readonly ok: boolean;
  readonly data: T;
}

/** DTO que devuelve la API para cada entidad del directorio. */
export interface MapaDtoDirectorio {
  readonly barrio: BarrioDto;
  readonly lote: LoteDto;
  readonly propietario: PropietarioDto;
  readonly familiar: FamiliarDto;
  readonly vehiculo: VehiculoDto;
}

/** Registro del directorio, sin importar la entidad (unión de DTOs). */
export type RegistroDirectorio = MapaDtoDirectorio[EntidadDirectorio];

/** Filtros de búsqueda aceptados por los listados del directorio. */
export interface FiltroDirectorio {
  readonly q?: string;
  readonly patente?: string;
  readonly lote?: string;
  readonly propietarioId?: string;
  readonly barrioId?: string;
}

/** Prefijo de la API por entidad (`lote` → `/api/lotes`). */
const RUTA: Readonly<Record<EntidadDirectorio, string>> = {
  barrio: 'barrios',
  lote: 'lotes',
  propietario: 'propietarios',
  familiar: 'familiares',
  vehiculo: 'vehiculos',
};

/**
 * ABM del directorio contra la API (online, admin/supervisor). Es la contraparte
 * de escritura del pull incremental que cachea `DatosService`.
 */
@Injectable({ providedIn: 'root' })
export class DirectorioAdminService {
  private readonly http = inject(HttpClient);

  private url(entidad: EntidadDirectorio): string {
    return `${CONFIG.apiBaseUrl}/api/${RUTA[entidad]}`;
  }

  async listar<E extends EntidadDirectorio>(
    entidad: E,
    filtro: FiltroDirectorio = {},
  ): Promise<readonly MapaDtoDirectorio[E][]> {
    let params = new HttpParams();
    const poner = (clave: keyof FiltroDirectorio): void => {
      const valor = filtro[clave];
      if (valor !== undefined && valor.trim() !== '') {
        params = params.set(clave, valor.trim());
      }
    };
    poner('q');
    poner('patente');
    poner('lote');
    poner('propietarioId');
    poner('barrioId');

    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<readonly MapaDtoDirectorio[E][]>>(this.url(entidad), { params }),
    );
    return respuesta.data;
  }

  async crear<E extends EntidadDirectorio>(
    entidad: E,
    cuerpo: Record<string, unknown>,
  ): Promise<MapaDtoDirectorio[E]> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaApi<MapaDtoDirectorio[E]>>(this.url(entidad), cuerpo),
    );
    return respuesta.data;
  }

  async actualizar<E extends EntidadDirectorio>(
    entidad: E,
    id: string,
    cuerpo: Record<string, unknown>,
  ): Promise<MapaDtoDirectorio[E]> {
    const respuesta = await firstValueFrom(
      this.http.patch<RespuestaApi<MapaDtoDirectorio[E]>>(`${this.url(entidad)}/${id}`, cuerpo),
    );
    return respuesta.data;
  }

  async eliminar(entidad: EntidadDirectorio, id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<RespuestaApi<{ readonly eliminado: boolean }>>(`${this.url(entidad)}/${id}`),
    );
  }

  /**
   * Importa un CSV completo en el barrio activo de la cuenta (lotes,
   * propietarios, familiares y vehículos).
   */
  async importarCsv(csv: string): Promise<ResultadoImportacion> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaApi<ResultadoImportacion>>(
        `${CONFIG.apiBaseUrl}/api/directorio/importar`,
        { csv },
      ),
    );
    return respuesta.data;
  }
}

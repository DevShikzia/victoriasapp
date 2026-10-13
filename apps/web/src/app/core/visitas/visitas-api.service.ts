import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { VisitaDto } from '@victoriasapp/shared';
import { firstValueFrom } from 'rxjs';

import { CONFIG } from '../config/config';

interface RespuestaApi<T> {
  readonly ok: boolean;
  readonly data: T;
}

/** Filtros del histórico de visitas (`GET /api/visits`). Todo opcional. */
export interface FiltroVisitas {
  /** Texto libre: apellido, nombre, DNI, patente, lote o propietario. */
  readonly q?: string;
  readonly estado?: 'dentro' | 'fuera';
  readonly lote?: string;
  /** ISO (inclusive). */
  readonly desde?: string;
  /** ISO (inclusive). */
  readonly hasta?: string;
  readonly limite?: number;
}

/**
 * Consulta el **histórico** de visitas ya sincronizadas (la API), a diferencia
 * de `DatosService`, que trabaja contra la base local del dispositivo.
 */
@Injectable({ providedIn: 'root' })
export class VisitasApiService {
  private readonly http = inject(HttpClient);

  async buscar(filtro: FiltroVisitas = {}): Promise<readonly VisitaDto[]> {
    let params = new HttpParams();
    const poner = (clave: string, valor: string | undefined): void => {
      const limpio = valor?.trim() ?? '';
      if (limpio !== '') {
        params = params.set(clave, limpio);
      }
    };
    poner('q', filtro.q);
    poner('estado', filtro.estado);
    poner('lote', filtro.lote);
    poner('desde', filtro.desde);
    poner('hasta', filtro.hasta);
    if (filtro.limite !== undefined) {
      params = params.set('limit', String(filtro.limite));
    }

    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<readonly VisitaDto[]>>(`${CONFIG.apiBaseUrl}/api/visits`, {
        params,
      }),
    );
    return respuesta.data;
  }
}

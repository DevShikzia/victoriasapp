import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type {
  ActualizarDomestica,
  CrearDomestica,
  DomesticaDto,
  FiltroRegistrosDomesticas,
  RegistroDomesticaDto,
} from '@victoriasapp/shared';
import { firstValueFrom } from 'rxjs';

import { CONFIG } from '../config/config';

interface RespuestaApi<T> {
  readonly ok: boolean;
  readonly data: T;
}

/** ABM online de perfiles de domésticas y consulta del historial. */
@Injectable({ providedIn: 'root' })
export class DomesticasApiService {
  private readonly http = inject(HttpClient);

  async listar(): Promise<readonly DomesticaDto[]> {
    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<readonly DomesticaDto[]>>(`${CONFIG.apiBaseUrl}/api/domesticas`),
    );
    return respuesta.data;
  }

  async crear(datos: CrearDomestica): Promise<DomesticaDto> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaApi<DomesticaDto>>(`${CONFIG.apiBaseUrl}/api/domesticas`, datos),
    );
    return respuesta.data;
  }

  async actualizar(uuid: string, datos: ActualizarDomestica): Promise<DomesticaDto> {
    const respuesta = await firstValueFrom(
      this.http.patch<RespuestaApi<DomesticaDto>>(
        `${CONFIG.apiBaseUrl}/api/domesticas/${encodeURIComponent(uuid)}`,
        datos,
      ),
    );
    return respuesta.data;
  }

  async desactivar(uuid: string): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${CONFIG.apiBaseUrl}/api/domesticas/${encodeURIComponent(uuid)}`),
    );
  }

  async registros(
    filtro: FiltroRegistrosDomesticas = {},
  ): Promise<readonly RegistroDomesticaDto[]> {
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
    poner('domestica', filtro.domestica);
    poner('desde', filtro.desde);
    poner('hasta', filtro.hasta);
    if (filtro.limite !== undefined) {
      params = params.set('limit', String(filtro.limite));
    }

    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<readonly RegistroDomesticaDto[]>>(
        `${CONFIG.apiBaseUrl}/api/domesticas/registros`,
        { params },
      ),
    );
    return respuesta.data;
  }
}

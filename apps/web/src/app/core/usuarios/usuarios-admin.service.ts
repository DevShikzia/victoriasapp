import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { ActualizarUsuario, CrearUsuario, UsuarioAdmin } from '@victoriasapp/shared';
import { firstValueFrom } from 'rxjs';

import { CONFIG } from '../config/config';

interface RespuestaApi<T> {
  readonly ok: boolean;
  readonly data: T;
}

/**
 * ABM de usuarios contra la API (`/api/users`, sólo `admin`). Es una operación
 * **online**: no se cachea en IndexedDB, el listado se pide siempre al servidor.
 */
@Injectable({ providedIn: 'root' })
export class UsuariosAdminService {
  private readonly http = inject(HttpClient);
  private readonly url = `${CONFIG.apiBaseUrl}/api/users`;

  /** Lista todos los usuarios (activos e inactivos), ordenados por usuario. */
  async listar(): Promise<readonly UsuarioAdmin[]> {
    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<readonly UsuarioAdmin[]>>(this.url),
    );
    return respuesta.data;
  }

  async crear(cuerpo: CrearUsuario): Promise<UsuarioAdmin> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaApi<UsuarioAdmin>>(this.url, cuerpo),
    );
    return respuesta.data;
  }

  async actualizar(id: string, cuerpo: ActualizarUsuario): Promise<UsuarioAdmin> {
    const respuesta = await firstValueFrom(
      this.http.patch<RespuestaApi<UsuarioAdmin>>(`${this.url}/${id}`, cuerpo),
    );
    return respuesta.data;
  }

  /** Baja lógica: el usuario queda `activo: false` y se revocan sus sesiones. */
  async desactivar(id: string): Promise<void> {
    await firstValueFrom(
      this.http.delete<RespuestaApi<{ desactivado: boolean }>>(`${this.url}/${id}`),
    );
  }
}

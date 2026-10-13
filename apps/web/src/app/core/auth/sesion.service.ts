import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { Credenciales, RespuestaLogin, UsuarioPublico } from '@victoriasapp/shared';
import { firstValueFrom } from 'rxjs';

import { CONFIG } from '../config/config';
import { obtenerBaseLocal } from '../db/base-local';

interface RespuestaApi<T> {
  readonly ok: boolean;
  readonly data: T;
}

/**
 * Sesión del usuario: guarda el access token en memoria y la sesión en
 * IndexedDB para sobrevivir recargas. El refresh token vive en una cookie
 * httpOnly que maneja el servidor.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly http = inject(HttpClient);
  private readonly db = obtenerBaseLocal();

  private readonly usuarioActual = signal<UsuarioPublico | null>(null);
  private readonly listoActual = signal(false);
  private accessToken: string | null = null;

  readonly usuario = this.usuarioActual.asReadonly();
  readonly listo = this.listoActual.asReadonly();
  readonly autenticado = computed(() => this.usuarioActual() !== null);

  /** Restaura la sesión guardada en el dispositivo (al abrir la app). */
  async inicializar(): Promise<void> {
    if (this.listoActual()) {
      return;
    }
    const guardada = await this.db.sesion.toCollection().first();
    if (guardada !== undefined) {
      this.accessToken = guardada.accessToken;
      this.usuarioActual.set({
        id: guardada.id,
        usuario: guardada.usuario,
        nombre: guardada.nombre,
        rol: guardada.rol,
        garitaId: guardada.garitaId,
      });
    }
    this.listoActual.set(true);
  }

  token(): string | null {
    return this.accessToken;
  }

  async login(credenciales: Credenciales): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaApi<RespuestaLogin>>(
        `${CONFIG.apiBaseUrl}/api/auth/login`,
        credenciales,
        {
          withCredentials: true,
        },
      ),
    );
    await this.guardar(respuesta.data);
  }

  /** Renueva el access token usando la cookie de refresh. */
  async renovar(): Promise<boolean> {
    try {
      const respuesta = await firstValueFrom(
        this.http.post<RespuestaApi<RespuestaLogin>>(
          `${CONFIG.apiBaseUrl}/api/auth/refresh`,
          {},
          { withCredentials: true },
        ),
      );
      await this.guardar(respuesta.data);
      return true;
    } catch {
      await this.limpiar();
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${CONFIG.apiBaseUrl}/api/auth/logout`, {}, { withCredentials: true }),
      );
    } catch {
      // Sin red igual cerramos localmente.
    }
    await this.limpiar();
  }

  private async guardar(respuesta: RespuestaLogin): Promise<void> {
    this.accessToken = respuesta.accessToken;
    this.usuarioActual.set(respuesta.usuario);
    await this.db.sesion.put({
      usuario: respuesta.usuario.usuario,
      id: respuesta.usuario.id,
      nombre: respuesta.usuario.nombre,
      rol: respuesta.usuario.rol,
      garitaId: respuesta.usuario.garitaId,
      accessToken: respuesta.accessToken,
      expiraEn: new Date(respuesta.expiraEn).toISOString(),
    });
  }

  private async limpiar(): Promise<void> {
    this.accessToken = null;
    this.usuarioActual.set(null);
    await this.db.sesion.clear();
  }
}

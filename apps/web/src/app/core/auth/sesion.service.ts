import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type {
  BarrioDto,
  Credenciales,
  ElegirBarrio,
  RespuestaLogin,
  SesionLocal,
  UsuarioPublico,
} from '@victoriasapp/shared';
import { META_ULTIMA_SYNC_DIRECTORIO } from '@victoriasapp/shared';
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
  /** Evita que varias peticiones renueven el refresh token a la vez. */
  private renovacion: Promise<boolean> | null = null;

  readonly usuario = this.usuarioActual.asReadonly();
  readonly listo = this.listoActual.asReadonly();
  readonly autenticado = computed(() => this.usuarioActual() !== null);
  readonly barrioId = computed(() => this.usuarioActual()?.barrioId ?? null);
  readonly barrioNombre = computed(() => this.usuarioActual()?.barrioNombre ?? null);

  /** Restaura la sesión guardada en el dispositivo (al abrir la app). */
  async inicializar(): Promise<void> {
    if (this.listoActual()) {
      return;
    }
    const sesiones = await this.db.sesion.toArray();
    // Si el usuario ya inició sesión mientras leíamos IndexedDB, no pisamos su
    // estado con una sesión vieja.
    if (this.usuarioActual() !== null) {
      this.listoActual.set(true);
      return;
    }
    const guardada = sesiones.reduce<SesionLocal | undefined>(
      (masNueva, sesion) =>
        masNueva === undefined || (sesion.guardadaEn ?? '') >= (masNueva.guardadaEn ?? '')
          ? sesion
          : masNueva,
      undefined,
    );
    if (guardada !== undefined) {
      this.accessToken = guardada.accessToken;
      this.usuarioActual.set({
        id: guardada.id,
        usuario: guardada.usuario,
        nombre: guardada.nombre,
        rol: guardada.rol,
        garitaId: guardada.garitaId,
        barrioId: guardada.barrioId ?? null,
        barrioNombre: guardada.barrioNombre ?? null,
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

  /** Barrios activos que se pueden elegir en el primer ingreso. */
  async listarBarrios(): Promise<readonly BarrioDto[]> {
    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<readonly BarrioDto[]>>(`${CONFIG.apiBaseUrl}/api/auth/barrios`, {
        withCredentials: true,
      }),
    );
    return respuesta.data;
  }

  /** Elige el barrio de la cuenta (existente o nuevo). */
  async elegirBarrio(datos: ElegirBarrio): Promise<void> {
    const respuesta = await firstValueFrom(
      this.http.put<RespuestaApi<RespuestaLogin>>(`${CONFIG.apiBaseUrl}/api/auth/barrio`, datos, {
        withCredentials: true,
      }),
    );
    await this.guardar(respuesta.data);
  }

  /** Renueva el access token usando la cookie de refresh. */
  renovar(): Promise<boolean> {
    this.renovacion ??= this.renovarAhora().finally(() => {
      this.renovacion = null;
    });
    return this.renovacion;
  }

  private async renovarAhora(): Promise<boolean> {
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

  /**
   * Si la cuenta cambia de barrio (otra persona usa el mismo celular), borra el
   * directorio cacheado para no mezclar datos. Las visitas locales se conservan.
   */
  private async prepararBarrio(nuevoBarrioId: string | null, usuario: string): Promise<void> {
    const sesiones = await this.db.sesion.toArray();
    const debeLimpiar = sesiones.some(
      (sesion) => sesion.usuario !== usuario || (sesion.barrioId ?? null) !== nuevoBarrioId,
    );
    if (!debeLimpiar) {
      return;
    }
    await this.db.transaction(
      'rw',
      this.db.lotes,
      this.db.propietarios,
      this.db.familiares,
      this.db.vehiculos,
      this.db.meta,
      async () => {
        await this.db.lotes.clear();
        await this.db.propietarios.clear();
        await this.db.familiares.clear();
        await this.db.vehiculos.clear();
        await this.db.meta.delete(META_ULTIMA_SYNC_DIRECTORIO);
      },
    );
  }

  private async guardar(respuesta: RespuestaLogin): Promise<void> {
    await this.prepararBarrio(respuesta.usuario.barrioId, respuesta.usuario.usuario);
    this.accessToken = respuesta.accessToken;
    this.usuarioActual.set(respuesta.usuario);
    this.listoActual.set(true);
    // Una sola sesión recordada: evita restaurar una cuenta vieja al abrir.
    await this.db.sesion.clear();
    await this.db.sesion.put({
      usuario: respuesta.usuario.usuario,
      id: respuesta.usuario.id,
      nombre: respuesta.usuario.nombre,
      rol: respuesta.usuario.rol,
      garitaId: respuesta.usuario.garitaId,
      barrioId: respuesta.usuario.barrioId,
      barrioNombre: respuesta.usuario.barrioNombre,
      accessToken: respuesta.accessToken,
      expiraEn: new Date(respuesta.expiraEn).toISOString(),
      guardadaEn: new Date().toISOString(),
    });
  }

  private async limpiar(): Promise<void> {
    this.accessToken = null;
    this.usuarioActual.set(null);
    await this.db.sesion.clear();
  }
}

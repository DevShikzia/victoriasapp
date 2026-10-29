import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import type { DirectorioPull, ResultadoSync, SolicitudSync } from '@victoriasapp/shared';
import { META_ULTIMA_SYNC_DIRECTORIO } from '@victoriasapp/shared';
import { firstValueFrom } from 'rxjs';

import { CONFIG } from '../config/config';
import { SesionService } from '../auth/sesion.service';
import { DatosService } from '../db/datos.service';

interface RespuestaApi<T> {
  readonly ok: boolean;
  readonly data: T;
}

/**
 * Manda al servidor las visitas creadas offline.
 * Es seguro reintentar: la API deduplica por `uuid`.
 */
@Injectable({ providedIn: 'root' })
export class SincronizadorService {
  private readonly http = inject(HttpClient);
  private readonly datos = inject(DatosService);
  private readonly sesion = inject(SesionService);

  readonly sincronizando = signal(false);
  readonly ultimoMensaje = signal<string | null>(null);

  /** Devuelve `true` si pudo sincronizar (o si no había nada que enviar). */
  async sincronizar(): Promise<boolean> {
    if (!this.sesion.autenticado() || this.sesion.barrioId() === null || !navigator.onLine) {
      return false;
    }
    this.sincronizando.set(true);
    this.ultimoMensaje.set(null);
    try {
      const partes: string[] = [];

      const visitas = await this.datos.visitasPendientesSync();
      const registros = await this.datos.registrosDomesticasPendientesSync();
      if (visitas.length === 0 && registros.length === 0) {
        partes.push('sin cambios pendientes');
      } else {
        const cuerpo: SolicitudSync = {
          visitas: [...visitas],
          registrosDomesticas: [...registros],
        };
        const respuesta = await firstValueFrom(
          this.http.post<RespuestaApi<ResultadoSync>>(`${CONFIG.apiBaseUrl}/api/sync`, cuerpo),
        );
        const { aplicados, duplicados, errores } = respuesta.data;
        await this.datos.confirmarSincronizacion([...aplicados, ...duplicados]);
        if (errores.length > 0) {
          await this.datos.registrarErroresSync(errores);
        }
        const sufijo = errores.length > 0 ? `, ${String(errores.length)} con error` : '';
        partes.push(
          `${String(visitas.length)} visitas, ${String(registros.length)} registros de domésticas${sufijo}`,
        );
      }

      const cambios = await this.sincronizarDirectorio();
      partes.push(`directorio: ${String(cambios)} cambios`);

      this.ultimoMensaje.set(`Sincronizado (${partes.join(' · ')}).`);
      return true;
    } catch {
      this.ultimoMensaje.set('No se pudo sincronizar. Se reintentará al recuperar conexión.');
      return false;
    } finally {
      this.sincronizando.set(false);
    }
  }

  /**
   * Baja los cambios del directorio desde el último pull y los guarda en la
   * caché local. Devuelve cuántos registros cambió.
   */
  private async sincronizarDirectorio(): Promise<number> {
    const desde = await this.datos.valorMeta(META_ULTIMA_SYNC_DIRECTORIO);
    const url =
      desde === null
        ? `${CONFIG.apiBaseUrl}/api/directorio`
        : `${CONFIG.apiBaseUrl}/api/directorio?desde=${encodeURIComponent(desde)}`;
    const respuesta = await firstValueFrom(this.http.get<RespuestaApi<DirectorioPull>>(url));
    const pull = respuesta.data;
    await this.datos.aplicarDirectorio(pull);
    return (
      pull.lotes.length +
      pull.propietarios.length +
      pull.familiares.length +
      pull.vehiculos.length +
      pull.domesticas.length +
      pull.eliminados.length
    );
  }
}

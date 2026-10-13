import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import type { ResultadoSync, SolicitudSync } from '@victoriasapp/shared';
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
    if (!this.sesion.autenticado() || !navigator.onLine) {
      return false;
    }
    this.sincronizando.set(true);
    this.ultimoMensaje.set(null);
    try {
      const visitas = await this.datos.visitasPendientesSync();
      if (visitas.length === 0) {
        this.ultimoMensaje.set('No hay cambios pendientes.');
        return true;
      }

      const cuerpo: SolicitudSync = { visitas: [...visitas] };
      const respuesta = await firstValueFrom(
        this.http.post<RespuestaApi<ResultadoSync>>(`${CONFIG.apiBaseUrl}/api/sync`, cuerpo),
      );

      const { aplicados, duplicados, errores } = respuesta.data;
      await this.datos.confirmarSincronizacion([...aplicados, ...duplicados]);

      if (errores.length > 0) {
        await this.datos.registrarErroresSync(errores);
      }

      const total = aplicados.length + duplicados.length;
      const sufijo = errores.length > 0 ? `, ${String(errores.length)} con error` : '';
      this.ultimoMensaje.set(`Sincronizadas ${String(total)} visitas${sufijo}.`);
      return true;
    } catch {
      this.ultimoMensaje.set('No se pudo sincronizar. Se reintentará al recuperar conexión.');
      return false;
    } finally {
      this.sincronizando.set(false);
    }
  }
}

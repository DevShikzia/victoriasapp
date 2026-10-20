import { Injectable, inject, signal } from '@angular/core';
import {
  NAMESPACE_TIEMPO_REAL,
  type CargaConectado,
  type CargaDirectorio,
  type CargaVisita,
} from '@victoriasapp/shared';
import { io, type Socket } from 'socket.io-client';

import { SesionService } from '../auth/sesion.service';
import { CONFIG } from '../config/config';

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function esCargaVisita(valor: unknown): valor is CargaVisita {
  return esObjeto(valor) && esObjeto(valor['visita']);
}

function esCargaConectado(valor: unknown): valor is CargaConectado {
  return esObjeto(valor) && typeof valor['nombre'] === 'string';
}

function esCargaDirectorio(valor: unknown): valor is CargaDirectorio {
  return esObjeto(valor) && typeof valor['entidad'] === 'string';
}

/**
 * Conexión de tiempo real (Socket.IO) al namespace `/realtime`.
 *
 * Mantiene la lista de visitas recibidas por el canal para el panel en vivo.
 * Si no hay sesión o falla la conexión, el panel sigue funcionando con los datos
 * locales.
 */
@Injectable({ providedIn: 'root' })
export class TiempoRealService {
  private readonly sesion = inject(SesionService);
  private socket: Socket | null = null;

  private readonly conectadoActual = signal(false);
  private readonly visitasActual = signal<readonly CargaVisita[]>([]);
  private readonly ultimoEventoActual = signal<string | null>(null);

  readonly conectado = this.conectadoActual.asReadonly();
  readonly visitas = this.visitasActual.asReadonly();
  readonly ultimoEvento = this.ultimoEventoActual.asReadonly();

  /** Abre la conexión (idempotente). */
  conectar(): void {
    if (this.socket !== null) {
      return;
    }
    const token = this.sesion.token();
    const barrioId = this.sesion.usuario()?.barrioId;
    if (token === null || barrioId === null || barrioId === undefined) {
      return;
    }

    const socket = io(`${CONFIG.apiBaseUrl}${NAMESPACE_TIEMPO_REAL}`, {
      transports: ['websocket'],
      auth: { token },
      withCredentials: true,
    });
    this.socket = socket;

    socket.on('connect', () => {
      this.conectadoActual.set(true);
    });
    socket.on('disconnect', () => {
      this.conectadoActual.set(false);
    });
    socket.on('conectado', (carga: unknown) => {
      if (esCargaConectado(carga)) {
        this.ultimoEventoActual.set(`Conectado como ${carga.nombre}`);
      }
    });
    socket.on('visita:creada', (carga: unknown) => {
      this.registrarVisita(carga);
    });
    socket.on('visita:actualizada', (carga: unknown) => {
      this.registrarVisita(carga);
    });
    socket.on('directorio:actualizado', (carga: unknown) => {
      if (esCargaDirectorio(carga)) {
        this.ultimoEventoActual.set(`Directorio: ${carga.entidad} (${carga.operacion})`);
      }
    });
  }

  desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.conectadoActual.set(false);
  }

  limpiar(): void {
    this.visitasActual.set([]);
    this.ultimoEventoActual.set(null);
  }

  private registrarVisita(carga: unknown): void {
    if (!esCargaVisita(carga)) {
      return;
    }
    const barrioId = this.sesion.usuario()?.barrioId ?? null;
    if (barrioId !== null && carga.visita.barrioId !== null && carga.visita.barrioId !== barrioId) {
      return;
    }
    const uuid = carga.visita.uuid;
    const otras = this.visitasActual().filter((v) => v.visita.uuid !== uuid);
    this.visitasActual.set([carga, ...otras]);
    this.ultimoEventoActual.set(`${carga.visita.apellido} ${carga.visita.nombre}`.trim());
  }
}

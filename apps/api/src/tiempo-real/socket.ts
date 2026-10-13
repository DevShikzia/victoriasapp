import type { Server as HttpServer } from 'node:http';

import { type CargaConectado, NAMESPACE_TIEMPO_REAL } from '@victoriasapp/shared';
import { Server } from 'socket.io';

import { configTokens, verificarAccess, type PayloadAccess } from '../auth/tokens.js';
import { origenesCors, type Env } from '../config/env.js';
import { suscribirTiempoReal } from './bus.js';

/** Lee `token` de un objeto arbitrario (auth del handshake o query string). */
function leerToken(fuente: unknown): string | null {
  if (typeof fuente !== 'object' || fuente === null) {
    return null;
  }
  const valor = (fuente as Record<string, unknown>).token;
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

/** Usuario autenticado de cada socket; se resuelve antes de `connection`. */
const usuariosDeSocket = new WeakMap<object, PayloadAccess>();

/**
 * Engancha Socket.IO al servidor HTTP con autenticación por access token.
 *
 * El cliente se conecta al namespace `/realtime` pasando `auth: { token }`.
 * Los eventos los publica el bus (ver `bus.ts`) desde las rutas.
 */
export function crearServidorTiempoReal(httpServer: HttpServer, env: Env): Server {
  const io = new Server(httpServer, {
    cors: { origin: origenesCors(env), credentials: true },
  });

  const nsp = io.of(NAMESPACE_TIEMPO_REAL);
  const config = configTokens(env);

  nsp.use((socket, next) => {
    const token = leerToken(socket.handshake.auth) ?? leerToken(socket.handshake.query);
    if (token === null) {
      next(new Error('No autenticado'));
      return;
    }
    try {
      usuariosDeSocket.set(socket, verificarAccess(config, token));
      next();
    } catch {
      next(new Error('No autenticado'));
    }
  });

  nsp.on('connection', (socket) => {
    const payload = usuariosDeSocket.get(socket);
    if (payload !== undefined) {
      const carga: CargaConectado = {
        usuario: payload.usuario,
        nombre: payload.nombre,
        rol: payload.rol,
      };
      socket.emit('conectado', carga);
    }
    void socket.join('barrio');
  });

  const desuscribir = suscribirTiempoReal((evento) => {
    nsp.emit(evento.evento, evento.carga);
  });

  io.on('close', () => {
    desuscribir();
  });

  return io;
}

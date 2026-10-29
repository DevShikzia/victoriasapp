import cors from 'cors';
import express, { type Express, type Request, type RequestHandler, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoose from 'mongoose';

import { origenesCors, type Env } from './config/env.js';
import { manejadorErrores, noEncontrado } from './lib/http.js';
import { crearRutasAuth } from './rutas/auth.rutas.js';
import {
  crearRutasBarrios,
  crearRutasDirectorio,
  crearRutasFamiliares,
  crearRutasLotes,
  crearRutasPropietarios,
  crearRutasVehiculos,
} from './rutas/directorio.rutas.js';
import { crearRutasDomesticas } from './rutas/domesticas.rutas.js';
import { crearRutasSync } from './rutas/sync.rutas.js';
import { crearRutasUsuarios } from './rutas/usuarios.rutas.js';
import { crearRutasVisitas } from './rutas/visitas.rutas.js';

/** Límite de fuerza bruta específico para login/refresh. */
function limitadorAuth(env: Env): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: env.NODE_ENV === 'test' ? 1000 : 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      error: { code: 'RATE_LIMITED', message: 'Demasiados intentos, esperá un minuto' },
    },
  });
}

/** Arma la app Express (sin escuchar). Separada para poder testearla. */
export function crearApp(env: Env): Express {
  const app = express();
  app.disable('x-powered-by');
  // Render/Netlify están detrás de un proxy: necesitamos la IP real para el
  // rate limit y las cookies `Secure`.
  if (env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
  }

  app.use(helmet());
  app.use(cors({ origin: origenesCors(env), credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.NODE_ENV === 'test' ? 10_000 : 120,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      data: {
        status: 'up',
        entorno: env.NODE_ENV,
        mongo:
          mongoose.connection.readyState === mongoose.ConnectionStates.connected
            ? 'conectado'
            : 'desconectado',
      },
    });
  });

  app.use('/api/auth', limitadorAuth(env), crearRutasAuth(env));
  app.use('/api/users', crearRutasUsuarios(env));
  app.use('/api/visits', crearRutasVisitas(env));
  app.use('/api/sync', crearRutasSync(env));
  app.use('/api/directorio', crearRutasDirectorio(env));
  app.use('/api/barrios', crearRutasBarrios(env));
  app.use('/api/lotes', crearRutasLotes(env));
  app.use('/api/propietarios', crearRutasPropietarios(env));
  app.use('/api/familiares', crearRutasFamiliares(env));
  app.use('/api/vehiculos', crearRutasVehiculos(env));
  app.use('/api/domesticas', crearRutasDomesticas(env));

  app.use(noEncontrado());
  app.use(manejadorErrores(env));

  return app;
}

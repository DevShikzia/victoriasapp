import { esquemaSincronizacion } from '@victoriasapp/shared';
import { Router } from 'express';

import { crearAutenticar, usuarioDe } from '../auth/middleware.js';
import { configTokens } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import { asincrono, respuestaOk, validar } from '../lib/http.js';
import { aplicarSyncVisitas } from '../servicios/visitas.service.js';

/**
 * Sincronización offline → servidor (`/api/sync`).
 * Idempotente por `uuid`: reenviar lo mismo no duplica nada.
 */
export function crearRutasSync(env: Env): Router {
  const router = Router();
  router.use(crearAutenticar(configTokens(env)));

  router.post(
    '/',
    asincrono(async (req, res) => {
      const usuario = usuarioDe(req);
      const solicitud = validar(esquemaSincronizacion, req.body);
      const resultado = await aplicarSyncVisitas(solicitud.visitas, usuario);
      respuestaOk(res, resultado);
    }),
  );

  return router;
}

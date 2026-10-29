import { esquemaSincronizacion } from '@victoriasapp/shared';
import { Router } from 'express';

import { crearAutenticar, usuarioDe } from '../auth/middleware.js';
import { configTokens } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import { errorBarrioRequerido } from '../lib/errores.js';
import { asincrono, respuestaOk, validar } from '../lib/http.js';
import { aplicarSyncRegistrosDomesticas } from '../servicios/domesticas.service.js';
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
      if (usuario.barrioId === null) {
        throw errorBarrioRequerido();
      }
      const solicitud = validar(esquemaSincronizacion, req.body);
      const visitas = await aplicarSyncVisitas(solicitud.visitas, usuario);
      const registros = await aplicarSyncRegistrosDomesticas(
        solicitud.registrosDomesticas,
        usuario,
      );
      respuestaOk(res, {
        aplicados: [...visitas.aplicados, ...registros.aplicados],
        duplicados: [...visitas.duplicados, ...registros.duplicados],
        errores: [...visitas.errores, ...registros.errores],
      });
    }),
  );

  return router;
}

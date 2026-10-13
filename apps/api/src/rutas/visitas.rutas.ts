import { Router } from 'express';
import type { FilterQuery } from 'mongoose';

import { crearAutenticar } from '../auth/middleware.js';
import { configTokens } from '../auth/tokens.js';
import type { Env } from '../config/env.js';
import { errorNoEncontrado } from '../lib/errores.js';
import { asincrono, paramId, respuestaOk } from '../lib/http.js';
import type { Visita } from '../models/visita.model.js';
import { VisitaModel } from '../models/visita.model.js';
import { aVisitaDto } from '../servicios/visitas.service.js';
import { publicar } from '../tiempo-real/bus.js';

function textoQuery(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor.trim() : null;
}

function numeroQuery(valor: unknown, porDefecto: number, maximo: number): number {
  const texto = textoQuery(valor);
  if (texto === null) {
    return porDefecto;
  }
  const numero = Number.parseInt(texto, 10);
  if (Number.isNaN(numero) || numero <= 0) {
    return porDefecto;
  }
  return Math.min(numero, maximo);
}

/** Rutas de visitas (`/api/visits`). Requieren autenticación. */
export function crearRutasVisitas(env: Env): Router {
  const router = Router();
  router.use(crearAutenticar(configTokens(env)));

  router.get(
    '/',
    asincrono(async (req, res) => {
      const q = req.query;
      const filtro: FilterQuery<Visita> = {};

      if (textoQuery(q.abiertas) === 'true') {
        filtro.salidaEn = null;
      }
      const dni = textoQuery(q.dni);
      if (dni !== null) {
        filtro.dni = dni;
      }
      const patente = textoQuery(q.patente);
      if (patente !== null) {
        filtro.patente = patente.toUpperCase();
      }
      const lote = textoQuery(q.lote);
      if (lote !== null) {
        filtro.loteNumero = lote;
      }

      const rango: { $gte?: Date; $lte?: Date } = {};
      const desde = textoQuery(q.desde);
      if (desde !== null) {
        const fecha = new Date(desde);
        if (!Number.isNaN(fecha.getTime())) {
          rango.$gte = fecha;
        }
      }
      const hasta = textoQuery(q.hasta);
      if (hasta !== null) {
        const fecha = new Date(hasta);
        if (!Number.isNaN(fecha.getTime())) {
          rango.$lte = fecha;
        }
      }
      if (rango.$gte !== undefined || rango.$lte !== undefined) {
        filtro.entradaEn = rango;
      }

      const limite = numeroQuery(q.limit, 200, 500);
      const visitas = await VisitaModel.find(filtro).sort({ entradaEn: -1 }).limit(limite);
      respuestaOk(
        res,
        visitas.map((visita) => aVisitaDto(visita)),
      );
    }),
  );

  router.get(
    '/abiertas',
    asincrono(async (_req, res) => {
      const visitas = await VisitaModel.find({ salidaEn: null }).sort({ entradaEn: -1 }).limit(500);
      respuestaOk(
        res,
        visitas.map((visita) => aVisitaDto(visita)),
      );
    }),
  );

  router.post(
    '/:id/salida',
    asincrono(async (req, res) => {
      const id = paramId(req);
      const doc = await VisitaModel.findById(id);
      if (doc === null) {
        throw errorNoEncontrado('Visita no encontrada');
      }
      doc.salidaEn = new Date();
      doc.syncRev += 1;
      await doc.save();
      publicar('visita:actualizada', { visita: aVisitaDto(doc) });
      respuestaOk(res, aVisitaDto(doc));
    }),
  );

  return router;
}

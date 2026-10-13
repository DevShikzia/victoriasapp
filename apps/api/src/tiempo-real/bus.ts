import type { MapaEventosTiempoReal, NombreEventoTiempoReal } from '@victoriasapp/shared';

/**
 * Bus de eventos en memoria que desacopla las rutas (que publican) del
 * servidor Socket.IO (que se suscribe y reenvía a los clientes).
 *
 * Así `crearApp()` sigue siendo puro y testeable sin abrir un socket.
 */

export interface EventoEmitido {
  readonly evento: NombreEventoTiempoReal;
  readonly carga: MapaEventosTiempoReal[NombreEventoTiempoReal];
}

export type EscuchaTiempoReal = (evento: EventoEmitido) => void;

const escuchas = new Set<EscuchaTiempoReal>();

/** Publica un evento (lo reciben todos los suscriptores). */
export function publicar<E extends NombreEventoTiempoReal>(
  evento: E,
  carga: MapaEventosTiempoReal[E],
): void {
  const emitido: EventoEmitido = { evento, carga };
  for (const escucha of escuchas) {
    try {
      escucha(emitido);
    } catch {
      // Un suscriptor roto no debe romper la petición HTTP que publicó.
    }
  }
}

/** Suscribe una escucha; devuelve la función para desuscribirse. */
export function suscribirTiempoReal(escucha: EscuchaTiempoReal): () => void {
  escuchas.add(escucha);
  return () => {
    escuchas.delete(escucha);
  };
}

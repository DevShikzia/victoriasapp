/** Convierte cualquier error de cámara/detección en un mensaje legible. */
export function mensajeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Error desconocido al acceder a la cámara.';
}

/** Detiene todas las pistas de un `MediaStream`. */
export function detenerStream(stream: MediaStream): void {
  for (const pista of stream.getTracks()) {
    pista.stop();
  }
}

/**
 * Abre la cámara trasera con la mejor resolución razonable. El PDF417 del DNI
 * viejo y el QR del nuevo necesitan más detalle que el 640×480 que entregan
 * algunos celulares por defecto; `ideal` no falla si el equipo no lo soporta.
 */
export async function abrirCamara(): Promise<MediaStream> {
  const base = {
    facingMode: { ideal: 'environment' },
    frameRate: { ideal: 30 },
  } satisfies MediaTrackConstraints;

  // Primero intentamos forzar al menos 720p. Si el equipo no lo soporta,
  // caemos a 720p ideal y después a lo que dé la cámara.
  const intentos: readonly MediaTrackConstraints[] = [
    { ...base, width: { min: 1280, ideal: 1920 }, height: { min: 720, ideal: 1080 } },
    { ...base, width: { ideal: 1280 }, height: { ideal: 720 } },
    base,
  ];

  let ultimoError: unknown = null;
  for (const video of intentos) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      aplicarEnfoqueContinuo(stream);
      return stream;
    } catch (error) {
      ultimoError = error;
    }
  }

  throw ultimoError instanceof Error
    ? ultimoError
    : new Error('No se pudo abrir la cámara del dispositivo.');
}

/** Pide enfoque continuo; algunos equipos no lo permiten y se ignora. */
function aplicarEnfoqueContinuo(stream: MediaStream): void {
  const pista = stream.getVideoTracks().at(0);
  if (pista === undefined) {
    return;
  }
  void pista
    .applyConstraints({
      advanced: [{ focusMode: 'continuous' }],
    } as unknown as MediaTrackConstraints)
    .catch(() => {
      // El equipo no permite cambiar el modo de enfoque.
    });
}

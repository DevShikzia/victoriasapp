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

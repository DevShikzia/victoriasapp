import { Injectable } from '@angular/core';
import {
  BarcodeDetector as BarcodeDetectorPonyfill,
  prepareZXingModule,
  type BarcodeFormat,
} from 'barcode-detector/ponyfill';
import {
  prepareZXingModule as prepararZXingDirecto,
  readBarcodes,
} from 'zxing-wasm/reader';

/**
 * Formatos de código que puede traer un DNI argentino:
 *  - `pdf417`: DNI tarjeta viejo (reverso) e intermedio (frente).
 *  - `qr_code`: DNI electrónico nuevo.
 *  - `data_matrix`: por si apareciera en alguna variante.
 */
export const FORMATOS_DNI = [
  'pdf417',
  'qr_code',
  'data_matrix',
] as const satisfies readonly BarcodeFormat[];

/** Fuentes de imagen que acepta el detector. */
export type FuenteImagen = HTMLVideoElement | HTMLCanvasElement | ImageBitmap | Blob | ImageData;

/** Resultado mínimo que consumen las pantallas del escáner. */
export interface CodigoDetectado {
  readonly rawValue: string;
  readonly format: string;
}

/** Interfaz mínima del `BarcodeDetector` nativo (no está en los tipos del DOM). */
interface DetectorNativo {
  detect(fuente: FuenteImagen): Promise<readonly { rawValue: string; format: string }[]>;
}

interface ConstructorDetectorNativo {
  new (opciones?: { formats?: readonly string[] }): DetectorNativo;
  getSupportedFormats?: () => Promise<readonly string[]>;
}

export type MotorEscaner = 'nativo' | 'wasm';

type PosicionRecorte =
  | 'centro'
  | 'superiorDerecha'
  | 'inferiorDerecha'
  | 'superiorIzquierda'
  | 'inferiorIzquierda';

const LADO_RECORTE_PX = 1024;
const FRACCION_GUIA = 0.7;
const FRACCION_FOTO_ESQUINA = 0.55;
const POSICIONES_FOTO: readonly PosicionRecorte[] = [
  'superiorDerecha',
  'inferiorDerecha',
  'superiorIzquierda',
  'inferiorIzquierda',
  'centro',
];

let wasmListo = false;
let wasmDirectoListo = false;

/** Devuelve el constructor nativo si el navegador lo expone. */
function constructorNativo(): ConstructorDetectorNativo | null {
  const global = globalThis as { BarcodeDetector?: unknown };
  return typeof global.BarcodeDetector === 'function'
    ? (global.BarcodeDetector as ConstructorDetectorNativo)
    : null;
}

/**
 * Envuelve el detector de códigos. Prefiere el `BarcodeDetector` nativo del
 * celular (ML Kit en Android) y cae al polyfill ZXing-WASM si no existe o si
 * no soporta los formatos del DNI.
 *
 * Para QR chicos (DNI nuevo) además del frame completo se prueba un recorte
 * central ampliado. La pantalla muestra un recuadro guía que coincide con ese
 * recorte.
 */
@Injectable({ providedIn: 'root' })
export class EscanerService {
  private readonly detector: DetectorNativo | BarcodeDetectorPonyfill;
  private detectorWasm: BarcodeDetectorPonyfill | null = null;
  private canvasRecorte: HTMLCanvasElement | null = null;
  private alternarRecorte = false;
  readonly motor: MotorEscaner;

  constructor() {
    const nativo = constructorNativo();
    if (nativo !== null) {
      try {
        this.detector = new nativo({ formats: [...FORMATOS_DNI] });
        this.motor = 'nativo';
        return;
      } catch {
        // Hay navegadores que exponen BarcodeDetector pero no soportan todos
        // los formatos: en ese caso seguimos con ZXing-WASM.
      }
    }

    this.detector = this.crearWasm();
    this.motor = 'wasm';
  }

  private crearWasm(): BarcodeDetectorPonyfill {
    if (!wasmListo) {
      prepareZXingModule({
        overrides: {
          locateFile: (ruta: string) => `zxing/${ruta}`,
        },
        fireImmediately: false,
      });
      wasmListo = true;
    }
    return new BarcodeDetectorPonyfill({ formats: [...FORMATOS_DNI] });
  }

  /** Fallback WASM para fotos cuando el detector principal es el nativo. */
  private obtenerWasmFallback(): BarcodeDetectorPonyfill | null {
    if (this.motor !== 'nativo') {
      return null;
    }
    this.detectorWasm ??= this.crearWasm();
    return this.detectorWasm;
  }

  /** Formatos que el navegador/dispositivo realmente soporta. */
  static async formatosSoportados(): Promise<readonly string[]> {
    const nativo = constructorNativo();
    if (nativo?.getSupportedFormats !== undefined) {
      try {
        return await nativo.getSupportedFormats();
      } catch {
        // Seguimos con el polyfill.
      }
    }
    return await BarcodeDetectorPonyfill.getSupportedFormats();
  }

  /** Detecta todos los códigos presentes en la imagen o el video. */
  async escanear(fuente: FuenteImagen): Promise<readonly CodigoDetectado[]> {
    const codigos = await this.detector.detect(fuente);
    return this.aCodigos(codigos);
  }

  private aCodigos(
    codigos: readonly { rawValue: string; format: string }[],
  ): readonly CodigoDetectado[] {
    return codigos.map((codigo) => ({
      rawValue: codigo.rawValue,
      format: codigo.format,
    }));
  }

  /**
   * Escanea un cuadro de video: primero el frame completo (PDF417 grande) y,
   * si no encuentra nada, un recorte central ampliado (QR chico del DNI nuevo).
   * El recorte se hace en frames alternos para no duplicar el costo.
   */
  async escanearVideo(video: HTMLVideoElement): Promise<readonly CodigoDetectado[]> {
    const directos = await this.escanear(video);
    if (directos.length > 0) {
      return directos;
    }

    this.alternarRecorte = !this.alternarRecorte;
    if (!this.alternarRecorte) {
      return [];
    }
    return await this.escanearRecorte(video);
  }

  /** Escanea solo el recuadro central ampliado (modo QR chico). */
  async escanearRecorte(video: HTMLVideoElement): Promise<readonly CodigoDetectado[]> {
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return [];
    }
    const canvas = this.obtenerCanvas();
    this.dibujarRecorte(
      video,
      video.videoWidth,
      video.videoHeight,
      canvas,
      FRACCION_GUIA,
      'centro',
    );
    return await this.escanear(canvas);
  }

  /**
   * Escanea una foto corrigiendo la orientación EXIF. Si el frame completo no
   * encuentra nada, prueba un recorte central y otro en la esquina inferior
   * derecha, que es donde suele estar el QR del DNI nuevo.
   */
  async escanearArchivo(archivo: Blob): Promise<readonly CodigoDetectado[]> {
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });

      const completos = await this.escanear(bitmap);
      if (completos.length > 0) {
        return completos;
      }

      for (const posicion of POSICIONES_FOTO) {
        const codigos = await this.escanearRecorteFoto(bitmap, posicion);
        if (codigos.length > 0) {
          return codigos;
        }
      }

      // Si el detector nativo no encontró nada, probamos el mismo archivo con
      // ZXing-WASM (a veces detecta QR que ML Kit deja pasar).
      const wasm = this.obtenerWasmFallback();
      if (wasm !== null) {
        const wasmCompletos = await wasm.detect(bitmap);
        if (wasmCompletos.length > 0) {
          return this.aCodigos(wasmCompletos);
        }
        for (const posicion of POSICIONES_FOTO) {
          const canvas = this.obtenerCanvas();
          this.dibujarRecorte(
            bitmap,
            bitmap.width,
            bitmap.height,
            canvas,
            this.fraccionDe(posicion),
            posicion,
          );
          const wasmCodigos = await wasm.detect(canvas);
          if (wasmCodigos.length > 0) {
            return this.aCodigos(wasmCodigos);
          }
        }
      }

      // Último intento: lectura directa con zxing-wasm, sin el wrapper
      // BarcodeDetector. Probamos el recorte superior derecho (donde está el
      // QR del DNI nuevo) y la imagen completa.
      try {
        const recorte = this.imagenDataDeRecorte(bitmap, 'superiorDerecha');
        if (recorte !== null) {
          const codigos = await this.escanearDirecto(recorte);
          if (codigos.length > 0) {
            return codigos;
          }
        }
        const completa = this.imagenDataCompleta(bitmap);
        if (completa !== null) {
          const codigos = await this.escanearDirecto(completa);
          if (codigos.length > 0) {
            return codigos;
          }
        }
      } catch {
        // Si el WASM directo no está disponible, seguimos sin romper la app.
      }

      return [];
    } catch {
      return await this.escanear(archivo);
    } finally {
      bitmap?.close();
    }
  }

  private imagenDataDeRecorte(
    bitmap: ImageBitmap,
    posicion: PosicionRecorte,
  ): ImageData | null {
    const canvas = this.obtenerCanvas();
    this.dibujarRecorte(
      bitmap,
      bitmap.width,
      bitmap.height,
      canvas,
      this.fraccionDe(posicion),
      posicion,
    );
    return canvas.getContext('2d')?.getImageData(0, 0, canvas.width, canvas.height) ?? null;
  }

  private imagenDataCompleta(bitmap: ImageBitmap): ImageData | null {
    const canvas = this.obtenerCanvas();
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const contexto = canvas.getContext('2d');
    if (contexto === null) {
      return null;
    }
    contexto.drawImage(bitmap, 0, 0);
    return contexto.getImageData(0, 0, canvas.width, canvas.height);
  }

  private async escanearDirecto(
    fuente: Blob | ImageData,
  ): Promise<readonly CodigoDetectado[]> {
    if (!wasmDirectoListo) {
      prepararZXingDirecto({
        overrides: {
          locateFile: (ruta: string) => `zxing/${ruta}`,
        },
        fireImmediately: false,
      });
      wasmDirectoListo = true;
    }
    const resultados = await readBarcodes(fuente, {
      formats: ['QRCode', 'PDF417', 'DataMatrix'],
      tryHarder: true,
      tryRotate: true,
      tryInvert: true,
      maxNumberOfSymbols: 5,
    });
    return resultados
      .filter((resultado) => resultado.isValid && resultado.text !== '')
      .map((resultado) => ({
        rawValue: resultado.text,
        format: resultado.format,
      }));
  }

  private async escanearRecorteFoto(
    bitmap: ImageBitmap,
    posicion: PosicionRecorte,
  ): Promise<readonly CodigoDetectado[]> {
    const canvas = this.obtenerCanvas();
    this.dibujarRecorte(
      bitmap,
      bitmap.width,
      bitmap.height,
      canvas,
      this.fraccionDe(posicion),
      posicion,
    );
    return await this.escanear(canvas);
  }

  private fraccionDe(posicion: PosicionRecorte): number {
    return posicion === 'centro' ? FRACCION_GUIA : FRACCION_FOTO_ESQUINA;
  }

  private obtenerCanvas(): HTMLCanvasElement {
    this.canvasRecorte ??= document.createElement('canvas');
    return this.canvasRecorte;
  }

  private dibujarRecorte(
    fuente: CanvasImageSource,
    ancho: number,
    alto: number,
    canvas: HTMLCanvasElement,
    fraccion: number,
    posicion: PosicionRecorte,
  ): void {
    const lado = Math.min(ancho, alto) * fraccion;
    const enDerecha = posicion === 'superiorDerecha' || posicion === 'inferiorDerecha';
    const enIzquierda = posicion === 'superiorIzquierda' || posicion === 'inferiorIzquierda';
    const arriba = posicion === 'superiorDerecha' || posicion === 'superiorIzquierda';
    const abajo = posicion === 'inferiorDerecha' || posicion === 'inferiorIzquierda';
    const x = enDerecha ? ancho - lado : enIzquierda ? 0 : (ancho - lado) / 2;
    const y = arriba ? 0 : abajo ? alto - lado : (alto - lado) / 2;

    canvas.width = LADO_RECORTE_PX;
    canvas.height = LADO_RECORTE_PX;
    const contexto = canvas.getContext('2d');
    if (contexto === null) {
      return;
    }
    contexto.drawImage(fuente, x, y, lado, lado, 0, 0, LADO_RECORTE_PX, LADO_RECORTE_PX);
  }
}

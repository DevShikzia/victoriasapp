import { Injectable } from '@angular/core';
import {
  BarcodeDetector,
  prepareZXingModule,
  type BarcodeFormat,
  type DetectedBarcode,
} from 'barcode-detector/ponyfill';

/**
 * Formatos de código que puede traer un DNI argentino:
 *  - `pdf417`: DNI tarjeta viejo (reverso) e intermedio (frente).
 *  - `qr_code`: DNI electrónico nuevo.
 *  - `data_matrix`: por si apareciera en alguna variante.
 */
export const FORMATOS_DNI = ['pdf417', 'qr_code', 'data_matrix'] as const satisfies readonly BarcodeFormat[];

/** Fuentes de imagen que acepta el detector. */
export type FuenteImagen = HTMLVideoElement | HTMLCanvasElement | ImageBitmap | Blob | ImageData;

let wasmListo = false;

/**
 * Envuelve `BarcodeDetector` (polyfill ZXing/WASM) y fuerza que el WASM se
 * cargue desde el propio PWA (`/zxing/...`) en vez del CDN de jsDelivr, para
 * que el escaneo funcione sin internet.
 *
 * El override se configura ANTES de crear el detector, porque el propio
 * constructor de `BarcodeDetector` dispara la carga del módulo WASM.
 */
@Injectable({ providedIn: 'root' })
export class EscanerService {
  private readonly detector: BarcodeDetector;

  constructor() {
    if (!wasmListo) {
      prepareZXingModule({
        overrides: {
          locateFile: (ruta: string) => `zxing/${ruta}`,
        },
        fireImmediately: false,
      });
      wasmListo = true;
    }
    this.detector = new BarcodeDetector({ formats: [...FORMATOS_DNI] });
  }

  /** Formatos que el navegador/dispositivo realmente soporta. */
  static formatosSoportados(): Promise<readonly BarcodeFormat[]> {
    return BarcodeDetector.getSupportedFormats();
  }

  /** Detecta todos los códigos presentes en la imagen. */
  async escanear(fuente: FuenteImagen): Promise<readonly DetectedBarcode[]> {
    return this.detector.detect(fuente);
  }
}

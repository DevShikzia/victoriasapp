import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import type { ElementRef, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { DetectedBarcode } from 'barcode-detector/ponyfill';
import { parseDni, type ParseResult } from '@victoriasapp/shared';

import { EscanerService } from '../../core/scan/escaner.service';

/** Una lectura ya interpretada por el parser. */
interface Deteccion {
  readonly id: number;
  readonly formato: string;
  readonly raw: string;
  readonly parse: ParseResult;
  readonly hora: string;
}

const MAX_DETECCIONES = 20;

/**
 * Modo captura: pantalla de diagnóstico para leer DNIs reales y ver el payload
 * crudo + la interpretación del parser. Sirve para cerrar el formato del QR del
 * DNI electrónico nuevo (ver docs/02-formatos-dni.md).
 */
@Component({
  selector: 'app-captura',
  imports: [FormsModule],
  templateUrl: './captura.html',
  styleUrl: './captura.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Captura implements OnDestroy {
  private readonly escaner = inject(EscanerService);

  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');

  private stream: MediaStream | null = null;
  private bucle: number | null = null;
  private escaneando = false;
  private proximoId = 1;

  protected readonly camaraActiva = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly soportados = signal<readonly string[]>([]);
  protected readonly detecciones = signal<readonly Deteccion[]>([]);
  protected readonly manual = signal('');

  constructor() {
    void this.cargarFormatos();
  }

  ngOnDestroy(): void {
    this.detenerCamara();
  }

  private async cargarFormatos(): Promise<void> {
    try {
      const formatos = await EscanerService.formatosSoportados();
      this.soportados.set([...formatos].sort());
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  async iniciarCamara(): Promise<void> {
    this.error.set(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      const video = this.videoRef()?.nativeElement;
      if (!video) {
        detenerStream(stream);
        return;
      }
      this.stream = stream;
      video.srcObject = stream;
      await video.play();
      this.camaraActiva.set(true);
      this.iniciarBucle();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  detenerCamara(): void {
    this.detenerBucle();
    if (this.stream !== null) {
      detenerStream(this.stream);
      this.stream = null;
    }
    const video = this.videoRef()?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
    this.camaraActiva.set(false);
  }

  private iniciarBucle(): void {
    this.detenerBucle();
    this.bucle = window.setInterval(() => {
      void this.escanearCuadro();
    }, 350);
  }

  private detenerBucle(): void {
    if (this.bucle !== null) {
      window.clearInterval(this.bucle);
      this.bucle = null;
    }
  }

  private async escanearCuadro(): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (!video || video.readyState < 2 || this.escaneando || !this.camaraActiva()) {
      return;
    }
    this.escaneando = true;
    try {
      const codigos = await this.escaner.escanear(video);
      if (codigos.length > 0) {
        this.registrar(codigos);
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.escaneando = false;
    }
  }

  async escanearFoto(evento: Event): Promise<void> {
    const input = evento.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) {
      return;
    }
    try {
      const codigos = await this.escaner.escanear(archivo);
      if (codigos.length === 0) {
        this.error.set('No se detectó ningún código en la imagen.');
      } else {
        this.registrar(codigos);
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  parsearManual(): void {
    const raw = this.manual().trim();
    if (raw === '') {
      return;
    }
    this.agregar({ formato: 'manual', raw, parse: parseDni(raw) });
    this.manual.set('');
  }

  limpiar(): void {
    this.detecciones.set([]);
  }

  private registrar(codigos: readonly DetectedBarcode[]): void {
    for (const codigo of codigos) {
      this.agregar({
        formato: codigo.format,
        raw: codigo.rawValue,
        parse: parseDni(codigo.rawValue),
      });
    }
  }

  private agregar(entrada: Omit<Deteccion, 'id' | 'hora'>): void {
    const nueva: Deteccion = {
      ...entrada,
      id: this.proximoId,
      hora: new Date().toLocaleTimeString(),
    };
    this.proximoId += 1;
    this.detecciones.update((previas) => {
      if (previas.some((p) => p.raw === nueva.raw)) {
        return previas;
      }
      return [nueva, ...previas].slice(0, MAX_DETECCIONES);
    });
  }
}

function detenerStream(stream: MediaStream): void {
  for (const pista of stream.getTracks()) {
    pista.stop();
  }
}

function mensajeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Error desconocido al acceder a la cámara.';
}

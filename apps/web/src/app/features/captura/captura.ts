import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import type { ElementRef, OnDestroy } from '@angular/core';
import { parseDni, type ParseResult } from '@victoriasapp/shared';

import {
  EscanerService,
  type CodigoDetectado,
} from '../../core/scan/escaner.service';
import { abrirCamara } from '../../core/scan/utilidades';

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
  templateUrl: './captura.html',
  styleUrl: './captura.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Captura implements OnDestroy {
  private readonly escaner = inject(EscanerService);

  protected readonly motor = this.escaner.motor;
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');

  private stream: MediaStream | null = null;
  private bucle: number | null = null;
  private escaneando = false;
  private proximoId = 1;
  private copiadoTimer: number | null = null;
  private fotoObjectUrl: string | null = null;

  protected readonly camaraActiva = signal(false);
  protected readonly modoQr = signal(false);
  protected readonly resolucion = signal('—');
  protected readonly error = signal<string | null>(null);
  protected readonly soportados = signal<readonly string[]>([]);
  protected readonly detecciones = signal<readonly Deteccion[]>([]);

  /** Diagnóstico del escaneo: sirve para saber si la cámara está analizando. */
  protected readonly intentos = signal(0);
  protected readonly ultimoIntento = signal<string | null>(null);
  protected readonly ultimaFuente = signal<'cámara' | 'foto' | 'manual' | null>(null);
  protected readonly codigosUltimoCuadro = signal<number | null>(null);
  protected readonly copiado = signal<number | null>(null);
  protected readonly fotoUrl = signal<string | null>(null);
  protected readonly fotoInfo = signal('');

  constructor() {
    void this.cargarFormatos();
  }

  ngOnDestroy(): void {
    if (this.copiadoTimer !== null) {
      window.clearTimeout(this.copiadoTimer);
    }
    if (this.fotoObjectUrl !== null) {
      URL.revokeObjectURL(this.fotoObjectUrl);
    }
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
      const stream = await abrirCamara();
      const video = this.videoRef()?.nativeElement;
      if (!video) {
        detenerStream(stream);
        return;
      }
      this.stream = stream;
      video.srcObject = stream;
      await video.play();
      this.resolucion.set(`${String(video.videoWidth)}×${String(video.videoHeight)}`);
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
    this.resolucion.set('—');
  }

  protected alternarModoQr(): void {
    this.modoQr.update((activo) => !activo);
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
      const codigos = this.modoQr()
        ? await this.escaner.escanearRecorte(video)
        : await this.escaner.escanearVideo(video);
      this.registrarIntento('cámara', codigos.length);
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

    if (this.fotoObjectUrl !== null) {
      URL.revokeObjectURL(this.fotoObjectUrl);
    }
    this.fotoObjectUrl = URL.createObjectURL(archivo);
    this.fotoUrl.set(this.fotoObjectUrl);
    this.fotoInfo.set(
      `${archivo.name === '' ? 'foto' : archivo.name} · ${String(Math.round(archivo.size / 1024))} KB`,
    );

    try {
      const codigos = await this.escaner.escanearArchivo(archivo);
      this.registrarIntento('foto', codigos.length);
      if (codigos.length === 0) {
        this.error.set('No se detectó ningún código en la imagen.');
      } else {
        this.registrar(codigos);
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  limpiar(): void {
    this.detecciones.set([]);
    this.intentos.set(0);
    this.ultimoIntento.set(null);
    this.ultimaFuente.set(null);
    this.codigosUltimoCuadro.set(null);
    this.copiado.set(null);
  }

  /** Copia el payload crudo para poder enviarlo o revisarlo. */
  async copiar(raw: string, id: number): Promise<void> {
    try {
      await navigator.clipboard.writeText(raw);
      this.copiado.set(id);
      if (this.copiadoTimer !== null) {
        window.clearTimeout(this.copiadoTimer);
      }
      this.copiadoTimer = window.setTimeout(() => {
        this.copiado.set(null);
      }, 1500);
    } catch {
      this.error.set('No se pudo copiar. Seleccioná el texto del payload a mano.');
    }
  }

  private registrarIntento(
    fuente: 'cámara' | 'foto',
    cantidadCodigos: number,
  ): void {
    this.intentos.update((total) => total + 1);
    this.ultimoIntento.set(new Date().toLocaleTimeString());
    this.ultimaFuente.set(fuente);
    this.codigosUltimoCuadro.set(cantidadCodigos);
  }

  private registrar(codigos: readonly CodigoDetectado[]): void {
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

import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnDestroy,
  afterNextRender,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { DniData, DniFormato } from '@victoriasapp/shared';
import { parseDni } from '@victoriasapp/shared';

import { EscanerService } from '../../core/scan/escaner.service';
import { abrirCamara, detenerStream, mensajeError } from '../../core/scan/utilidades';

/** Resultado de un escaneo exitoso de DNI. */
export interface ResultadoEscaner {
  readonly data: DniData;
  readonly raw: string;
  readonly formato: DniFormato;
}

/**
 * Escáner compacto de DNI para incrustar en el formulario de visita.
 * Al leer un código válido emite `detectado` y **apaga la cámara** sola.
 */
@Component({
  selector: 'app-escaner-dni',
  templateUrl: './escaner-dni.html',
  styleUrl: './escaner-dni.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EscanerDni implements OnDestroy {
  private readonly escaner = inject(EscanerService);
  private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');

  private stream: MediaStream | null = null;
  private bucle: number | null = null;
  private escaneando = false;
  private ultimoRaw = '';

  readonly detectado = output<ResultadoEscaner>();

  protected readonly activo = signal(false);
  protected readonly iniciando = signal(false);
  protected readonly modoQr = signal(false);
  protected readonly resolucion = signal('—');
  protected readonly error = signal<string | null>(null);
  protected readonly estado = signal('Cámara apagada');

  constructor() {
    // Al abrir el escáner desde Nueva visita, la cámara arranca sola.
    afterNextRender(() => {
      void this.iniciar();
    });
  }

  ngOnDestroy(): void {
    this.detener();
  }

  async iniciar(): Promise<void> {
    if (this.iniciando() || this.activo()) {
      return;
    }
    this.iniciando.set(true);
    this.error.set(null);
    this.estado.set('Encendiendo cámara…');
    try {
      const stream = await abrirCamara();
      const video = this.videoRef()?.nativeElement;
      if (video === undefined) {
        detenerStream(stream);
        this.estado.set('Cámara apagada');
        return;
      }
      this.stream = stream;
      video.srcObject = stream;
      await video.play();
      this.resolucion.set(`${String(video.videoWidth)}×${String(video.videoHeight)}`);
      this.activo.set(true);
      this.estado.set('Enfocá el código del DNI');
      this.iniciarBucle();
    } catch (e) {
      this.detener();
      this.error.set(mensajeError(e));
    } finally {
      this.iniciando.set(false);
    }
  }

  detener(): void {
    if (this.bucle !== null) {
      window.clearInterval(this.bucle);
      this.bucle = null;
    }
    if (this.stream !== null) {
      detenerStream(this.stream);
      this.stream = null;
    }
    const video = this.videoRef()?.nativeElement;
    if (video !== undefined) {
      video.srcObject = null;
    }
    this.activo.set(false);
    this.resolucion.set('—');
    this.estado.set('Cámara apagada');
  }

  protected alternarModoQr(): void {
    this.modoQr.update((activo) => !activo);
  }

  private iniciarBucle(): void {
    this.detenerBucle();
    this.bucle = window.setInterval(() => {
      void this.escanearCuadro();
    }, 300);
  }

  private detenerBucle(): void {
    if (this.bucle !== null) {
      window.clearInterval(this.bucle);
      this.bucle = null;
    }
  }

  private async escanearCuadro(): Promise<void> {
    const video = this.videoRef()?.nativeElement;
    if (video === undefined || video.readyState < 2 || this.escaneando || !this.activo()) {
      return;
    }
    this.escaneando = true;
    try {
      const codigos = this.modoQr()
        ? await this.escaner.escanearRecorte(video)
        : await this.escaner.escanearVideo(video);
      for (const codigo of codigos) {
        if (codigo.rawValue !== this.ultimoRaw && this.emitir(codigo.rawValue)) {
          this.ultimoRaw = codigo.rawValue;
          return;
        }
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.escaneando = false;
    }
  }

  /** Alternativa para QR/PDF417 que no se leen bien en video. */
  protected async escanearFoto(evento: Event): Promise<void> {
    const input = evento.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const archivo = input.files?.[0];
    input.value = '';
    if (archivo === undefined) {
      return;
    }

    this.error.set(null);
    try {
      const codigos = await this.escaner.escanearArchivo(archivo);
      if (codigos.length === 0) {
        this.error.set('No se detectó ningún código en la imagen.');
        return;
      }
      for (const codigo of codigos) {
        if (this.emitir(codigo.rawValue)) {
          return;
        }
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  private emitir(raw: string): boolean {
    const resultado = parseDni(raw);
    if (!resultado.ok || resultado.data === null) {
      this.error.set(resultado.errores.join(' ') || 'No se pudieron leer los datos.');
      return false;
    }
    this.error.set(null);
    this.detener();
    this.estado.set('¡DNI leído!');
    this.detectado.emit({
      data: resultado.data,
      raw,
      formato: resultado.formato === 'desconocido' ? 'manual' : resultado.formato,
    });
    return true;
  }
}

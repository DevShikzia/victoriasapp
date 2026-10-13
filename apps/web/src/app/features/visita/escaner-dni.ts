import {
  ChangeDetectionStrategy,
  Component,
  type ElementRef,
  type OnDestroy,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { DniData, DniFormato } from '@victoriasapp/shared';
import { parseDni } from '@victoriasapp/shared';

import { EscanerService } from '../../core/scan/escaner.service';
import { detenerStream, mensajeError } from '../../core/scan/utilidades';

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
  protected readonly error = signal<string | null>(null);
  protected readonly estado = signal('Cámara apagada');

  ngOnDestroy(): void {
    this.detener();
  }

  async iniciar(): Promise<void> {
    this.error.set(null);
    this.estado.set('Encendiendo cámara…');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      const video = this.videoRef()?.nativeElement;
      if (video === undefined) {
        detenerStream(stream);
        return;
      }
      this.stream = stream;
      video.srcObject = stream;
      await video.play();
      this.activo.set(true);
      this.estado.set('Enfocá el código del DNI');
      this.iniciarBucle();
    } catch (e) {
      this.estado.set('Cámara apagada');
      this.error.set(mensajeError(e));
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
      const codigos = await this.escaner.escanear(video);
      for (const codigo of codigos) {
        const resultado = parseDni(codigo.rawValue);
        if (resultado.ok && resultado.data !== null && codigo.rawValue !== this.ultimoRaw) {
          this.ultimoRaw = codigo.rawValue;
          this.estado.set('¡DNI leído!');
          this.detener();
          this.detectado.emit({
            data: resultado.data,
            raw: codigo.rawValue,
            formato: resultado.formato === 'desconocido' ? 'manual' : resultado.formato,
          });
          return;
        }
      }
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.escaneando = false;
    }
  }
}

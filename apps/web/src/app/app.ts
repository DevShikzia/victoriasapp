import {
  ChangeDetectionStrategy,
  Component,
  type OnDestroy,
  type OnInit,
  inject,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { DatosService } from './core/db/datos.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, OnDestroy {
  private readonly datos = inject(DatosService);

  protected readonly enLinea = signal(navigator.onLine);
  protected readonly pendientes = this.datos.pendientes;

  private readonly alVolverEnLinea = (): void => {
    this.enLinea.set(true);
  };
  private readonly alPerderConexion = (): void => {
    this.enLinea.set(false);
  };

  ngOnInit(): void {
    window.addEventListener('online', this.alVolverEnLinea);
    window.addEventListener('offline', this.alPerderConexion);
    void this.datos.refrescar();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.alVolverEnLinea);
    window.removeEventListener('offline', this.alPerderConexion);
  }
}

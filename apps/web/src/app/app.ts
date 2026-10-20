import {
  ChangeDetectionStrategy,
  Component,
  type OnDestroy,
  type OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { SesionService } from './core/auth/sesion.service';
import { DatosService } from './core/db/datos.service';
import { SincronizadorService } from './core/sync/sincronizador.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, OnDestroy {
  private readonly datos = inject(DatosService);
  private readonly sesion = inject(SesionService);
  private readonly sincro = inject(SincronizadorService);
  private readonly router = inject(Router);

  protected readonly enLinea = signal(navigator.onLine);
  protected readonly menuAbierto = signal(false);
  protected readonly pendientes = this.datos.pendientes;
  protected readonly usuario = this.sesion.usuario;
  protected readonly autenticado = this.sesion.autenticado;
  protected readonly barrioNombre = this.sesion.barrioNombre;
  protected readonly sincronizando = this.sincro.sincronizando;
  protected readonly puedeAdministrar = computed(() => {
    const rol = this.sesion.usuario()?.rol;
    return rol === 'admin' || rol === 'supervisor';
  });
  protected readonly puedeAdministrarUsuarios = computed(
    () => this.sesion.usuario()?.rol === 'admin',
  );

  private readonly alVolverEnLinea = (): void => {
    this.enLinea.set(true);
    void this.sincronizar();
  };
  private readonly alPerderConexion = (): void => {
    this.enLinea.set(false);
  };

  ngOnInit(): void {
    window.addEventListener('online', this.alVolverEnLinea);
    window.addEventListener('offline', this.alPerderConexion);
    void this.iniciar();
  }

  private async iniciar(): Promise<void> {
    await this.sesion.inicializar();
    await this.datos.refrescar();
    if (!this.sesion.autenticado()) {
      return;
    }
    if (this.sesion.barrioId() === null) {
      await this.router.navigate(['/barrio']);
      return;
    }
    await this.sincro.sincronizar();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.alVolverEnLinea);
    window.removeEventListener('offline', this.alPerderConexion);
  }

  protected async sincronizar(): Promise<void> {
    await this.sincro.sincronizar();
  }

  protected alternarMenu(): void {
    this.menuAbierto.update((abierto) => !abierto);
  }

  protected cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  protected async sincronizarDesdeMenu(): Promise<void> {
    this.cerrarMenu();
    await this.sincronizar();
  }

  protected async salir(): Promise<void> {
    this.cerrarMenu();
    await this.sesion.logout();
    await this.router.navigate(['/login']);
  }
}

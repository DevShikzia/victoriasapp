import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { BarrioDto } from '@victoriasapp/shared';

import { SesionService } from '../../core/auth/sesion.service';
import { mensajeDeError } from '../../core/http/mensaje-error';
import { SincronizadorService } from '../../core/sync/sincronizador.service';

/**
 * Primer ingreso: la cuenta elige (o crea) el barrio en el que va a trabajar.
 * Queda fijado para siempre; a partir de ahí toda la app usa ese barrio.
 */
@Component({
  selector: 'app-barrio',
  imports: [FormsModule],
  templateUrl: './barrio.html',
  styleUrl: './barrio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Barrio implements OnInit {
  private readonly sesion = inject(SesionService);
  private readonly sincro = inject(SincronizadorService);
  private readonly router = inject(Router);

  protected readonly barrios = signal<readonly BarrioDto[]>([]);
  protected readonly seleccionado = signal<BarrioDto | null>(null);
  protected readonly cargando = signal(true);
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sinConexion = signal(!navigator.onLine);

  protected nombre = '';
  protected direccion = '';

  ngOnInit(): void {
    void this.iniciar();
  }

  private async iniciar(): Promise<void> {
    if (this.sesion.barrioId() !== null) {
      await this.router.navigate(['/buscar']);
      return;
    }
    await this.cargar();
  }

  protected get puedeConfirmar(): boolean {
    return this.seleccionado() !== null && !this.ocupado();
  }

  protected get puedeCrear(): boolean {
    return this.nombre.trim() !== '' && !this.ocupado();
  }

  protected async cargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    this.sinConexion.set(!navigator.onLine);
    try {
      const barrios = await this.sesion.listarBarrios();
      this.barrios.set(barrios);
      if (barrios.length === 1) {
        const unico = barrios[0] ?? null;
        this.seleccionado.set(unico);
      }
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  protected seleccionar(barrio: BarrioDto): void {
    if (this.ocupado()) {
      return;
    }
    this.seleccionado.set(barrio);
    this.error.set(null);
  }

  protected async confirmar(): Promise<void> {
    const barrio = this.seleccionado();
    if (barrio === null || this.ocupado()) {
      return;
    }
    await this.guardar({ barrioId: barrio.id });
  }

  protected async crear(): Promise<void> {
    const nombre = this.nombre.trim();
    if (nombre === '' || this.ocupado()) {
      return;
    }
    await this.guardar({
      nombre,
      direccion: this.direccion.trim() === '' ? null : this.direccion.trim(),
    });
  }

  private async guardar(
    datos: { barrioId: string } | { nombre: string; direccion: string | null },
  ): Promise<void> {
    this.ocupado.set(true);
    this.error.set(null);
    try {
      await this.sesion.elegirBarrio(datos);
      // Ya hay token con barrio: bajamos el directorio antes de entrar.
      await this.sincro.sincronizar();
      await this.router.navigate(['/buscar']);
    } catch (e) {
      // Si la cuenta ya tenía barrio (por ejemplo, una sesión vieja en este
      // dispositivo), renovamos el token y entramos con el barrio real.
      if (e instanceof HttpErrorResponse && e.status === 409 && (await this.recuperarBarrio())) {
        return;
      }
      this.error.set(mensajeDeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }

  /** Recupera el barrio que la cuenta ya tenía asignado en el servidor. */
  private async recuperarBarrio(): Promise<boolean> {
    const renovado = await this.sesion.renovar();
    if (!renovado || this.sesion.barrioId() === null) {
      return false;
    }
    await this.sincro.sincronizar();
    await this.router.navigate(['/buscar']);
    return true;
  }
}

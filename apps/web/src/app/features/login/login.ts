import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import type { Credenciales } from '@victoriasapp/shared';

import { SesionService } from '../../core/auth/sesion.service';
import { mensajeDeError } from '../../core/http/mensaje-error';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly sesion = inject(SesionService);
  private readonly router = inject(Router);

  protected usuario = '';
  protected password = '';
  protected readonly ocupado = signal(false);
  protected readonly error = signal<string | null>(null);

  protected get puedeEnviar(): boolean {
    return this.usuario.trim() !== '' && this.password !== '' && !this.ocupado();
  }

  protected async ingresar(): Promise<void> {
    if (!this.puedeEnviar) {
      return;
    }
    this.ocupado.set(true);
    this.error.set(null);
    const credenciales: Credenciales = { usuario: this.usuario.trim(), password: this.password };
    try {
      await this.sesion.login(credenciales);
      await this.router.navigate(['/visitas']);
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.ocupado.set(false);
    }
  }
}

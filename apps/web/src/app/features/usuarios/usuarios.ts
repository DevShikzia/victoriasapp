import { ChangeDetectionStrategy, Component, type OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LONGITUD_MINIMA_PASSWORD,
  ROLES_USUARIO,
  type RolUsuario,
  type UsuarioAdmin,
} from '@victoriasapp/shared';

import { mensajeDeError } from '../../core/http/mensaje-error';
import { UsuariosAdminService } from '../../core/usuarios/usuarios-admin.service';

/** Modelo del formulario de usuario: todo string/boolean para inputs nativos. */
interface ModeloUsuario {
  usuario: string;
  nombre: string;
  password: string;
  rol: RolUsuario;
  garitaId: string;
  activo: boolean;
}

function modeloNuevo(): ModeloUsuario {
  return { usuario: '', nombre: '', password: '', rol: 'guardia', garitaId: '', activo: true };
}

const REGEX_USUARIO = /^[a-zA-Z0-9._-]+$/;

/**
 * ABM de usuarios (sólo `admin`): alta, edición, baja lógica y reactivación.
 * Es online (no usa la caché offline del directorio).
 */
@Component({
  selector: 'app-usuarios',
  imports: [FormsModule],
  templateUrl: './usuarios.html',
  styleUrl: './usuarios.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Usuarios implements OnInit {
  private readonly api = inject(UsuariosAdminService);

  protected readonly roles = ROLES_USUARIO;
  protected readonly minimoPassword = LONGITUD_MINIMA_PASSWORD;

  protected readonly items = signal<readonly UsuarioAdmin[]>([]);
  protected readonly cargando = signal(false);
  protected readonly guardando = signal(false);
  protected readonly mensaje = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly modelo = signal<ModeloUsuario>(modeloNuevo());
  protected readonly editandoId = signal<string | null>(null);

  ngOnInit(): void {
    void this.recargar();
  }

  // --- Listado ---

  protected async recargar(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);
    try {
      this.items.set(await this.api.listar());
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.cargando.set(false);
    }
  }

  // --- Formulario ---

  protected nuevo(): void {
    this.editandoId.set(null);
    this.modelo.set(modeloNuevo());
    this.mensaje.set(null);
    this.error.set(null);
  }

  protected editar(usuario: UsuarioAdmin): void {
    this.editandoId.set(usuario.id);
    this.modelo.set({
      usuario: usuario.usuario,
      nombre: usuario.nombre,
      password: '',
      rol: usuario.rol,
      garitaId: usuario.garitaId ?? '',
      activo: usuario.activo,
    });
    this.mensaje.set(null);
    this.error.set(null);
  }

  protected cancelarEdicion(): void {
    this.editandoId.set(null);
    this.modelo.set(modeloNuevo());
  }

  protected valor(clave: keyof ModeloUsuario): string | boolean {
    return this.modelo()[clave];
  }

  protected actualizarCampo(clave: keyof ModeloUsuario, valor: string | boolean): void {
    this.modelo.update((m) => ({ ...m, [clave]: valor }));
  }

  protected async guardar(): Promise<void> {
    const m = this.modelo();
    const usuario = m.usuario.trim();
    const nombre = m.nombre.trim();
    const garita = m.garitaId.trim();
    const editando = this.editandoId();

    const faltantes: string[] = [];
    if (editando === null) {
      if (usuario === '' || !REGEX_USUARIO.test(usuario)) {
        faltantes.push('Usuario (3+ letras, números, punto, guion o guion bajo)');
      }
      if (m.password.length < this.minimoPassword) {
        faltantes.push(`Contraseña (mínimo ${String(this.minimoPassword)} caracteres)`);
      }
    } else if (m.password !== '' && m.password.length < this.minimoPassword) {
      faltantes.push(`Contraseña (mínimo ${String(this.minimoPassword)} caracteres)`);
    }
    if (nombre === '') {
      faltantes.push('Nombre');
    }

    if (faltantes.length > 0) {
      this.error.set(`Revisá: ${faltantes.join(', ')}.`);
      return;
    }

    this.guardando.set(true);
    this.error.set(null);
    try {
      if (editando === null) {
        await this.api.crear({
          usuario,
          nombre,
          password: m.password,
          rol: m.rol,
          garitaId: garita === '' ? null : garita,
        });
        this.mensaje.set(`Usuario "${usuario}" creado.`);
      } else {
        await this.api.actualizar(editando, {
          nombre,
          rol: m.rol,
          activo: m.activo,
          garitaId: garita === '' ? null : garita,
          ...(m.password === '' ? {} : { password: m.password }),
        });
        this.mensaje.set(`Usuario "${usuario}" actualizado.`);
      }
      await this.recargar();
      this.cancelarEdicion();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    } finally {
      this.guardando.set(false);
    }
  }

  // --- Baja y reactivación ---

  protected async desactivar(usuario: UsuarioAdmin): Promise<void> {
    if (!window.confirm(`¿Desactivar a "${usuario.nombre}" (${usuario.usuario})?`)) {
      return;
    }
    this.error.set(null);
    try {
      await this.api.desactivar(usuario.id);
      this.mensaje.set(`Usuario "${usuario.usuario}" desactivado.`);
      await this.recargar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }

  protected async activar(usuario: UsuarioAdmin): Promise<void> {
    this.error.set(null);
    try {
      await this.api.actualizar(usuario.id, { activo: true });
      this.mensaje.set(`Usuario "${usuario.usuario}" activado.`);
      await this.recargar();
    } catch (e) {
      this.error.set(mensajeDeError(e));
    }
  }
}

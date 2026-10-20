import { ChangeDetectionStrategy, Component, HostListener, input, output } from '@angular/core';
import type { FamiliarLocal, VehiculoLocal } from '@victoriasapp/shared';

import type { DetalleFicha, TipoResultado } from '../../core/busqueda/tipos';

/**
 * Ficha informativa de un resultado del directorio (propietario, familiar,
 * vehículo o lote). Es un bottom sheet en el celular y un panel lateral en
 * escritorio. No navega ni ejecuta acciones: sólo muestra datos.
 */
@Component({
  selector: 'app-ficha-directorio',
  templateUrl: './ficha-directorio.html',
  styleUrl: './ficha-directorio.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FichaDirectorio {
  readonly detalle = input<DetalleFicha | null>(null);
  readonly cerrar = output();

  @HostListener('document:keydown.escape')
  cerrarConEscape(): void {
    if (this.detalle() !== null) {
      this.cerrar.emit();
    }
  }

  protected etiquetaTipo(tipo: TipoResultado): string {
    switch (tipo) {
      case 'propietario':
        return 'Propietario';
      case 'familiar':
        return 'Familiar';
      case 'vehiculo':
        return 'Vehículo';
      case 'lote':
        return 'Lote';
    }
  }

  protected descripcionVehiculo(vehiculo: VehiculoLocal): string {
    return [vehiculo.marca, vehiculo.modelo, vehiculo.color]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(' ');
  }

  protected descripcionFamiliar(familiar: FamiliarLocal): string {
    return [familiar.parentesco, familiar.propietarioNombre]
      .filter((parte): parte is string => parte !== null && parte !== '')
      .join(' · ');
  }
}

import { Injectable, inject } from '@angular/core';
import type {
  FamiliarLocal,
  LoteLocal,
  PropietarioLocal,
  VehiculoLocal,
} from '@victoriasapp/shared';

import { DatosService } from '../db/datos.service';
import type { DetalleFicha, FilaDetalle, ResultadoBusqueda, ResultadosGlobales } from './tipos';

type EntradaFila = readonly [string, string | null | undefined];

function texto(valor: string | null | undefined): string | null {
  const limpio = (valor ?? '').trim();
  return limpio === '' ? null : limpio;
}

function nombreDePropietario(propietario: PropietarioLocal): string {
  return `${propietario.apellido}, ${propietario.nombre}`;
}

function unir(partes: readonly (string | null | undefined)[]): string | null {
  const limpias = partes.map(texto).filter((parte): parte is string => parte !== null);
  return limpias.length === 0 ? null : limpias.join(' · ');
}

/**
 * Orquesta el buscador global y arma la ficha de cada resultado.
 *
 * La búsqueda y los cruces salen **exclusivamente de IndexedDB** (directorio
 * cacheado), así que funciona sin conexión. Ver
 * `docs/15-buscador-global-y-rediseno-mobile.md`.
 */
@Injectable({ providedIn: 'root' })
export class BuscadorService {
  private readonly datos = inject(DatosService);

  buscar(consulta: string): Promise<ResultadosGlobales> {
    return this.datos.buscarGlobal(consulta);
  }

  async detalle(resultado: ResultadoBusqueda): Promise<DetalleFicha> {
    switch (resultado.tipo) {
      case 'propietario':
        return this.detallePropietario(resultado.entidad);
      case 'familiar':
        return this.detalleFamiliar(resultado.entidad);
      case 'vehiculo':
        return this.detalleVehiculo(resultado.entidad);
      case 'lote':
        return this.detalleLote(resultado.entidad);
    }
  }

  private async detallePropietario(propietario: PropietarioLocal): Promise<DetalleFicha> {
    const nombre = nombreDePropietario(propietario);
    const lote = texto(propietario.loteNumero);
    const [familiares, vehiculos] = await Promise.all([
      this.datos.familiaresRelacionados(nombre, propietario.loteNumero),
      this.datos.vehiculosRelacionados(nombre, propietario.loteNumero),
    ]);

    return {
      tipo: 'propietario',
      titulo: nombre,
      subtitulo: lote === null ? null : `Lote ${lote}`,
      filas: this.filas([
        ['Teléfono', propietario.telefono],
        ['Email', propietario.email],
        ['Lote', propietario.loteNumero],
        ['Descripción', propietario.descripcion],
      ]),
      propietarios: [],
      familiares,
      vehiculos,
    };
  }

  private async detalleFamiliar(familiar: FamiliarLocal): Promise<DetalleFicha> {
    const lote = texto(familiar.loteNumero);
    const [propietarios, familiares, vehiculos] = await Promise.all([
      this.datos.propietariosDelLote(familiar.loteNumero),
      this.datos.familiaresRelacionados(familiar.propietarioNombre, familiar.loteNumero),
      this.datos.vehiculosRelacionados(familiar.propietarioNombre, familiar.loteNumero),
    ]);

    return {
      tipo: 'familiar',
      titulo: familiar.nombre,
      subtitulo: unir([familiar.parentesco, lote === null ? null : `Lote ${lote}`]),
      filas: this.filas([
        ['Parentesco', familiar.parentesco],
        ['Propietario', familiar.propietarioNombre],
        ['Lote', familiar.loteNumero],
      ]),
      propietarios,
      familiares: familiares.filter((f) => f.uuid !== familiar.uuid),
      vehiculos,
    };
  }

  private async detalleVehiculo(vehiculo: VehiculoLocal): Promise<DetalleFicha> {
    const [propietarios, familiares, vehiculos] = await Promise.all([
      this.datos.propietariosDelLote(vehiculo.loteNumero),
      this.datos.familiaresRelacionados(vehiculo.propietarioNombre, vehiculo.loteNumero),
      this.datos.vehiculosRelacionados(vehiculo.propietarioNombre, vehiculo.loteNumero),
    ]);

    return {
      tipo: 'vehiculo',
      titulo: vehiculo.patente,
      subtitulo: unir([vehiculo.marca, vehiculo.modelo]),
      filas: this.filas([
        ['Marca', vehiculo.marca],
        ['Modelo', vehiculo.modelo],
        ['Color', vehiculo.color],
        ['Propietario', vehiculo.propietarioNombre],
        ['Lote', vehiculo.loteNumero],
      ]),
      propietarios,
      familiares,
      vehiculos: vehiculos.filter((v) => v.uuid !== vehiculo.uuid),
    };
  }

  private async detalleLote(lote: LoteLocal): Promise<DetalleFicha> {
    const [propietarios, familiares, vehiculos] = await Promise.all([
      this.datos.propietariosDelLote(lote.numero),
      this.datos.familiaresRelacionados(null, lote.numero),
      this.datos.vehiculosRelacionados(null, lote.numero),
    ]);

    return {
      tipo: 'lote',
      titulo: `Lote ${lote.numero}`,
      subtitulo: texto(lote.calle),
      filas: this.filas([
        ['Calle', lote.calle],
        ['Propietario', lote.propietarioNombre],
      ]),
      propietarios,
      familiares,
      vehiculos,
    };
  }

  private filas(entradas: readonly EntradaFila[]): readonly FilaDetalle[] {
    const resultado: FilaDetalle[] = [];
    for (const [etiqueta, valor] of entradas) {
      const limpio = texto(valor);
      if (limpio !== null) {
        resultado.push({ etiqueta, valor: limpio });
      }
    }
    return resultado;
  }
}

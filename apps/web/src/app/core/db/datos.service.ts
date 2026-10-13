import { Injectable, signal } from '@angular/core';
import type {
  LoteLocal,
  NuevaVisita,
  PropietarioLocal,
  VehiculoLocal,
  Visita,
} from '@victoriasapp/shared';
import { crearIdLocal, normalizarPatente } from '@victoriasapp/shared';

import { BaseLocal } from './base-local';
import { datosDeEjemplo } from './seed';

/**
 * Acceso a los datos locales del PWA (IndexedDB) y operaciones de negocio
 * offline: guardar visitas, marcarlas como egreso, buscar en el directorio
 * cacheado. Cada cambio encola una operación en `outbox`.
 */
@Injectable({ providedIn: 'root' })
export class DatosService {
  private readonly db = new BaseLocal();

  /** Visitas locales, más recientes primero. */
  readonly visitas = signal<readonly Visita[]>([]);
  /** Cantidad de operaciones pendientes de sincronizar. */
  readonly pendientes = signal(0);
  /** Cantidad de visitas abiertas (sin salida). */
  readonly abiertas = signal(0);
  /** `true` cuando ya se leyó la base local al menos una vez. */
  readonly listo = signal(false);

  async refrescar(): Promise<void> {
    const visitas = await this.db.visitas.orderBy('entradaEn').reverse().toArray();
    this.visitas.set(visitas);
    this.pendientes.set(await this.db.outbox.count());
    this.abiertas.set(visitas.filter((v) => v.salidaEn === null).length);
    this.listo.set(true);
  }

  async guardarVisita(nueva: NuevaVisita): Promise<Visita> {
    const ahora = new Date().toISOString();
    const visita: Visita = {
      ...nueva,
      uuid: crearIdLocal(),
      salidaEn: null,
      creadoOffline: true,
      estadoSync: 'pendiente',
      intentosSync: 0,
      ultimoErrorSync: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
    };

    await this.db.transaction('rw', this.db.visitas, this.db.outbox, async () => {
      await this.db.visitas.add(visita);
      await this.db.outbox.add({
        id: crearIdLocal(),
        entidad: 'visita',
        operacion: 'create',
        uuid: visita.uuid,
        payload: { ...visita },
        creadoEn: ahora,
        intentos: 0,
        ultimoError: null,
      });
    });

    await this.refrescar();
    return visita;
  }

  async marcarSalida(uuid: string, salidaEnIso: string = new Date().toISOString()): Promise<void> {
    await this.db.transaction('rw', this.db.visitas, this.db.outbox, async () => {
      const actual = await this.db.visitas.get(uuid);
      if (actual === undefined) {
        return;
      }
      const ahora = new Date().toISOString();
      const actualizada: Visita = {
        ...actual,
        salidaEn: salidaEnIso,
        estadoSync: 'pendiente',
        actualizadoEn: ahora,
      };
      await this.db.visitas.put(actualizada);
      await this.db.outbox.add({
        id: crearIdLocal(),
        entidad: 'visita',
        operacion: 'update',
        uuid,
        payload: { ...actualizada },
        creadoEn: ahora,
        intentos: 0,
        ultimoError: null,
      });
    });

    await this.refrescar();
  }

  // --- Directorio (caché local) ---

  async buscarLotes(consulta: string): Promise<readonly LoteLocal[]> {
    const q = consulta.trim().toLowerCase();
    if (q === '') {
      return [];
    }
    const lotes = await this.db.lotes.toArray();
    return lotes
      .filter(
        (l) => l.numero.toLowerCase().includes(q) || (l.calle ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }

  async buscarPropietarios(consulta: string): Promise<readonly PropietarioLocal[]> {
    const q = consulta.trim().toLowerCase();
    if (q === '') {
      return [];
    }
    const propietarios = await this.db.propietarios.toArray();
    return propietarios
      .filter((p) => {
        const nombreCompleto = `${p.apellido} ${p.nombre}`.toLowerCase();
        return nombreCompleto.includes(q) || (p.loteNumero ?? '') === q;
      })
      .slice(0, 8);
  }

  async propietarioPorNombre(nombre: string): Promise<PropietarioLocal | undefined> {
    const objetivo = nombre.trim().toLowerCase();
    if (objetivo === '') {
      return undefined;
    }
    const propietarios = await this.db.propietarios.toArray();
    return propietarios.find(
      (p) =>
        `${p.apellido}, ${p.nombre}`.toLowerCase() === objetivo ||
        `${p.apellido} ${p.nombre}`.toLowerCase() === objetivo,
    );
  }

  async lotePorNumero(numero: string): Promise<LoteLocal | undefined> {
    const norm = numero.trim();
    if (norm === '') {
      return undefined;
    }
    return this.db.lotes.where('numero').equals(norm).first();
  }

  async vehiculoPorPatente(patente: string): Promise<VehiculoLocal | undefined> {
    const norm = normalizarPatente(patente);
    if (norm === '') {
      return undefined;
    }
    return this.db.vehiculos.where('patente').equals(norm).first();
  }

  async contarDirectorio(): Promise<number> {
    return (
      (await this.db.propietarios.count()) +
      (await this.db.lotes.count()) +
      (await this.db.vehiculos.count()) +
      (await this.db.familiares.count())
    );
  }

  // --- Utilidades de desarrollo ---

  async cargarEjemplo(): Promise<void> {
    const datos = datosDeEjemplo();
    await this.db.transaction(
      'rw',
      this.db.lotes,
      this.db.propietarios,
      this.db.familiares,
      this.db.vehiculos,
      async () => {
        await this.db.lotes.bulkPut([...datos.lotes]);
        await this.db.propietarios.bulkPut([...datos.propietarios]);
        await this.db.familiares.bulkPut([...datos.familiares]);
        await this.db.vehiculos.bulkPut([...datos.vehiculos]);
      },
    );
  }

  /** Borra todo (visitas, outbox y directorio). Útil en desarrollo. */
  async limpiar(): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      for (const tabla of this.db.tables) {
        await tabla.clear();
      }
    });
    await this.refrescar();
  }
}

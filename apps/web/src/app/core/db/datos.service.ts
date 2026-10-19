import { Injectable, signal } from '@angular/core';
import type {
  DirectorioPull,
  EntidadDirectorio,
  ErrorSync,
  FamiliarLocal,
  LoteLocal,
  NuevaVisita,
  PropietarioLocal,
  VehiculoLocal,
  Visita,
  VisitaSync,
} from '@victoriasapp/shared';
import {
  META_ULTIMA_SYNC_DIRECTORIO,
  crearIdLocal,
  esquemaVisitaSync,
  normalizarParaBusqueda,
  normalizarPatente,
  ordenarPorCoincidencia,
} from '@victoriasapp/shared';

import { RESULTADOS_VACIOS, type ResultadosGlobales } from '../busqueda/tipos';
import { obtenerBaseLocal } from './base-local';
import { datosDeEjemplo } from './seed';

/**
 * Acceso a los datos locales del PWA (IndexedDB) y operaciones de negocio
 * offline: guardar visitas, marcarlas como egreso, buscar en el directorio
 * cacheado. Cada cambio encola una operación en `outbox`.
 */
@Injectable({ providedIn: 'root' })
export class DatosService {
  private readonly db = obtenerBaseLocal();

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

  // --- Sincronización (outbox → API) ---

  /**
   * Devuelve las visitas con cambios pendientes, ya deduplicadas por `uuid`
   * (gana la versión más nueva) y validadas contra el esquema de sync.
   */
  async visitasPendientesSync(): Promise<readonly VisitaSync[]> {
    const items = await this.db.outbox.where('entidad').equals('visita').toArray();
    const porUuid = new Map<string, VisitaSync>();
    for (const item of items) {
      const resultado = esquemaVisitaSync.safeParse(item.payload);
      if (!resultado.success) {
        continue;
      }
      const actual = porUuid.get(resultado.data.uuid);
      if (actual === undefined || resultado.data.actualizadoEn > actual.actualizadoEn) {
        porUuid.set(resultado.data.uuid, resultado.data);
      }
    }
    return [...porUuid.values()];
  }

  /** Marca las visitas ya aplicadas como sincronizadas y limpia su outbox. */
  async confirmarSincronizacion(uuids: readonly string[]): Promise<void> {
    if (uuids.length === 0) {
      return;
    }
    await this.db.transaction('rw', this.db.visitas, this.db.outbox, async () => {
      for (const uuid of uuids) {
        const visita = await this.db.visitas.get(uuid);
        if (visita !== undefined) {
          await this.db.visitas.put({
            ...visita,
            estadoSync: 'sincronizada',
            ultimoErrorSync: null,
          });
        }
      }
      const items = await this.db.outbox.where('entidad').equals('visita').toArray();
      const ids = items.filter((item) => uuids.includes(item.uuid)).map((item) => item.id);
      if (ids.length > 0) {
        await this.db.outbox.bulkDelete(ids);
      }
    });
    await this.refrescar();
  }

  /** Anota los errores de sincronización devueltos por la API. */
  async registrarErroresSync(errores: readonly ErrorSync[]): Promise<void> {
    if (errores.length === 0) {
      return;
    }
    await this.db.transaction('rw', this.db.outbox, this.db.visitas, async () => {
      for (const error of errores) {
        const items = await this.db.outbox.where('uuid').equals(error.uuid).toArray();
        for (const item of items) {
          await this.db.outbox.put({
            ...item,
            intentos: item.intentos + 1,
            ultimoError: error.mensaje,
          });
        }
        const visita = await this.db.visitas.get(error.uuid);
        if (visita !== undefined) {
          await this.db.visitas.put({ ...visita, ultimoErrorSync: error.mensaje });
        }
      }
    });
    await this.refrescar();
  }

  /**
   * Busca lotes en la caché local por número, calle o propietario.
   * La coincidencia es **difusa** (sin acentos, por prefijo y tolerante a
   * errores de tipeo); devuelve los más relevantes primero.
   */
  async buscarLotes(consulta: string): Promise<readonly LoteLocal[]> {
    const q = consulta.trim();
    if (q === '') {
      return [];
    }
    const lotes = await this.db.lotes.toArray();
    return ordenarPorCoincidencia(lotes, q, (l) => [l.numero, l.calle, l.propietarioNombre]);
  }

  /** Busca propietarios por apellido, nombre, nombre completo o lote. Difusa. */
  async buscarPropietarios(consulta: string): Promise<readonly PropietarioLocal[]> {
    const q = consulta.trim();
    if (q === '') {
      return [];
    }
    const propietarios = await this.db.propietarios.toArray();
    return ordenarPorCoincidencia(propietarios, q, (p) => [
      p.apellido,
      p.nombre,
      `${p.apellido}, ${p.nombre}`,
      `${p.nombre} ${p.apellido}`,
      p.loteNumero,
    ]);
  }

  /** Busca vehículos por patente, dueño, marca, modelo o lote. Difusa. */
  async buscarVehiculos(consulta: string): Promise<readonly VehiculoLocal[]> {
    const q = consulta.trim();
    if (q === '') {
      return [];
    }
    const vehiculos = await this.db.vehiculos.toArray();
    return ordenarPorCoincidencia(vehiculos, q, (v) => [
      v.patente,
      v.propietarioNombre,
      v.marca,
      v.modelo,
      v.loteNumero,
    ]);
  }

  /** Busca familiares por nombre, parentesco, propietario o lote. Difusa. */
  async buscarFamiliares(consulta: string): Promise<readonly FamiliarLocal[]> {
    const q = consulta.trim();
    if (q === '') {
      return [];
    }
    const familiares = await this.db.familiares.toArray();
    return ordenarPorCoincidencia(familiares, q, (f) => [
      f.nombre,
      f.parentesco,
      f.propietarioNombre,
      f.loteNumero,
    ]);
  }

  /**
   * Buscador global: consulta en paralelo propietarios, familiares, vehículos y
   * lotes, y devuelve los grupos ya ordenados por relevancia. Es la base de la
   * pantalla `/buscar` y funciona 100 % offline.
   */
  async buscarGlobal(consulta: string): Promise<ResultadosGlobales> {
    const q = consulta.trim();
    if (q === '') {
      return RESULTADOS_VACIOS;
    }

    const [propietarios, familiares, vehiculos, lotes] = await Promise.all([
      this.buscarPropietarios(q),
      this.buscarFamiliares(q),
      this.buscarVehiculos(q),
      this.buscarLotes(q),
    ]);

    return {
      propietarios,
      familiares,
      vehiculos,
      lotes,
      total: propietarios.length + familiares.length + vehiculos.length + lotes.length,
    };
  }

  /**
   * Familiares que comparten propietario y/o lote. Se usa para la ficha: las
   * proyecciones locales no guardan ids de referencia, así que se cruzan por
   * nombre normalizado y número de lote.
   */
  async familiaresRelacionados(
    propietarioNombre: string | null,
    loteNumero: string | null,
  ): Promise<readonly FamiliarLocal[]> {
    const objetivo = normalizarParaBusqueda(propietarioNombre ?? '');
    const lote = (loteNumero ?? '').trim();
    if (objetivo === '' && lote === '') {
      return [];
    }

    const familiares = await this.db.familiares.toArray();
    return familiares.filter(
      (f) =>
        (objetivo !== '' && normalizarParaBusqueda(f.propietarioNombre) === objetivo) ||
        (lote !== '' && (f.loteNumero ?? '').trim() === lote),
    );
  }

  /** Vehículos que comparten propietario y/o lote (para la ficha). */
  async vehiculosRelacionados(
    propietarioNombre: string | null,
    loteNumero: string | null,
  ): Promise<readonly VehiculoLocal[]> {
    const objetivo = normalizarParaBusqueda(propietarioNombre ?? '');
    const lote = (loteNumero ?? '').trim();
    if (objetivo === '' && lote === '') {
      return [];
    }

    const vehiculos = await this.db.vehiculos.toArray();
    return vehiculos.filter(
      (v) =>
        (objetivo !== '' && normalizarParaBusqueda(v.propietarioNombre ?? '') === objetivo) ||
        (lote !== '' && (v.loteNumero ?? '').trim() === lote),
    );
  }

  /** Propietarios registrados en un lote (para la ficha del lote). */
  async propietariosDelLote(loteNumero: string | null): Promise<readonly PropietarioLocal[]> {
    const lote = (loteNumero ?? '').trim();
    if (lote === '') {
      return [];
    }

    const propietarios = await this.db.propietarios.toArray();
    return propietarios.filter((p) => (p.loteNumero ?? '').trim() === lote);
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

  // --- Directorio remoto (pull incremental) ---

  /** Lee un valor de metadatos locales. */
  async valorMeta(clave: string): Promise<string | null> {
    const item = await this.db.meta.get(clave);
    return item?.valor ?? null;
  }

  /**
   * Aplica el resultado del pull incremental del directorio a la caché local.
   * Idempotente: hace `bulkPut` por uuid y procesa las bajas.
   */
  async aplicarDirectorio(pull: DirectorioPull): Promise<void> {
    await this.db.transaction(
      'rw',
      this.db.lotes,
      this.db.propietarios,
      this.db.familiares,
      this.db.vehiculos,
      this.db.meta,
      async () => {
        if (pull.lotes.length > 0) {
          await this.db.lotes.bulkPut([...pull.lotes]);
        }
        if (pull.propietarios.length > 0) {
          await this.db.propietarios.bulkPut([...pull.propietarios]);
        }
        if (pull.familiares.length > 0) {
          await this.db.familiares.bulkPut([...pull.familiares]);
        }
        if (pull.vehiculos.length > 0) {
          await this.db.vehiculos.bulkPut([...pull.vehiculos]);
        }
        for (const eliminado of pull.eliminados) {
          await this.borrarEntidadLocal(eliminado.entidad, eliminado.uuid);
        }
        await this.db.meta.put({ clave: META_ULTIMA_SYNC_DIRECTORIO, valor: pull.desde });
      },
    );
  }

  private async borrarEntidadLocal(entidad: EntidadDirectorio, uuid: string): Promise<void> {
    switch (entidad) {
      case 'lote':
        await this.db.lotes.delete(uuid);
        break;
      case 'propietario':
        await this.db.propietarios.delete(uuid);
        break;
      case 'familiar':
        await this.db.familiares.delete(uuid);
        break;
      case 'vehiculo':
        await this.db.vehiculos.delete(uuid);
        break;
      case 'barrio':
        break;
    }
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

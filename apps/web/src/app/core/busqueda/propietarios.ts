import type { PropietarioLocal } from '@victoriasapp/shared';
import {
  etiquetaTratamiento,
  normalizarParaBusqueda,
  puntuarCoincidencia,
  rangoTratamiento,
} from '@victoriasapp/shared';

/** Cómo se ordena el listado rápido de propietarios. */
export type CriterioOrdenPropietarios = 'lote' | 'alfabetico';

/** Cómo se ordenan los grupos cuando se muestran juntos por lote. */
export type OrdenGruposPropietarios = 'lote' | 'senor' | 'senora';

/** Propietarios de un mismo lote reunidos para el listado agrupado. */
export interface GrupoPropietariosLocal {
  readonly clave: string;
  readonly loteNumero: string | null;
  readonly propietarios: readonly PropietarioLocal[];
}

function compararTexto(a: string, b: string): number {
  return a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true });
}

function compararLote(a: PropietarioLocal, b: PropietarioLocal): number {
  const loteA = (a.loteNumero ?? '').trim();
  const loteB = (b.loteNumero ?? '').trim();
  if (loteA === '' && loteB !== '') {
    return 1;
  }
  if (loteB === '' && loteA !== '') {
    return -1;
  }
  return compararTexto(loteA, loteB);
}

function compararNombre(a: PropietarioLocal, b: PropietarioLocal): number {
  return compararTexto(a.apellido, b.apellido) || compararTexto(a.nombre, b.nombre);
}

function compararTratamiento(a: PropietarioLocal, b: PropietarioLocal): number {
  return rangoTratamiento(a.tratamiento) - rangoTratamiento(b.tratamiento);
}

/**
 * Ordena propietarios para el listado rápido.
 *
 * - `lote`: por número de lote (numérico, los vacíos al final); dentro del mismo
 *   lote, primero el señor, después la señora y al final los que no tienen dato;
 *   a igual tratamiento, por apellido y nombre.
 * - `alfabetico`: por apellido y nombre; a igual nombre, por tratamiento.
 */
export function ordenarPropietarios(
  propietarios: readonly PropietarioLocal[],
  criterio: CriterioOrdenPropietarios,
): readonly PropietarioLocal[] {
  return [...propietarios].sort((a, b) => {
    if (criterio === 'lote') {
      return compararLote(a, b) || compararTratamiento(a, b) || compararNombre(a, b);
    }
    return compararNombre(a, b) || compararTratamiento(a, b) || compararLote(a, b);
  });
}

/** Texto sobre el que se busca: nombre completo, lote y tratamiento. */
function textoBuscable(propietario: PropietarioLocal): string {
  return [
    propietario.apellido,
    propietario.nombre,
    `${propietario.apellido}, ${propietario.nombre}`,
    `${propietario.nombre} ${propietario.apellido}`,
    propietario.loteNumero ?? '',
    etiquetaTratamiento(propietario.tratamiento) ?? '',
  ].join(' ');
}

/**
 * Filtra por nombre, apellido, lote o tratamiento. La búsqueda es difusa y
 * tolera tildes/mayúsculas; con la consulta vacía devuelve todos.
 */
export function filtrarPropietarios(
  propietarios: readonly PropietarioLocal[],
  consulta: string,
): readonly PropietarioLocal[] {
  if (normalizarParaBusqueda(consulta) === '') {
    return propietarios;
  }
  return propietarios.filter(
    (propietario) => puntuarCoincidencia(textoBuscable(propietario), consulta) > 0,
  );
}

/** Aplica búsqueda y orden en un solo paso. */
export function buscarYOrdenarPropietarios(
  propietarios: readonly PropietarioLocal[],
  consulta: string,
  criterio: CriterioOrdenPropietarios,
): readonly PropietarioLocal[] {
  return ordenarPropietarios(filtrarPropietarios(propietarios, consulta), criterio);
}

function claveLote(propietario: PropietarioLocal): string {
  return (propietario.loteNumero ?? '').trim();
}

function compararGrupos(
  a: GrupoPropietariosLocal,
  b: GrupoPropietariosLocal,
  orden: OrdenGruposPropietarios,
): number {
  if (orden !== 'lote') {
    const propietarioA =
      a.propietarios.find((propietario) => propietario.tratamiento === orden) ?? a.propietarios[0];
    const propietarioB =
      b.propietarios.find((propietario) => propietario.tratamiento === orden) ?? b.propietarios[0];
    const porNombre = compararNombre(propietarioA, propietarioB);
    if (porNombre !== 0) {
      return porNombre;
    }
  }

  const loteA = a.loteNumero ?? '';
  const loteB = b.loteNumero ?? '';
  if (loteA === '' && loteB !== '') {
    return 1;
  }
  if (loteB === '' && loteA !== '') {
    return -1;
  }
  return compararTexto(loteA, loteB);
}

/**
 * Agrupa los propietarios por lote. Si la búsqueda coincide con un titular, el
 * grupo muestra igual a todos los propietarios de ese lote. Los grupos se pueden
 * ordenar por lote o alfabéticamente por el señor o la señora.
 */
export function agruparPropietarios(
  propietarios: readonly PropietarioLocal[],
  consulta: string,
  orden: OrdenGruposPropietarios,
): readonly GrupoPropietariosLocal[] {
  const visibles = filtrarPropietarios(propietarios, consulta);
  const lotesVisibles = new Set(visibles.map(claveLote));
  const grupos = new Map<string, PropietarioLocal[]>();

  for (const propietario of propietarios) {
    const clave = claveLote(propietario);
    if (!lotesVisibles.has(clave)) {
      continue;
    }
    const existentes = grupos.get(clave);
    if (existentes === undefined) {
      grupos.set(clave, [propietario]);
    } else {
      existentes.push(propietario);
    }
  }

  return [...grupos.entries()]
    .map(([clave, lista]) => ({
      clave: clave === '' ? 'sin-lote' : clave,
      loteNumero: clave === '' ? null : clave,
      propietarios: ordenarPropietarios(lista, 'lote'),
    }))
    .sort((a, b) => compararGrupos(a, b, orden));
}

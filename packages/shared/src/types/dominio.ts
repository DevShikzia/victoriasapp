/**
 * Tipos del dominio de victoriasapp.
 * Todo el proyecto comparte estos tipos (front y back). Prohibido `any`.
 */

export const SEXOS = ['M', 'F', 'X'] as const;
export type Sexo = (typeof SEXOS)[number];

export const FORMATOS_DNI = ['pdf417-viejo', 'pdf417-intermedio', 'qr', 'mrz', 'manual'] as const;
export type DniFormato = (typeof FORMATOS_DNI)[number];

export const ROLES_USUARIO = ['admin', 'supervisor', 'guardia'] as const;
export type RolUsuario = (typeof ROLES_USUARIO)[number];

export const TIPOS_VISITA = ['ingreso', 'egreso'] as const;
export type TipoVisita = (typeof TIPOS_VISITA)[number];

/** Datos de identidad extraídos de un DNI. */
export interface DniData {
  readonly apellido: string;
  readonly nombre: string;
  readonly numeroDni: string;
  readonly sexo: Sexo | null;
  /** Fecha de nacimiento en ISO `YYYY-MM-DD`. */
  readonly fechaNacimiento: string | null;
  readonly numeroTramite: string | null;
  readonly ejemplar: string | null;
  /** Fecha de emisión en ISO `YYYY-MM-DD`. */
  readonly fechaEmision: string | null;
  /** Fecha de vencimiento en ISO `YYYY-MM-DD`. */
  readonly fechaVencimiento: string | null;
}

/** Resultado del parseo de un código de DNI. Nunca lanza excepción. */
export interface ParseResult {
  readonly ok: boolean;
  readonly formato: DniFormato | 'desconocido';
  readonly data: DniData | null;
  /** Payload crudo tal cual se leyó. */
  readonly raw: string;
  readonly errores: readonly string[];
}

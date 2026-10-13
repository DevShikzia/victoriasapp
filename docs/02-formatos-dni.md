# 02 — Formatos del DNI argentino

Este documento es la referencia técnica del parser. Define qué trae cada tipo de código y cómo se
extraen los datos.

## Tipos de DNI y dónde está la información

| Formato | Época | Dónde está el código | Datos que trae |
| --- | --- | --- | --- |
| **Libreta** (verde / bordó) | Antiguo | Código de barras 1D en la hoja | Solo el número de DNI (código único) |
| **DNI tarjeta viejo** | ~2009–2019 | **PDF417** en el **reverso** | Trámite, DNI, apellido, nombre, sexo, nacimiento, emisión, vencimiento |
| **DNI tarjeta intermedio** | ~2019–2023 | **PDF417** en el **frente** | Apellido, nombre, sexo, DNI, nacimiento, emisión |
| **DNI electrónico nuevo** | 2023 en adelante | **QR** en el frente + **MRZ** (Zona de Lectura Mecánica) | Todos los datos |

> Los dos que **fallan con los lectores comerciales** son el PDF417 grande del tarjeta viejo y el
> QR del nuevo. Son los que el parser debe manejar sí o sí.

## 1. PDF417

Es un código 2D apilado. Los campos se separan con el carácter **`@`**.

### 1.1 Formato viejo (reverso) — 16 o 17 campos

Índice base 0:

| Índice | Campo |
| --- | --- |
| 0 | Número de trámite |
| 1 | Número de DNI |
| 2 | Ejemplar |
| 3 | Reservado / sin uso |
| 4 | Apellido(s) (separados por espacio) |
| 5 | Nombre(s) |
| 6 | Reservado / sin uso |
| 7 | Fecha de nacimiento (DD/MM/AAAA) |
| 8 | Sexo (M / F / X) |
| 9 | Fecha de emisión (DD/MM/AAAA) |
| 12 | Fecha de vencimiento (DD/MM/AAAA) |

### 1.2 Formato intermedio (frente) — 8 o 9 campos

| Índice | Campo |
| --- | --- |
| 0 | Número de trámite |
| 1 | Apellido(s) |
| 2 | Nombre(s) |
| 3 | Sexo (M / F / X) |
| 4 | Número de DNI |
| 5 | Ejemplar |
| 6 | Fecha de nacimiento (DD/MM/AAAA) |
| 7 | Fecha de emisión (DD/MM/AAAA) |
| 8 | Inicio y fin de CUIL (opcional) |

### 1.3 Ejemplo de payload

```
00012345678@PEREZ@JUAN CARLOS@M@30123456@A@15/03/1985@10/06/2019
```

## 2. QR (DNI electrónico nuevo)

El QR contiene los datos de identidad. **El formato exacto no está publicado oficialmente y varía
entre versiones**, por lo que el parser se apoya en detección **por contenido**:

- Un número de DNI son **7 u 8 dígitos**.
- Las fechas siguen el patrón `DD/MM/AAAA` (o `YYYY-MM-DD` en algunas versiones).
- Un sexo es `M`, `F` o `X`.

> **Acción pendiente (Fase 0):** con el *Modo captura* se leerá el payload crudo de DNIs reales
> (viejo y nuevo) para fijar el mapeo exacto del QR. Ver
> [escaneo](./03-escaneo.md#modo-captura).

## 3. MRZ (Zona de Lectura Mecánica)

El DNI electrónico incluye una MRZ con formato **TD1** (3 líneas de 30 caracteres), según el estándar
ICAO 9303. Es un respaldo si el QR no se puede leer.

### Línea 1 (30 caracteres)

| Posiciones | Contenido |
| --- | --- |
| 1–2 | Tipo de documento (`ID`) |
| 3–5 | País emisor (`ARG`) |
| 6–14 | Número de documento |
| 15 | Dígito verificador |

### Línea 2 (30 caracteres)

| Posiciones | Contenido |
| --- | --- |
| 1–6 | Fecha de nacimiento (`YYMMDD`) |
| 7 | Dígito verificador |
| 8 | Sexo (`M`/`F`/`X`) |
| 9–14 | Fecha de vencimiento (`YYMMDD`) |
| 15 | Dígito verificador |
| 16–18 | País (`ARG`) |

### Línea 3 (30 caracteres)

Apellido(s), separador `<<`, nombre(s), relleno `<`.

```
IDARG30123456<8<<<<<<<<<<<<<<<
8503155M3003157ARG<<<<<<<<<<<8
PEREZ<<JUAN<CARLOS<<<<<<<<<<<<
```

Validación: cada campo numérico tiene un dígito verificador (ponderación 7-3-1, módulo 10).

## 4. Normalización de caracteres

El PDF417 solo soporta ASCII imprimible: no puede representar `ñ`, `ü` ni acentos. Cada versión lo
resuelve distinto.

| En el código aparece | Se interpreta como |
| --- | --- |
| `NXX` | `Ñ` |
| `UXX` | `Ü` |
| Vocal sin acento | Voz con posible acento (se conserva sin acento) |

Reglas del parser:

1. Reemplazar `NXX` → `Ñ` y `UXX` → `Ü`.
2. Recortar espacios repetidos.
3. Convertir fechas a ISO (`YYYY-MM-DD`) para almacenar.
4. Normalizar sexo a `M` / `F` / `X`.
5. **Todos los campos quedan editables** en el formulario, porque ninguna corrección automática
   cubre el 100% de los casos (la incidencia no corregible es menor al 0,1%).

## 5. Contrato del parser

```ts
export interface DniData {
  readonly apellido: string;
  readonly nombre: string;
  readonly numeroDni: string;
  readonly sexo: Sexo | null;
  readonly fechaNacimiento: string | null; // ISO YYYY-MM-DD
  readonly numeroTramite: string | null;
  readonly ejemplar: string | null;
  readonly fechaEmision: string | null;    // ISO
  readonly fechaVencimiento: string | null; // ISO
}

export interface ParseResult {
  readonly ok: boolean;
  readonly formato: DniFormato; // 'pdf417-viejo' | 'pdf417-intermedio' | 'qr' | 'mrz' | 'desconocido'
  readonly data: DniData | null;
  readonly raw: string;
  readonly errores: readonly string[];
}

export function parseDni(raw: string): ParseResult;
```

El parser **nunca lanza excepción**: devuelve `ok: false` con el motivo y el `raw`, para poder
diagnosticar con el Modo captura.

## 6. Estrategia de detección por contenido

En lugar de confiar en índices fijos (que cambian según la versión), el parser:

1. Divide el payload en tokens.
2. Clasifica cada token por patrón: DNI, fecha, sexo, trámite, ejemplar, texto.
3. Arma el `DniData` según el formato detectado.
4. Si no puede clasificar, devuelve `ok: false` y el crudo.

Esto hace que el sistema sea tolerante a nuevas versiones que reordenen o agreguen campos.

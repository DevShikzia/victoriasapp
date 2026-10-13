# 03 — Escaneo de códigos

## Objetivo

Leer, con la cámara de un celular Android, los códigos de los DNI argentinos:

- **QR** (DNI nuevo).
- **PDF417** (DNI tarjeta viejo e intermedio).
- **MRZ** (respaldo del DNI nuevo, por OCR).

El PDF417 es el más difícil: es denso y el "código grande" del DNI viejo suele leerse mal desde el
video en vivo. Por eso el diseño tiene varias capas.

## Capas de lectura

Se intentan en orden; si una falla, pasa a la siguiente.

### Capa 1 — `BarcodeDetector` nativo

La API `BarcodeDetector` del navegador, en Android con Chrome, usa el motor de ML Kit e incluye
`qr_code`, `pdf417`, `data_matrix` y varios 1D. Es rápida y decodifica en tiempo real.

```ts
const soportados = await BarcodeDetector.getSupportedFormats();
```

### Capa 2 — `barcode-detector` (zxing-wasm)

Polyfill de `BarcodeDetector` basado en **ZXing-C++ compilado a WebAssembly**. Es el mismo motor que
usan los demos de lectura de DNI argentino. Se usa cuando el nativo no está disponible o no encuentra
nada, y admite `tryHarder`.

### Capa 3 — Modo foto (alta resolución)

Para el PDF417 grande: se toma una **foto fija** en la resolución máxima de la cámara, se recorta el
área del código y se analiza con **zxing-wasm**. Es mucho más confiable que decodificar frames de
video comprimidos.

Consideraciones:

- Enfocar de cerca y con el código **horizontal**, lo más paralelo al sensor posible.
- Evitar reflejos (el laminado del DNI brilla).
- Buena luz, sin sombras sobre el código.

### Capa 4 — MRZ / OCR

Si hay MRZ (DNI nuevo) y los códigos 2D no se leen, se hace OCR de la zona de lectura mecánica con
**Tesseract.js** y se usa el **font OCR-B** con lista blanca de caracteres. Como la MRZ tiene dígitos
verificadores, se valida y se corrigen lecturas dudosas.

## Modo captura

Herramienta interna para desarrollo y diagnóstico. Muestra el **texto crudo** que devuelve cada
código, sin parsear, con:

- Tipo de código detectado y valor `raw` completo.
- Botón para copiar/exportar el crudo.
- Registro de qué capa lo leyó.

Sirve para:

1. Fijar el formato exacto del **QR del DNI nuevo** (que no está documentado).
2. Diagnosticar DNIs que no se leen.
3. Alimentar los tests del parser con casos reales.

> El Modo captura se construye en la **Fase 0**. Es requisito para dejar el parser 100% exacto.

## Librerías candidatas

| Librería | Rol | Notas |
| --- | --- | --- |
| `barcode-detector` | API `BarcodeDetector` + polyfill | ZXing-wasm por debajo. |
| `zxing-wasm` | Motor de decodificación | PDF417 y QR robustos. |
| `tesseract.js` | OCR de MRZ | Pesado (varios MB); se cachea. |

Decisión final y versiones: ver [convenciones](./11-convenciones-de-codigo.md).

## Rendimiento y batería

- Decodificar sobre un `<canvas>` redimensionado (no el frame completo) para ahorrar batería.
- Alternar: video continuo para QR/códigos fáciles, foto sólo cuando falla.
- Un latido (scan) por segundo cuando el video está activo.

## UX de escaneo

- Marco guía en pantalla con instrucción ("enfocá el código").
- Feedback sonoro/háptico al leer.
- Si en ~5 s no leyó, sugerir **Modo foto** o **carga manual**.
- Nunca bloquear: siempre se puede completar el formulario a mano.

## Limitaciones conocidas

- Navegadores sin soporte de `BarcodeDetector` dependen del polyfill wasm (más lento).
- El PDF417 del DNI viejo puede requerir foto a corta distancia.
- La MRZ del DNI nuevo puede leerse mal por reflejos; el dígito verificador ayuda a detectarlo.
- El código no trae `ñ`/acentos: siempre queda la edición manual como red de seguridad.

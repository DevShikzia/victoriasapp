# 13 — Testing

## Objetivo

Asegurar, sobre todo, dos cosas críticas:

1. El **parser de DNI** funciona con todas las versiones y casos raros.
2. La **sincronización** no pierde ni duplica registros.

## Herramientas

| Área | Herramienta |
| --- | --- |
| Unit / integración (TS) | **Vitest** |
| Frontend Angular | **Vitest** + Angular Testing Utilities |
| API | **Vitest** + Supertest |
| Base de datos de test | `mongodb-memory-server` |
| E2E (opcional) | Playwright |

## Tests del parser (`packages/shared`)

Es el módulo más importante. Se prueban **casos reales** capturados con el Modo captura.

| Caso | Se espera |
| --- | --- |
| PDF417 viejo (16 campos) | DNI, apellido, nombre, nacimiento, sexo, vencimiento |
| PDF417 viejo (17 campos) | Igual, tolerando el campo extra |
| PDF417 intermedio (8 campos) | Apellido, nombre, sexo, DNI, nacimiento |
| PDF417 intermedio (9 campos) | Igual, con CUIL |
| QR nuevo | Datos según formato fijado en Fase 0 |
| MRZ TD1 válida | Datos correctos + dígitos verificadores OK |
| Apellido con `NXX` | Se convierte a `Ñ` |
| `UXX` | Se convierte a `Ü` |
| Payload desconocido | `ok: false`, conserva `raw` |
| Payload vacío | `ok: false`, sin excepción |

Ejemplo:

```ts
import { describe, it, expect } from 'vitest';
import { parseDni } from '../src/dni/parse-dni';

describe('parseDni', () => {
  it('parsea el formato viejo del reverso', () => {
    const raw =
      '00012345678@30123456@A@@PEREZ@JUAN CARLOS@@15/03/1985@M@10/06/2019';
    const result = parseDni(raw);
    expect(result.ok).toBe(true);
    expect(result.data?.numeroDni).toBe('30123456');
    expect(result.data?.apellido).toBe('PEREZ');
    expect(result.data?.fechaNacimiento).toBe('1985-03-15');
  });

  it('convierte NXX en Ñ', () => {
    const result = parseDni('...@NUXXEZ@MARIA@...');
    expect(result.data?.apellido).toBe('NUÑEZ');
  });
});
```

## Tests de la API

- Auth: login correcto/incorrecto, refresh, logout, token vencido, permisos por rol.
- `/sync`: idempotencia (mismo `uuid` dos veces → no duplica), lotes mixtos con errores.
- Validación: body inválido → 400 con `VALIDATION_ERROR`.
- Visitas: crear, listar con filtros, marcar salida.
- Directorio: búsquedas por nombre/lote/patente.

## Tests del frontend

- Componente de formulario: autocompleta al recibir `DniData`.
- Servicio de escaneo: dado un payload, devuelve el `ParseResult` esperado.
- Servicio de sync: encola offline y vacía el outbox al sincronizar.
- Guard de rutas por rol.

## Tests de sincronización (integración)

- Crear 3 visitas offline → sincronizar → existen en Mongo.
- Sincronizar dos veces el mismo lote → sin duplicados.
- Corte de red a mitad → los pendientes quedan y se reintentan.

## Cobertura

- Meta: **≥ 90%** en `packages/shared` (parser) y en `services/` de la API.
- El parser es crítico: cada bug reportado agrega un test de regresión.

## Cómo correr

```bash
npm test                 # todos
npm test -w packages/shared
npm test -w apps/api
npm run test:cov -w packages/shared
```

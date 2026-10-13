# 11 — Convenciones de código

## Regla principal: TypeScript estricto

**Está prohibido `any`.** También se prohíben los casts peligrosos y el tipado laxo. El objetivo es
que todo el proyecto esté tipado de punta a punta (front, back y `shared`).

### Configuración TypeScript

`tsconfig.base.json` (raíz) habilita:

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Reglas de ESLint

`eslint.config.mjs` (flat config) con `typescript-eslint` y **configuración con información de
tipos** (`recommendedTypeChecked`):

- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-unsafe-assignment: error`
- `@typescript-eslint/no-unsafe-member-access: error`
- `@typescript-eslint/no-unsafe-call: error`
- `@typescript-eslint/no-unsafe-return: error`
- `@typescript-eslint/no-unsafe-argument: error`
- `@typescript-eslint/consistent-type-imports: error`
- `@typescript-eslint/no-floating-promises: error`
- `@typescript-eslint/explicit-function-return-type: warn`

### Alternativas a `any`

| En vez de… | Usar… |
| --- | --- |
| `any` | Tipo real, genérico `<T>` o `unknown` |
| `unknown` crudo | Angostar con validación (Zod, type guards) |
| `as` a lo loco | Type guards y funciones de parseo |
| `object` | Interfaz concreta |

En `catch`, usar `unknown` y validar antes de acceder a propiedades.

### Validación en runtime = tipado en compilación

Los datos que vienen de afuera (body, IndexedDB, respuestas de red, payload de un código) se validan
con **Zod**. El tipo de TypeScript se **infiere** del esquema, para no duplicar definiciones:

```ts
export const visitaSchema = z.object({
  uuid: z.string().uuid(),
  dni: z.string().regex(/^\d{7,8}$/),
  // ...
});
export type Visita = z.infer<typeof visitaSchema>;
```

## Estilo

- **Prettier** para formato (2 espacios, comillas simples, punto y coma).
- Nombres: `camelCase` variables/funciones, `PascalCase` tipos/clases, `kebab-case` archivos.
- Preferir `readonly` y funciones puras cuando sea posible.
- Sin `console.log` en código de producción (usar el logger).
- Comments en español; identificadores de código en inglés o español consistente (se elige español
  para el dominio: `visita`, `propietario`, `lote`).

## Estructura de cada app

### `apps/api`

```
src/
├─ config/        # env, constantes
├─ models/        # esquemas Mongoose
├─ schemas/       # Zod (validación)
├─ services/      # lógica de negocio
├─ controllers/   # capa HTTP
├─ routes/        # definición de rutas
├─ middleware/    # auth, errores, rate limit
├─ realtime/      # Socket.IO
├─ utils/
├─ app.ts
└─ server.ts
```

### `packages/shared`

```
src/
├─ types/         # tipos e interfaces del dominio
├─ schemas/       # esquemas Zod compartidos
├─ dni/           # parser de DNI y normalización
└─ index.ts
```

## Commits

Conventional Commits:

```
feat(web): escáner de PDF417 con zxing-wasm
fix(shared): corrige NXX a Ñ en apellidos
docs(api): agrega contrato de /sync
chore(repo): configura eslint flat config
```

Prefijos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `build`.

## Ramas

- `main`: estable.
- `develop`: integración.
- `feat/*`, `fix/*`: trabajo puntual.

## Definition of Done

- [ ] Lint en verde (sin `any`).
- [ ] Compila sin errores (`tsc --noEmit`).
- [ ] Tests pasan.
- [ ] Documentación actualizada si cambia el comportamiento.

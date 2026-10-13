# 09 — Directorio del barrio

El directorio es una pieza central: permite saber **a qué lote va** un visitante y **de quién es un
auto**, incluso sin internet. Los datos se actualizan permanentemente y deben ser fáciles de buscar.

## Jerarquía

```
Barrio
 └─ Lote (nº)
     └─ Propietario (titular, normalmente señor y señora)
         ├─ Vehículo(s)
         └─ Familiar(es) (hijos, etc.)
              └─ Vehículo(s)
```

Un **lote** tiene uno o más **propietarios** (por ejemplo, "Juan Pérez" y "Ana Gómez"). Cada
propietario puede tener **vehículos** y **familiares**, y cada familiar puede tener sus propios
**vehículos**.

## Campos

- **Propietario:** nombre, apellido, teléfono, email, descripción libre.
- **Familiar:** nombre, parentesco, descripción.
- **Vehículo:** patente, marca, modelo, color, descripción, a quién pertenece (propietario o familiar).
- **Lote:** número, calle, notas.

## Búsquedas

| Buscar por | Resultado |
| --- | --- |
| **Nombre** (propietario o familiar) | Lote + vehículos + contacto |
| **Lote** | Titulares + familia + vehículos |
| **Patente** | De quién es, lote, descripción |

La búsqueda es **insensible a acentos y mayúsculas** y tolera errores de tipeo (búsqueda difusa).

## Uso durante un ingreso

1. El guardia escanea el DNI → datos de la persona.
2. Si el visitante **no sabe el lote**, el guardia escribe el **nombre del propietario** → la app trae
   el lote y lo completa.
3. Si viene **en auto**, carga la **patente** → si es un vehículo del barrio, la app indica de quién es.
4. Se guarda la visita con lote y propietario (copiados de forma desnormalizada para que el registro
   histórico no dependa de cambios posteriores en el directorio).

## Alta rápida desde la garita

Si el propietario no existe, el guardia (o el supervisor) puede **cargarlo al vuelo**:
- Nombre, lote, teléfono, patente.
- Queda en el `outbox` y se sincroniza igual que una visita.
- Luego se completa la información (familia, vehículos) desde la administración.

## Actualización permanente

- El directorio se puede editar en cualquier momento (admin/supervisor).
- Los cambios se sincronizan a todos los dispositivos (pull incremental por `updatedAt`).
- Para mantener el histórico correcto, las visitas guardan **copias** de lote y propietario al momento
  del registro.

## Importación inicial

Si el barrio ya tiene la lista en Excel/CSV, se provee un **importador** que crea barrio, lotes,
propietarios, familiares y vehículos. Formato sugerido del CSV:

```csv
lote,propietario,telefono,patente,familiar,parentesco,descripcion
42,Juan Perez,11-5555-5555,AB123CD,,
42,Ana Gomez,11-6666-6666,AC456EF,Maria Perez,hija,
```

Columnas vacías se ignoran. Las patentes se normalizan (mayúsculas, sin espacios).

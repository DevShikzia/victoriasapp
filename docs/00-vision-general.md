# 00 — Visión general

## Contexto

Trabajo en una empresa de seguridad. En el puesto de acceso ("la garita" / "el Pare") los guardias
piden el DNI a las personas que quieren ingresar y registran sus datos. Hoy el escaneo falla en dos
formatos de DNI argentino, por lo que el guardia **anota todo a mano en papel**: nombres, apellidos,
DNI, patente (si vino en auto) y el lote al que se dirige.

Eso genera:

- Pérdida de tiempo en cada ingreso.
- Errores de tipeo (nombres, números de DNI, patentes).
- Información en papel, difícil de consultar, buscar o exportar.

## Objetivo

Construir una aplicación que **lea el DNI con la cámara del celular** (QR, PDF417 y MRZ),
**autocomplete** los datos de la persona y permita completar el resto del registro (patente, lote,
motivo, horarios) en segundos. Debe funcionar **sin internet** y sincronizar a una base central
(MongoDB) cuando haya conexión, para que la computadora de monitoreo vea los ingresos en tiempo real.

## Alcance

### Incluye

- Escaneo de los formatos de DNI argentino que hoy fallan (PDF417 viejo e intermedio, QR nuevo, MRZ).
- Formulario de registro de ingreso y egreso.
- Directorio del barrio: lotes, propietarios, familia y vehículos, con búsqueda por nombre,
  lote o patente.
- Almacenamiento local (offline) en el celular.
- Sincronización con MongoDB y panel en vivo en la computadora.
- Autenticación de guardias con roles.

### No incluye (por ahora)

- Validación biométrica contra RENAPER.
- Huella dactilar o reconocimiento facial.
- Integración con molinetes o barreras físicas.
- Facturación o cobros.

## Usuarios y roles

| Rol | Descripción | Permisos principales |
| --- | --- | --- |
| **Guardia** | Persona en la garita. | Escanear, registrar ingresos/egresos, buscar en el directorio. |
| **Supervisor** | Encargado de turno. | Todo lo del guardia + ver reportes, corregir registros. |
| **Administrador** | Administra el sistema. | ABM de usuarios, barrio, lotes, propietarios y vehículos. |

## Casos de uso principales

1. **Ingreso de visitante:** el guardia escanea el DNI, se autocompletan los datos, carga patente y
   lote, y guarda. Queda con hora de entrada.
2. **Egreso:** busca el registro abierto o vuelve a escanear, y marca la salida.
3. **Búsqueda por propietario:** si el visitante no sabe el lote, el guardia escribe el nombre del
   propietario y la app trae el lote.
4. **Búsqueda por patente:** al ingresar una patente, la app indica si pertenece a un residente.
5. **Funcionamiento sin red:** todo se guarda local y se sincroniza al recuperar conexión.
6. **Monitoreo en vivo:** la computadora ve los ingresos en tiempo real.

## Métricas de éxito

- Reducir el tiempo de registro por visitante a menos de 20 segundos.
- Eliminar la anotación en papel en condiciones normales.
- Sincronizar el 100% de los registros sin pérdidas tras recuperar la conexión.
- 0 errores de tipeo en los campos autocompletados.

## Restricciones

- Debe funcionar **offline-first** (la red en la garita es intermitente).
- Debe correr en el celular como **PWA Angular**.
- El backend es **TypeScript estricto** (ver [convenciones](./11-convenciones-de-codigo.md)).
- La PWA requiere HTTPS para acceder a la cámara.

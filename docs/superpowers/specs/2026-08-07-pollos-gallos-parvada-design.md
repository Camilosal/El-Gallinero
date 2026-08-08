# Pollos, Gallos y Regla de Parvada — Diseño

**Fecha:** 2026-08-07
**Estado:** Aprobado por el usuario

## Objetivo

El gallinero no solo contiene gallinas: también se crían pollos para sacrificio y gallos para reproducción. El sistema debe:

1. Registrar **gallos reproductores** individualmente (tabla nueva `roosters`).
2. Registrar **pollos de engorde por lotes** (tabla nueva `broiler_batches`).
3. Aplicar la **regla de parvada**: mínimo 1 gallo por cada 10 gallinas activas. Los machos sobrantes se destinan a sacrificio.
4. Asignar automáticamente los machos nacidos en incubación y mostrar alertas de balance en el dashboard.

Decisiones tomadas con el usuario:

- Tablas separadas (no extender `hens`).
- Granularidad mixta: gallos individuales, pollos por lotes.
- Regla de gallos: asignación automática al ingresar machos + alertas permanentes.
- Lote listo para sacrificio cuando cumple edad objetivo **o** peso objetivo.
- Los machos ingresan desde incubación (eclosión con sexo) y también manualmente.

## Modelo de datos

### Enums nuevos

```
rooster_status:        activo, enfermo, vendido, faena, muerto
broiler_batch_status:  activo, listo_sacrificio, vendido, faena
```

### Tabla `roosters` (gallos reproductores)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | defaultRandom |
| code | varchar(50) | prefijo `GA-` (ej. GA-001) |
| breed | varchar(100) | |
| birthDate | date | |
| status | rooster_status | default `activo` |
| weight | decimal(6,2) | nullable |
| notes | text | nullable |
| createdAt / updatedAt | timestamp | |

### Tabla `broiler_batches` (lotes de engorde)

| Campo | Tipo | Notas |
|---|---|---|
| id | uuid PK | defaultRandom |
| code | varchar(50) | prefijo `L-` (ej. L-001) |
| breed | varchar(100) | |
| startDate | date | fecha de inicio del lote |
| initialQuantity | integer | cantidad inicial |
| currentQuantity | integer | cantidad viva actual |
| targetWeeks | integer | default 7 |
| targetWeightKg | decimal(6,2) | default 2.5 |
| avgWeightKg | decimal(6,2) | nullable, actualización manual |
| status | broiler_batch_status | default `activo` |
| notes | text | nullable |
| createdAt / updatedAt | timestamp | |

### Cambios a tablas existentes

- `incubation`: agrega `malesHatched` (integer, nullable) y `femalesHatched` (integer, nullable).
- `chicken_sales`: agrega `roosterId` uuid FK→roosters (nullable) y `batchId` uuid FK→broiler_batches (nullable).
- `slaughter`: agrega `roosterId` uuid FK→roosters (nullable) y `batchId` uuid FK→broiler_batches (nullable).

Migración SQL directa (patrón usado en el proyecto para enums/columnas) + cambios en `src/db/schema.ts`.

## Lógica de parvada — `src/lib/flock.ts`

```typescript
export const FLOCK_RULES = { hensPerRooster: 10, defaultTargetWeeks: 7, defaultTargetWeightKg: 2.5 };

requiredRoosters(activeHenCount)   // = Math.ceil(activeHenCount / 10)
assignMales(males, activeRoosters, required)
  // → { toRoosters: max(0, min(males, required - activeRoosters)), toSlaughter: resto }
batchReadiness(batch, today?)
  // ageWeeks >= targetWeeks || (avgWeightKg != null && avgWeightKg >= targetWeightKg)
flockBalance(activeHenCount, activeRoosterCount)
  // → { required, active, deficit, surplus }
```

`ageWeeks` se calcula igual que en `src/lib/lifecycle.ts` (días / 7, redondeado hacia abajo).

## APIs

### `/api/gallos` (nueva)

- GET: lista gallos con edad en semanas; incluye resumen `{ activeCount, requiredRoosters }`.
- POST / PUT: CRUD estándar; código autogenerado `GA-###` si no se envía.
- DELETE: elimina el gallo (sin transacciones; la salida financiera se registra por ventas/sacrificio).

### `/api/lotes-pollos` (nueva)

- GET: lista lotes evaluando `batchReadiness`; si un lote `activo` ya cumple el criterio, se persiste `listo_sacrificio` (lazy-sync, mismo patrón que `/api/gallinas`). Respuesta enriquecida con `ageWeeks` y `readinessReasons` ("Edad objetivo alcanzada (7 sem)" / "Peso objetivo alcanzado (≥ 2.5 kg)").
- POST: crea lote (cantidad inicial = currentQuantity).
- PUT: actualiza campos (incluye avgWeightKg y currentQuantity).
- DELETE: elimina lote.

### `/api/incubacion` (modificación)

En PUT, cuando `isComplete` pasa a true con `malesHatched`/`femalesHatched` > 0:

1. **Hembras**: crea registros en `hens` con código autogenerado (siguiente `G-###`), raza heredada de la madre (`henId` de la incubación) o "Criolla" si no hay madre, birthDate = hoy, status resuelto por el lifecycle existente.
2. **Machos**: aplica `assignMales` (misma raza que las hembras):
   - `toRoosters` → crea gallos `GA-###` (status `activo`).
   - `toSlaughter` → crea un lote nuevo `L-###` con `initialQuantity`/`currentQuantity` = machos a sacrificio, startDate = hoy, raza genérica "Pollo de engorde".
3. `eggsHatched` sigue siendo la suma registrada; no se valida que coincida con machos+hembras (flexibilidad operativa).

### `/api/dashboard` (modificación)

Agrega al payload: `roosters` (activos), `requiredRoosters`, `roosterDeficit`, `readyBatches` (lotes en `listo_sacrificio`).

### `/api/ventas-aves` y `/api/sacrificio` (modificación)

- POST/PUT aceptan `roosterId` o `batchId` opcionales (además de `henId` existente):
  - Con `roosterId`: el gallo pasa a `vendido` (venta) o `faena` (sacrificio).
  - Con `batchId`: descuenta `quantity` de `currentQuantity`; si llega a 0, el lote pasa a `vendido` (venta) o `faena` (sacrificio). Si la cantidad vendida excede `currentQuantity` → error 400.
- DELETE revierte estos efectos (como hoy revierte el estado de la gallina).
- La creación de transacciones financieras vinculadas no cambia (ya existe).
- Los selectores de ave en las páginas de ventas y sacrificio incluyen gallos y lotes.

## Frontend

### Nueva página `/pollos` (menú: "Pollos y Gallos")

- Banner de balance: "Para N gallinas activas se requieren M gallos; hay K" (verde si balanceado, naranja si faltan).
- Pestaña **Gallos**: tabla (código, raza, edad, peso, estado) + formulario alta/edición/eliminar.
- Pestaña **Lotes de engorde**: tabla (código, raza, inicio, cantidad actual/inicial, edad, peso prom., estado) + formulario alta/edición/eliminar. Lotes `listo_sacrificio` resaltados con razón visible.

### Página de incubación

- Al completar una incubación: campos "Machos nacidos" y "Hembras nacidas". Al guardar muestra resumen de la asignación (X gallos nuevos, Y pollos a sacrificio, Z gallinas nuevas).

### Dashboard

- Tarjeta "Gallos" (activos vs requeridos, con déficit) y tarjeta "Lotes listos para sacrificio".

## Pruebas (Vitest, `tests/flows.test.ts`)

1. `flock.ts` unitarias: `requiredRoosters`, `assignMales` (casos límite: 0 gallinas, machos < déficit, machos > déficit), `batchReadiness` por edad y por peso.
2. Flujo incubación: completar con 3 hembras + 5 machos y sin gallos suficientes → crea gallinas, gallos hasta cubrir y lote con el resto.
3. Flujo lote: lote listo por edad aparece `listo_sacrificio` en GET; sacrificio con `batchId` descuenta cantidad y a 0 marca `faena`; DELETE del sacrificio revierte.
4. Limpieza de datos de prueba vía `cleanupData` del helper existente.

## Seed

- 3 gallos (`GA-001` a `GA-003`) — con ~30 gallinas activas el requerido es 3, balance exacto.
- 1 lote `L-001`: 20 pollos Cobb, iniciados hace 35 días (5 semanas), avgWeightKg 2.1, objetivos 7 sem / 2.5 kg → aún `activo` (cerca de listo).

## Fuera de alcance

- Consumo de alimento por lote/gallo (los programas de alimentación siguen por etapa de gallinas).
- Genética/reproducción avanzada (líneas de sangre, asignación gallo↔gallina específica).
- Historial de pesos automático (el peso promedio del lote es manual).

# Módulo de Producción de Gallinaza — Diseño

**Fecha:** 2026-08-07
**Estado:** Aprobado

## Resumen

Nuevo módulo para gestionar la producción de gallinaza (abono) del gallinero: estimación diaria basada en el número de aves y su etapa, inventario con acumulación automática y ajustes manuales, y ventas integradas con el módulo de finanzas. El índice/factor de producción (kg/ave/día) es una variable de entrada editable por el usuario.

## Decisiones tomadas (brainstorming)

| Tema | Decisión |
|------|----------|
| Alcance | Estimación + inventario + ventas con integración a finanzas |
| Aves incluidas | Gallinas (por etapa) + gallos activos + lotes de engorde, cada grupo con su propio factor |
| Inventario | Acumulación automática con la estimación + ajustes manuales (±kg) |
| Ventas | Descuentan inventario y crean transacción de ingreso en finanzas automáticamente |
| Unidades | kg como base + presentaciones opcionales (bulto, costal) en la venta |
| Factores | Tabla dedicada `manureFactors` (enfoque A), editables desde la página del módulo |

## Modelo de datos (4 tablas nuevas en `src/db/schema.ts`)

### `manureFactors` — factores de producción editables

```
id              uuid PK
stageCatalogoId uuid nullable → catalogos.id (onDelete: cascade)  -- solo etapas de gallinas
birdGroup       varchar(20) notNull   -- 'etapa' | 'gallo' | 'lote'
kgPerBirdPerDay decimal(6,3) notNull  -- kg de gallinaza por ave por día
createdAt / updatedAt
```

- Para gallinas: una fila por etapa de crecimiento (`birdGroup = 'etapa'`, `stageCatalogoId` apunta al catálogo `etapa_crecimiento`).
- Para gallos: una fila con `birdGroup = 'gallo'`, `stageCatalogoId = null`.
- Para lotes de engorde: una fila con `birdGroup = 'lote'`, `stageCatalogoId = null`.
- Índice único en `(stageCatalogo_id, bird_group)` para evitar duplicados.

Valores semilla por defecto (editables):

| Grupo | kg/ave/día |
|-------|-----------|
| Pollito | 0.05 |
| Juvenil | 0.08 |
| Pre-postura | 0.11 |
| Postura | 0.13 |
| Gallo | 0.15 |
| Pollo de engorde (lote) | 0.10 |

### `manureInventory` — stock (fila única)

```
id                   uuid PK
currentStockKg       decimal(12,2) default 0 notNull
lastAccumulatedDate  date notNull          -- última fecha en que se acumuló producción
updatedAt            timestamp defaultNow notNull
```

### `manureSales` — ventas de gallinaza

```
id           uuid PK
date         date notNull
quantityKg   decimal(10,2) notNull
pricePerKg   decimal(10,2) notNull
totalAmount  decimal(12,2) notNull
presentation varchar(100)     -- opcional: "Bulto 25 kg", "Costal 50 kg", "Granel"
buyer        varchar(200)     -- opcional
notes        text
createdAt    timestamp defaultNow notNull
```

### `manureAdjustments` — ajustes manuales del stock

```
id       uuid PK
date     date notNull
deltaKg  decimal(10,2) notNull   -- positivo = agrega, negativo = retira
reason   text notNull
createdAt timestamp defaultNow notNull
```

## Acumulación automática (lazy-sync)

El `GET /api/gallinaza` sincroniza el inventario antes de responder (mismo patrón lazy que usa la prontitud de lotes de engorde — sin cron jobs):

1. Calcular `estimatedKgPerDay` actual (ver abajo).
2. `dias = fechaHoy − lastAccumulatedDate` (0 o más; nunca negativo).
3. Si `dias > 0`: `currentStockKg += dias × estimatedKgPerDay`, `lastAccumulatedDate = hoy`.

## Lógica de estimación (`src/lib/manure.ts`)

```typescript
export interface BirdGroupCount {
  key: string;          // stageCatalogoId o 'gallo' o 'lote'
  label: string;        // nombre de la etapa / "Gallos" / "Lotes de engorde"
  count: number;        // número de aves
  kgPerBirdPerDay: number;
}

/** Producción estimada kg/día de un grupo */
export function estimatedKgPerDay(group: BirdGroupCount): number;

/** Producción total kg/día (suma de grupos), redondeada a 2 decimales */
export function totalEstimatedKgPerDay(groups: BirdGroupCount[]): number;
```

Cómputo de aves por grupo (igual que el dashboard):
- **Gallinas por etapa**: estados contables = `isAvailableForExit` (activa, empollando, recomendada_sacrificio), clasificadas por edad en semanas usando `stageForAge`.
- **Gallos**: `roosters.status = 'activo'`.
- **Lotes**: suma de `broilerBatches.currentQuantity` donde `status in ('activo','listo_sacrificio')`.
- Si un grupo no tiene factor definido, su aporte es 0 (no rompe la estimación).

## API `/api/gallinaza`

### GET

Tras el lazy-sync, responde:

```json
{
  "estimation": {
    "groups": [{ "key": "...", "label": "Postura", "count": 12, "kgPerBirdPerDay": 0.13, "kgPerDay": 1.56 }],
    "totalKgPerDay": 3.2
  },
  "inventory": { "currentStockKg": 154.5, "lastAccumulatedDate": "2026-08-07" },
  "sales": [ ...manureSales desc... ],
  "adjustments": [ ...manureAdjustments desc... ]
}
```

### POST — `body.action`

| action | body | comportamiento |
|--------|------|----------------|
| `factor` | `{ id, kgPerBirdPerDay }` | Actualiza el factor indicado. Valida `kgPerBirdPerDay >= 0`. |
| `sale` | `{ date, quantityKg, pricePerKg, presentation?, buyer?, notes? }` | Valida stock suficiente (`400` si no). Inserta venta, descuenta stock y crea transacción de ingreso en finanzas: categoría **"Venta de abono/gallinaza"**, `unit: "kg"`, `quantity = quantityKg`, `unitPrice = pricePerKg`, `sourceType = "gallinaza"`, `sourceId = venta.id`. |
| `adjust` | `{ date, deltaKg, reason }` | Valida que el stock resultante no quede negativo (`400`). Inserta ajuste y suma `deltaKg` al stock. |

### DELETE — `?saleId=` o `?adjustId=`

- **saleId**: repone `quantityKg` al stock y elimina la transacción financiera vinculada (`sourceType = 'gallinaza'` y `sourceId = saleId`), además de la venta.
- **adjustId**: resta `deltaKg` del stock (con `greatest(0, ...)` de protección) y elimina el ajuste.

## UI: página `/gallinaza` + sidebar

Enlace nuevo en `Sidebar.tsx`: **🌱 Gallinaza** (sección Producción, junto a Huevos/Incubación).

### Secciones de la página

1. **StatCards**:
   - 🌱 Estimación diaria: `totalKgPerDay` kg/día
   - 📦 Stock disponible: `currentStockKg` kg
   - 💰 Ingresos gallinaza (30 días): suma de ventas del período
2. **Factores de producción** — tabla editable inline: una fila por grupo (cada etapa de gallinas con su conteo actual, Gallos, Lotes de engorde) con input numérico del factor kg/ave/día y botón guardar por fila. Al guardar: `POST action=factor` y recarga. Debajo de cada fila se muestra el aporte calculado (aves × factor).
3. **Ventas** — tabla (Fecha, Cantidad kg, Precio/kg, Presentación, Comprador, Total, acciones) + modal de nueva venta: fecha, cantidad kg, precio/kg, presentación (texto libre con sugerencias "Bulto 25 kg" / "Costal 50 kg" / "Granel"), comprador (datalist catálogo `comprador`), notas. Total calculado en vivo. Validación de stock antes de enviar.
4. **Ajustes** — tabla (Fecha, Δ kg, Motivo, acciones) + modal: fecha, deltaKg (número con signo), motivo obligatorio.
5. **Banner comparativo** — tarjeta que muestra la estimación mensual (`totalKgPerDay × 30`) vs los ajustes/retiros reales registrados, para evidenciar desviaciones.

## Dashboard

Nueva tarjeta secundaria en `src/app/(app)/page.tsx`:

```
🌱 {currentStockKg} kg  —  Gallinaza (+{totalKgPerDay} kg/día)
```

El API de dashboard añade `manure: { currentStockKg, totalKgPerDay }` reutilizando la misma lógica de `lib/manure.ts` (sin lazy-sync para no duplicar escrituras; solo lectura de stock y estimación).

## Finanzas

- La categoría **"Venta de abono/gallinaza"** ya existe en los ingresos; no se modifica el catálogo.
- Las transacciones vinculadas usan `sourceType = "gallinaza"`; el borrado en cascada desde el módulo mantiene la consistencia.
- No se soporta edición de ventas desde finanzas (igual que ventas de huevos/aves: se editan desde su módulo de origen).

## Tests

`src/lib/__tests__/manure.test.ts` (vitest):
- `estimatedKgPerDay`: aves × factor con redondeo a 2 decimales.
- `totalEstimatedKgPerDay`: suma de grupos; grupo sin factor aporta 0; lista vacía = 0.
- Cálculo de días de acumulación (función pura `daysSince(dateStr, today)` si se extrae).

## Seed (`src/db/seed.ts`)

- Limpiar las 4 tablas nuevas.
- Insertar los 6 factores de la tabla de arriba (buscando los `stageCatalogoId` reales del catálogo `etapa_crecimiento`).
- Insertar la fila única de `manureInventory` con `currentStockKg = 120` y `lastAccumulatedDate = hoy`.
- Insertar una venta de ejemplo: 25 kg × $800/kg = $20,000, presentación "Bulto 25 kg", comprador "Finca La Esperanza", junto con su transacción de ingreso vinculada en finanzas.
- Insertar un ajuste de ejemplo (+5 kg, "Medición real de la pila de compostaje").

## Verificación final

- `npx tsc --noEmit` sin errores.
- `npx vitest run` — todos los tests pasando (34 existentes + nuevos).
- `npm run db:push` + `npm run db:seed` exitosos.
- Verificación HTTP de punta a punta: GET acumula stock, POST sale descuenta y crea transacción, DELETE revierte.

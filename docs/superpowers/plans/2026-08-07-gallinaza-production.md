# Módulo de Producción de Gallinaza — Plan de Implementación

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo de gallinaza con estimación por aves/etapa (factor editable), inventario con acumulación automática + ajustes, y ventas integradas a finanzas.

**Architecture:** Spec en `docs/superpowers/specs/2026-08-07-gallinaza-production-design.md`. 4 tablas nuevas (manureFactors, manureInventory, manureSales, manureAdjustments), lógica pura en `src/lib/manure.ts`, API única `/api/gallinaza` con acciones por POST, lazy-sync de acumulación en GET.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM + PostgreSQL, Vitest (`npx vitest run`, tests en `tests/`), tsx para scripts.

---

### Task 1: Schema — 4 tablas nuevas

**Files:**
- Modify: `src/db/schema.ts`

- [ ] **Step 1: Añadir las tablas al final de `schema.ts`**

```typescript
// ─── Gallinaza: factores de producción ───
export const manureFactors = pgTable("manure_factors", {
  id: uuid("id").defaultRandom().primaryKey(),
  stageCatalogoId: uuid("stage_catalogo_id").references(() => catalogos.id, { onDelete: "cascade" }),
  birdGroup: varchar("bird_group", { length: 20 }).notNull(), // 'etapa' | 'gallo' | 'lote'
  kgPerBirdPerDay: decimal("kg_per_bird_per_day", { precision: 6, scale: 3 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("manure_factor_stage_group_idx").on(t.stageCatalogoId, t.birdGroup),
]);

// ─── Gallinaza: inventario (fila única) ───
export const manureInventory = pgTable("manure_inventory", {
  id: uuid("id").defaultRandom().primaryKey(),
  currentStockKg: decimal("current_stock_kg", { precision: 12, scale: 2 }).default("0").notNull(),
  lastAccumulatedDate: date("last_accumulated_date").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ─── Gallinaza: ventas ───
export const manureSales = pgTable("manure_sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  quantityKg: decimal("quantity_kg", { precision: 10, scale: 2 }).notNull(),
  pricePerKg: decimal("price_per_kg", { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  presentation: varchar("presentation", { length: 100 }),
  buyer: varchar("buyer", { length: 200 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Gallinaza: ajustes manuales ───
export const manureAdjustments = pgTable("manure_adjustments", {
  id: uuid("id").defaultRandom().primaryKey(),
  date: date("date").notNull(),
  deltaKg: decimal("delta_kg", { precision: 10, scale: 2 }).notNull(), // + agrega, - retira
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 2: Empujar el schema a la BD**

Run: `npm run db:push`
Expected: `Your database is now up to date!`

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 2: Lógica de estimación (TDD)

**Files:**
- Create: `src/lib/manure.ts`
- Test: `tests/manure.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

```typescript
// tests/manure.test.ts
import { describe, it, expect } from "vitest";
import { estimatedKgPerDay, totalEstimatedKgPerDay, daysSince } from "@/lib/manure";

describe("manure estimation", () => {
  it("estimatedKgPerDay multiplica aves × factor con 2 decimales", () => {
    expect(estimatedKgPerDay({ key: "x", label: "Postura", count: 12, kgPerBirdPerDay: 0.13 })).toBe(1.56);
  });

  it("estimatedKgPerDay con factor 0 aporta 0", () => {
    expect(estimatedKgPerDay({ key: "x", label: "Gallos", count: 3, kgPerBirdPerDay: 0 })).toBe(0);
  });

  it("totalEstimatedKgPerDay suma todos los grupos", () => {
    const groups = [
      { key: "a", label: "Postura", count: 10, kgPerBirdPerDay: 0.13 },
      { key: "b", label: "Gallos", count: 3, kgPerBirdPerDay: 0.15 },
    ];
    expect(totalEstimatedKgPerDay(groups)).toBe(1.75);
  });

  it("totalEstimatedKgPerDay lista vacía = 0", () => {
    expect(totalEstimatedKgPerDay([])).toBe(0);
  });

  it("daysSince calcula días entre fechas, nunca negativo", () => {
    expect(daysSince("2026-08-04", new Date("2026-08-07T12:00:00"))).toBe(3);
    expect(daysSince("2026-08-07", new Date("2026-08-07T12:00:00"))).toBe(0);
    expect(daysSince("2026-08-10", new Date("2026-08-07T12:00:00"))).toBe(0);
  });
});
```

- [ ] **Step 2: Verificar que falla**

Run: `npx vitest run tests/manure.test.ts`
Expected: FAIL — no se puede importar `@/lib/manure`.

- [ ] **Step 3: Implementar `src/lib/manure.ts`**

```typescript
export interface BirdGroupCount {
  key: string;          // stageCatalogoId o 'gallo' o 'lote'
  label: string;        // nombre de la etapa / "Gallos" / "Lotes de engorde"
  count: number;
  kgPerBirdPerDay: number;
}

/** Producción estimada kg/día de un grupo (2 decimales) */
export function estimatedKgPerDay(group: BirdGroupCount): number {
  return Math.round(group.count * group.kgPerBirdPerDay * 100) / 100;
}

/** Producción total kg/día de todos los grupos (2 decimales) */
export function totalEstimatedKgPerDay(groups: BirdGroupCount[]): number {
  const total = groups.reduce((sum, g) => sum + g.count * g.kgPerBirdPerDay, 0);
  return Math.round(total * 100) / 100;
}

/** Días transcurridos desde dateStr hasta today; nunca negativo */
export function daysSince(dateStr: string, today: Date = new Date()): number {
  const from = new Date(dateStr + "T12:00:00");
  const to = new Date(today.toISOString().split("T")[0] + "T12:00:00");
  const diff = Math.floor((to.getTime() - from.getTime()) / 86400000);
  return Math.max(0, diff);
}
```

- [ ] **Step 4: Verificar que pasa**

Run: `npx vitest run tests/manure.test.ts`
Expected: 5 tests PASS.

---

### Task 3: API `/api/gallinaza`

**Files:**
- Create: `src/app/api/gallinaza/route.ts`

- [ ] **Step 1: Implementar la ruta**

GET: lazy-sync del inventario (acumula `daysSince(lastAccumulatedDate) × totalKgPerDay`), devuelve `estimation` (grupos: etapas de gallinas con conteo por `stageForAge` sobre `isAvailableForExit`, gallos activos, lotes activos/listos), `inventory`, `sales` desc, `adjustments` desc.

POST con `body.action`:
- `factor`: `{ id, kgPerBirdPerDay }` → update de `manureFactors` (validar `>= 0`, 400 si no).
- `sale`: `{ date, quantityKg, pricePerKg, presentation?, buyer?, notes? }` → validar stock suficiente (400), insertar venta con `totalAmount = quantityKg × pricePerKg`, descontar stock, e insertar transacción ingreso `{ category: "Venta de abono/gallinaza", unit: "kg", quantity, unitPrice, amount: totalAmount, sourceType: "gallinaza", sourceId: venta.id }`; después actualizar la venta con el `sourceId` no aplica — el vínculo vive en la transacción.
- `adjust`: `{ date, deltaKg, reason }` → validar stock resultante `>= 0` (400), insertar ajuste y sumar delta.

DELETE:
- `?saleId=` → reponer `quantityKg`, eliminar transacción con `sourceType='gallinaza'` y `sourceId=saleId`, eliminar venta.
- `?adjustId=` → restar delta con `greatest(0, ...)`, eliminar ajuste.

Usar `db.transaction` para `sale` y `adjust` (patrón de `/api/finanzas`). Incluir `export const dynamic = "force-dynamic";` y manejo de errores con 500 (patrón del resto de rutas).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 4: Tests de flujo de la API

**Files:**
- Test: `tests/flows.test.ts` (añadir bloque)

- [ ] **Step 1: Añadir bloque de tests al final de `flows.test.ts`**

Tests (limpieza manual al final del bloque con DELETE de la propia API):
1. GET `/api/gallinaza` devuelve `estimation.totalKgPerDay > 0` con datos seed y `inventory.currentStockKg >= 0`.
2. POST `action=adjust` con `deltaKg: +10` aumenta el stock en 10 (GET antes y después).
3. POST `action=sale` con cantidad pequeña (1 kg) descuenta stock y crea transacción de ingreso en `transactions` (verificar con select por `sourceType='gallinaza'`); luego DELETE con `saleId` repone el stock y elimina la transacción.
4. POST `action=sale` con cantidad mayor al stock → 400.
5. POST `action=factor` actualiza `kgPerBirdPerDay` (restaurar valor original al final).

- [ ] **Step 2: Ejecutar**

Run: `npx vitest run`
Expected: todos los tests pasando (34 existentes + manure + nuevos flujos).

---

### Task 5: Página `/gallinaza` + Sidebar

**Files:**
- Create: `src/app/(app)/gallinaza/page.tsx`
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Crear la página**

Estructura (patrón de `sacrificio/page.tsx` y `pollos/page.tsx`):
- Interfaces: `EstimationGroup { key, label, count, kgPerBirdPerDay, kgPerDay }`, `ManureSale`, `ManureAdjustment`, `ManureData`.
- `load()`: `apiFetch("/api/gallinaza")`.
- StatCards: 🌱 Estimación diaria (`totalKgPerDay` kg/día), 📦 Stock disponible (`currentStockKg` kg), 💰 Ingresos 30 días (suma `sales` con fecha >= hoy-30d).
- Card "Factores de producción": tabla Grupo | Aves | Factor kg/ave/día (input numérico local por fila, estado `factorEdits: Record<string,string>`) | Aporte kg/día | botón Guardar (POST `action=factor` con el id del factor — incluir el `factorId` en cada grupo devuelto por la API).
- Card "Ventas": tabla Fecha | kg | $/kg | Presentación | Comprador | Total | Eliminar; botón "+ Registrar Venta" abre modal: fecha, cantidad kg, precio/kg, presentación (texto libre con datalist: "Bulto 25 kg", "Costal 50 kg", "Granel"), comprador (datalist catálogo `comprador` vía `useCatalog`), notas; total en vivo `quantityKg × pricePerKg`; validar `quantityKg <= inventory.currentStockKg` en cliente con mensaje de error.
- Card "Ajustes de inventario": tabla Fecha | Δ kg (verde/rojo por signo) | Motivo | Eliminar; botón "+ Ajuste" abre modal: fecha, deltaKg (con signo), motivo requerido.
- Banner estimado vs real: estimación mensual (`totalKgPerDay × 30`) vs suma de ajustes positivos del período; texto informativo.
- Tras cada POST/DELETE exitoso: `load()`.

- [ ] **Step 2: Enlace en Sidebar**

En `menuItems` de `Sidebar.tsx`, después de `/incubacion`:

```typescript
  { href: "/gallinaza", label: "Gallinaza", icon: "🌱" },
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

---

### Task 6: Tarjeta en el Dashboard

**Files:**
- Modify: `src/app/api/dashboard/route.ts`
- Modify: `src/app/(app)/page.tsx`

- [ ] **Step 1: API — añadir `manure` al payload**

En el GET de dashboard: leer fila de `manureInventory`, factores y conteos de aves reutilizando la misma agregación que `/api/gallinaza` (sin escribir/accumular): `manure: { currentStockKg, totalKgPerDay }`. Importar `totalEstimatedKgPerDay` de `@/lib/manure`.

- [ ] **Step 2: UI — tarjeta secundaria**

En la fila de tarjetas secundarias de `page.tsx`, añadir:

```tsx
<Card className="text-center">
  <p className="text-2xl">🌱</p>
  <p className="text-lg font-bold mt-1">{data.manure.currentStockKg} kg</p>
  <p className="text-xs text-slate-500">Gallinaza (+{data.manure.totalKgPerDay} kg/día)</p>
</Card>
```

Añadir `manure: { currentStockKg: number; totalKgPerDay: number }` a la interfaz `DashboardData`.

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: sin errores, tests pasando (incluye el test existente de dashboard GET).

---

### Task 7: Seed

**Files:**
- Modify: `src/db/seed.ts`

- [ ] **Step 1: Añadir al seed**

- Imports: `manureFactors, manureInventory, manureSales, manureAdjustments`.
- Deletes al inicio (antes de `catalogos`): `manureSales`, `manureAdjustments`, `manureFactors`, `manureInventory`.
- Tras insertar `catalogos`: buscar los ids de las 4 etapas `etapa_crecimiento` e insertar factores: Pollito 0.05, Juvenil 0.08, Pre-postura 0.11, Postura 0.13, más filas `gallo` 0.15 y `lote` 0.10 (stageCatalogoId null).
- Insertar fila única de `manureInventory`: `currentStockKg: "120"`, `lastAccumulatedDate: hoy`.
- Insertar venta de ejemplo: 25 kg × $800 = $20,000, presentación "Bulto 25 kg", comprador "Finca La Esperanza", fecha hace 3 días; y su transacción de ingreso vinculada (`category: "Venta de abono/gallinaza"`, `unit: "kg"`, `sourceType: "gallinaza"`, `sourceId: venta.id`).
- Insertar ajuste de ejemplo: `deltaKg: "5"`, `reason: "Medición real de la pila de compostaje"`, fecha hace 2 días.

- [ ] **Step 2: Ejecutar seed**

Run: `npm run db:seed`
Expected: éxito sin errores.

---

### Task 8: Verificación final de punta a punta

- [ ] **Step 1: Lint + typecheck + tests**

Run: `npx eslint . && npx tsc --noEmit && npx vitest run`
Expected: todo limpio.

- [ ] **Step 2: Verificación HTTP**

Con curl contra el servidor dev (login por cookie `galli_session`):
1. GET `/api/gallinaza` → `estimation.groups` con conteos, `inventory.currentStockKg` acumulado.
2. POST `action=sale` (1 kg × 800) → 201; GET de nuevo → stock reducido en 1 y venta listada; verificar transacción en `/api/finanzas?period=30` (categoría "Venta de abono/gallinaza").
3. DELETE `?saleId=...` → stock repuesto y transacción eliminada.

- [ ] **Step 3: Confirmar en UI**

Cargar `/gallinaza` en el navegador (o verificar vía GET que la página compila en dev): enlaces del sidebar, statcards y tablas renderizan.

---

## Notas para el implementador

- Los tests viven en `tests/` (config vitest: `include: ["tests/**/*.test.ts"]`), NO en `src/lib/__tests__`.
- Los route handlers se testean directamente importándolos con `mockRequest`/`parseJson` de `tests/helpers.ts` (patrón `flows.test.ts`).
- Fechas en formato `YYYY-MM-DD` (columnas `date`); parsear con `new Date(d + "T12:00:00")`.
- Decimales de drizzle llegan como string: usar `Number(...)` antes de operar.
- Categoría financiera exacta existente: `"Venta de abono/gallinaza"`.
- El lazy-sync solo ocurre en el GET de `/api/gallinaza`; el dashboard solo lee.

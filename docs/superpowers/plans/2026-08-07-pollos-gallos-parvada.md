# Pollos, Gallos y Regla de Parvada — Plan de Implementación

> **Para agentes:** Ejecutar tarea por tarea con TDD. Pasos con checkbox (`- [ ]`).

**Goal:** Modelar gallos reproductores (individuales) y pollos de engorde (por lotes), aplicar la regla de 1 gallo por cada 10 gallinas con asignación automática de machos nacidos y alertas de balance.

**Architecture:** Dos tablas nuevas (`roosters`, `broiler_batches`) + lógica pura en `src/lib/flock.ts`. APIs nuevas `/api/gallos` y `/api/lotes-pollos` con lazy-sync. Incubación asigna machos/hembras al completar eclosión. Ventas/sacrificio se vinculan a gallos/lotes.

**Tech Stack:** Next.js App Router, Drizzle ORM + PostgreSQL, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-07-pollos-gallos-parvada-design.md`

---

### Task 1: Schema + migración

**Files:**
- Modify: `src/db/schema.ts`
- Ejecutar: `npm run db:push`

- [ ] **Paso 1:** Agregar enums y tablas en `schema.ts`:

```typescript
export const roosterStatusEnum = pgEnum("rooster_status", [
  "activo", "enfermo", "vendido", "faena", "muerto",
]);

export const broilerBatchStatusEnum = pgEnum("broiler_batch_status", [
  "activo", "listo_sacrificio", "vendido", "faena",
]);

export const roosters = pgTable("roosters", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  breed: varchar("breed", { length: 100 }).notNull(),
  birthDate: date("birth_date").notNull(),
  status: roosterStatusEnum("status").default("activo").notNull(),
  weight: decimal("weight", { precision: 6, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const broilerBatches = pgTable("broiler_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 50 }).notNull(),
  breed: varchar("breed", { length: 100 }).notNull(),
  startDate: date("start_date").notNull(),
  initialQuantity: integer("initial_quantity").notNull(),
  currentQuantity: integer("current_quantity").notNull(),
  targetWeeks: integer("target_weeks").default(7).notNull(),
  targetWeightKg: decimal("target_weight_kg", { precision: 6, scale: 2 }).default("2.5").notNull(),
  avgWeightKg: decimal("avg_weight_kg", { precision: 6, scale: 2 }),
  status: broilerBatchStatusEnum("status").default("activo").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

- [ ] **Paso 2:** Agregar columnas nuevas:
  - `incubation`: `malesHatched: integer("males_hatched")`, `femalesHatched: integer("females_hatched")` (ambos nullable).
  - `chickenSales`: `roosterId: uuid("rooster_id").references(() => roosters.id)`, `batchId: uuid("batch_id").references(() => broilerBatches.id)`.
  - `slaughter`: mismas dos columnas.

- [ ] **Paso 3:** `npm run db:push` (si falla creando enums, aplicar SQL manual con tsx: `CREATE TYPE ...; ALTER TABLE ...`).

### Task 2: Lógica de parvada (TDD)

**Files:**
- Create: `src/lib/flock.ts`
- Test: `tests/flows.test.ts` (describe "Flock Rules")

- [ ] **Paso 1:** Tests unitarios:

```typescript
import { requiredRoosters, assignMales, batchReadiness, flockBalance } from "@/lib/flock";

// requiredRoosters(30)=3, requiredRoosters(31)=4, requiredRoosters(0)=0
// assignMales(5, 1, 3) → { toRoosters: 2, toSlaughter: 3 }
// assignMales(1, 0, 3) → { toRoosters: 1, toSlaughter: 0 }
// assignMales(2, 3, 3) → { toRoosters: 0, toSlaughter: 2 }
// batchReadiness por edad: startDate 50 días atrás, targetWeeks 7 → ready:true
// batchReadiness por peso: startDate reciente, avgWeightKg 2.6, target 2.5 → ready:true
// batchReadiness no listo: 3 semanas y 1.5 kg → ready:false
// flockBalance(30, 2) → { required: 3, active: 2, deficit: 1, surplus: 0 }
```

- [ ] **Paso 2:** Implementar `src/lib/flock.ts`:

```typescript
export const FLOCK_RULES = { hensPerRooster: 10, defaultTargetWeeks: 7, defaultTargetWeightKg: 2.5 };

export function requiredRoosters(activeHenCount: number): number {
  return Math.ceil(activeHenCount / FLOCK_RULES.hensPerRooster);
}

export function assignMales(males: number, activeRoosters: number, required: number) {
  const toRoosters = Math.max(0, Math.min(males, required - activeRoosters));
  return { toRoosters, toSlaughter: males - toRoosters };
}

export interface BatchLike {
  startDate: string;
  targetWeeks: number;
  targetWeightKg: string | number;
  avgWeightKg: string | number | null;
}

export function batchReadiness(batch: BatchLike, today: Date = new Date()) {
  const start = new Date(batch.startDate + "T12:00:00");
  const ageWeeks = Math.floor((today.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const reasons: string[] = [];
  if (ageWeeks >= batch.targetWeeks) reasons.push(`Edad objetivo alcanzada (${batch.targetWeeks} sem)`);
  const w = batch.avgWeightKg != null ? Number(batch.avgWeightKg) : null;
  if (w != null && w >= Number(batch.targetWeightKg)) reasons.push(`Peso objetivo alcanzado (≥ ${Number(batch.targetWeightKg)} kg)`);
  return { ready: reasons.length > 0, ageWeeks, reasons };
}

export function flockBalance(activeHenCount: number, activeRoosterCount: number) {
  const required = requiredRoosters(activeHenCount);
  return { required, active: activeRoosterCount, deficit: Math.max(0, required - activeRoosterCount), surplus: Math.max(0, activeRoosterCount - required) };
}
```

- [ ] **Paso 3:** `npx vitest run` → tests nuevos pasan.

### Task 3: API `/api/gallos`

**Files:**
- Create: `src/app/api/gallos/route.ts`

- [ ] CRUD estándar (patrón `/api/gallinas`):
  - GET: lista ordenada por `createdAt` desc + enriquece con `ageWeeks` (usar `ageInWeeks` de lifecycle) + incluye al final del JSON: no — devuelve `{ roosters, balance }` donde balance = `flockBalance(gallinas activas, gallos activos)`. Contar gallinas activas con `eq(hens.status, "activa")` (incluir también `recomendada_sacrificio` como "en el gallinero" — usar `isAvailableForExit`).
  - POST: valida `breed`, `birthDate`. Código autogenerado `GA-###` si no se envía (contar existentes + 1, con padding 3).
  - PUT: actualiza por id. DELETE: elimina.

### Task 4: API `/api/lotes-pollos`

**Files:**
- Create: `src/app/api/lotes-pollos/route.ts`

- [ ] GET: lazy-sync — para cada lote `activo`, `batchReadiness`; si `ready`, persistir `listo_sacrificio` (batch `inArray`). Enriquecer con `ageWeeks`, `readinessReasons`.
- [ ] POST: `initialQuantity` = `currentQuantity`; código autogenerado `L-###`; defaults targetWeeks 7 / targetWeightKg 2.5.
- [ ] PUT: actualiza campos (permite corregir estado manualmente a `activo`). Si PUT cambia datos que invalidan la condición y el estado era `listo_sacrificio`, reevaluar y devolver a `activo` si ya no cumple.
- [ ] DELETE: elimina.

### Task 5: Incubación con asignación automática

**Files:**
- Modify: `src/app/api/incubacion/route.ts`
- Test: `tests/flows.test.ts` (describe "Incubación → asignación de machos")

- [ ] PUT: aceptar `malesHatched`, `femalesHatched`. Cuando `isComplete === true`:
  1. Raza base: leer la madre (`updated.henId`) → su `breed`; si no hay madre, "Criolla".
  2. Hembras: insertar en `hens` con código `G-###` autogenerado (máx número existente + 1..N), birthDate = hoy, status `activa` (pollito por edad — `evaluateLifecycle` lo resolverá en el próximo GET).
  3. Machos: contar gallinas disponibles (`isAvailableForExit`) y gallos `activo`; `assignMales` → crear `toRoosters` gallos `GA-###` (birthDate hoy) y si `toSlaughter > 0` crear lote `L-###` con `initialQuantity`/`currentQuantity` = toSlaughter, startDate hoy, breed "Pollo de engorde".
  4. Respuesta JSON incluye `assignment: { hensCreated, roostersCreated, batchCode | null }`.
- [ ] GET: agregar `malesHatched`, `femalesHatched` al select.
- [ ] Test: crear incubación (POST con huevosSet 10), completar con 3 hembras + 5 machos, verificar creación correcta según gallos existentes; limpiar (incubation, hens nuevas, roosters, batch).

### Task 6: Ventas de aves y sacrificio con gallos/lotes

**Files:**
- Modify: `src/app/api/ventas-aves/route.ts`
- Modify: `src/app/api/sacrificio/route.ts`
- Test: `tests/flows.test.ts` (describe "Lotes en venta/sacrificio")

- [ ] **ventas-aves**: aceptar `roosterId`, `batchId`:
  - POST: con `roosterId` validar estado `activo`/`enfermo` (disponible) y marcar `vendido`. Con `batchId` validar `qty <= currentQuantity` (si no 400 "Stock insuficiente del lote"), descontar; si queda 0 → status `vendido`. Guardar ambos en el registro.
  - PUT: restaurar/re-aplicar efectos (gallo → `activo`; lote: devolver cantidad antigua, descontar nueva).
  - DELETE: restaurar gallo a `activo` y devolver cantidad al lote (si estaba 0 → `activo`).
- [ ] **sacrificio**: relajar la validación "henId requerido" → requerir `henId` **o** `roosterId` **o** `batchId`. Mismos efectos con estado `faena`. Mantener transacción financiera existente.
- [ ] Test: crear lote con 5, sacrificar 5 con batchId → lote `faena` y cantidad 0; DELETE revierte. Limpiar.

### Task 7: Dashboard API + tarjetas

**Files:**
- Modify: `src/app/api/dashboard/route.ts`
- Modify: `src/app/(app)/page.tsx`

- [ ] API: contar gallos `activo`, lotes `listo_sacrificio`; payload nuevo `roosters: { active, required, deficit }` y `readyBatches: n`.
- [ ] Página: actualizar interfaz TS y agregar 2 StatCards (Gallos activos/requeridos; Lotes listos).

### Task 8: Página `/pollos` + Sidebar

**Files:**
- Create: `src/app/(app)/pollos/page.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/app/(app)/ventas/page.tsx` y `src/app/(app)/sacrificio/page.tsx` (selectores incluyen gallos y lotes)

- [ ] Página con dos pestañas (state local):
  - Banner balance gallos/gallinas (verde/naranja según deficit).
  - Pestaña Gallos: tabla + modal CRUD (código opcional autogenerado, raza, nacimiento, peso, estado).
  - Pestaña Lotes: tabla + modal CRUD; resaltar `listo_sacrificio` con razones.
- [ ] Sidebar: `{ href: "/pollos", label: "Pollos y Gallos", icon: "🐓" }` después de Gallinas.
- [ ] Selectores de venta/sacrificio: opciones adicionales "Gallo GA-xxx" y "Lote L-xxx (n disponibles)" que envían `roosterId`/`batchId`.

### Task 9: UI de incubación

**Files:**
- Modify: `src/app/(app)/incubacion/page.tsx`

- [ ] Modal de eclosión: campos "Hembras nacidas" y "Machos nacidos" (además de pollitos nacidos). Al completar, mostrar el `assignment` devuelto por la API con alerta tipo toast/texto.

### Task 10: Seed + verificación final

**Files:**
- Modify: `src/db/seed.ts`

- [ ] Insertar 3 gallos `GA-001..003` (birthDate daysAgo(300/320/280), peso 3.0-3.4) y lote `L-001` (20 pollos Cobb, startDate daysAgo(35), avgWeightKg 2.1).
- [ ] `npm run db:seed`, `npm run typecheck`, `npx vitest run` → todo verde.

---

## Verificación

- `npx vitest run` → todos los tests pasan.
- `npx tsc --noEmit` → sin errores.
- Smoke manual vía curl/tsx: completar incubación con machos → asignación correcta; sacrificar lote → descuento.

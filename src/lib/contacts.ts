import { db } from "@/db";
import {
  accountsPayable,
  accountsReceivable,
  birdAcquisitions,
  catalogos,
  chickenSales,
  contacts,
  eggSales,
  feedInventory,
  manureSales,
  meatSales,
  purchaseProducts,
  supplyInventory,
  transactions,
} from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  CONTACT_ROLES,
  PERSON_TYPES,
  type ContactRecord,
  type ContactRole,
  type ContactStats,
  normalizeContactNameKey,
} from "./contacts-shared";

type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function cleanOptionalText(value: unknown, maxLen = 500): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

export interface NormalizedContactInput {
  name: string;
  role: ContactRole;
  personType: "natural" | "juridica";
  documentType: string | null;
  documentNumber: string | null;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  department: string | null;
  zone: string | null;
  locationNotes: string | null;
  categoryTag: string | null;
  paymentMethod: string | null;
  creditDays: number;
  deliverySchedule: string | null;
  notes: string | null;
  isActive: boolean;
}

export function normalizeContactInput(body: Record<string, unknown>, fallbackRole: ContactRole = "cliente"): NormalizedContactInput {
  const rawRole = String(body.role || fallbackRole).trim().toLowerCase();
  const role: ContactRole = (CONTACT_ROLES as readonly string[]).includes(rawRole)
    ? (rawRole as ContactRole)
    : fallbackRole;

  const rawPersonType = String(body.personType || "natural").trim().toLowerCase();
  const personType: "natural" | "juridica" = (PERSON_TYPES as readonly string[]).includes(rawPersonType)
    ? (rawPersonType as "natural" | "juridica")
    : "natural";

  const rawCreditDays = Number(body.creditDays ?? 0);
  const creditDays = Number.isFinite(rawCreditDays) && rawCreditDays >= 0
    ? Math.min(365, Math.round(rawCreditDays))
    : 0;

  return {
    name: String(body.name || "").trim().slice(0, 200),
    role,
    personType,
    documentType: cleanOptionalText(body.documentType, 20),
    documentNumber: cleanOptionalText(body.documentNumber, 50),
    contactName: cleanOptionalText(body.contactName, 150),
    phone: cleanOptionalText(body.phone, 40),
    whatsapp: cleanOptionalText(body.whatsapp, 40),
    email: cleanOptionalText(body.email, 150),
    address: cleanOptionalText(body.address, 500),
    city: cleanOptionalText(body.city, 120),
    department: cleanOptionalText(body.department, 120),
    zone: cleanOptionalText(body.zone, 120),
    locationNotes: cleanOptionalText(body.locationNotes, 500),
    categoryTag: cleanOptionalText(body.categoryTag, 80),
    paymentMethod: cleanOptionalText(body.paymentMethod, 40),
    creditDays,
    deliverySchedule: cleanOptionalText(body.deliverySchedule, 120),
    notes: cleanOptionalText(body.notes, 1000),
    isActive: body.isActive !== undefined ? Boolean(body.isActive) : true,
  };
}

/**
 * Importa de forma idempotente cualquier cliente/proveedor previo guardado únicamente
 * en la tabla `catalogos` (`comprador` / `proveedor`) hacia `contacts`.
 */
export async function syncLegacyCatalogContacts(executor: DbExecutor = db): Promise<number> {
  const [legacyRows, existingContacts] = await Promise.all([
    executor
      .select()
      .from(catalogos)
      .where(inArray(catalogos.category, ["comprador", "proveedor"])),
    executor
      .select({ id: contacts.id, name: contacts.name, role: contacts.role, isActive: contacts.isActive })
      .from(contacts),
  ]);

  if (legacyRows.length === 0) return 0;

  const grouped = new Map<string, {
    name: string;
    hasClient: boolean;
    hasSupplier: boolean;
    isActive: boolean;
    notes: string | null;
  }>();

  for (const row of legacyRows) {
    const trimmed = row.value.trim();
    const key = normalizeContactNameKey(trimmed);
    if (!key) continue;
    const current = grouped.get(key) || {
      name: trimmed,
      hasClient: false,
      hasSupplier: false,
      isActive: false,
      notes: null,
    };
    if (row.category === "comprador") current.hasClient = true;
    if (row.category === "proveedor") current.hasSupplier = true;
    if (row.isActive) current.isActive = true;
    if (!current.notes && row.description) current.notes = row.description;
    grouped.set(key, current);
  }

  const existingByKey = new Map(existingContacts.map((c) => [normalizeContactNameKey(c.name), c]));
  let inserted = 0;

  for (const [key, item] of grouped.entries()) {
    const expectedRole: ContactRole =
      item.hasClient && item.hasSupplier ? "ambos" : item.hasSupplier ? "proveedor" : "cliente";

    const found = existingByKey.get(key);
    if (!found) {
      await executor
        .insert(contacts)
        .values({
          name: item.name,
          role: expectedRole,
          personType: "natural",
          notes: item.notes,
          isActive: item.isActive,
        })
        .onConflictDoNothing();
      inserted += 1;
      continue;
    }

    // Si en catálogo figura en ambos roles pero el contacto tenía solo uno, completar a "ambos".
    if (expectedRole === "ambos" && found.role !== "ambos") {
      await executor
        .update(contacts)
        .set({ role: "ambos", updatedAt: new Date() })
        .where(eq(contacts.id, found.id));
    }
  }

  return inserted;
}

async function upsertCatalogCategoryEntry(
  tx: DbExecutor,
  category: "comprador" | "proveedor",
  value: string,
  previousValue: string | null,
  active: boolean,
  description: string | null,
) {
  if (previousValue && previousValue !== value) {
    const [targetConflict] = await tx
      .select()
      .from(catalogos)
      .where(and(eq(catalogos.category, category), eq(catalogos.value, value)));
    const [oldRow] = await tx
      .select()
      .from(catalogos)
      .where(and(eq(catalogos.category, category), eq(catalogos.value, previousValue)));

    if (oldRow && targetConflict) {
      await tx
        .update(catalogos)
        .set({ isActive: active, description: description ?? targetConflict.description })
        .where(eq(catalogos.id, targetConflict.id));
      await tx.delete(catalogos).where(eq(catalogos.id, oldRow.id));
      return;
    }
    if (oldRow) {
      await tx
        .update(catalogos)
        .set({ value, isActive: active, description: description ?? oldRow.description })
        .where(eq(catalogos.id, oldRow.id));
      return;
    }
  }

  const [existing] = await tx
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.category, category), eq(catalogos.value, value)));

  if (existing) {
    await tx
      .update(catalogos)
      .set({ isActive: active, description: description ?? existing.description })
      .where(eq(catalogos.id, existing.id));
    return;
  }

  if (!active) return;

  const [maxOrder] = await tx
    .select({ max: sql<number>`max(${catalogos.sortOrder})` })
    .from(catalogos)
    .where(eq(catalogos.category, category));

  await tx
    .insert(catalogos)
    .values({
      category,
      value,
      description,
      sortOrder: (maxOrder?.max ?? -1) + 1,
      isActive: true,
    })
    .onConflictDoNothing();
}

/**
 * Mantiene `catalogos` (`comprador` y `proveedor`) sincronizada con `contacts` para no romper
 * `useCatalog`, caché offline, setup checklist ni herramientas existentes.
 */
export async function syncContactToCatalog(
  tx: DbExecutor,
  contact: Pick<ContactRecord, "name" | "role" | "isActive" | "notes">,
  previousName: string | null = null,
) {
  const needsClient = contact.role === "cliente" || contact.role === "ambos";
  const needsSupplier = contact.role === "proveedor" || contact.role === "ambos";

  await upsertCatalogCategoryEntry(
    tx,
    "comprador",
    contact.name,
    previousName,
    needsClient ? contact.isActive : false,
    contact.notes ?? null,
  );

  await upsertCatalogCategoryEntry(
    tx,
    "proveedor",
    contact.name,
    previousName,
    needsSupplier ? contact.isActive : false,
    contact.notes ?? null,
  );
}

/** Sincroniza cambios realizados desde el endpoint heredado `/api/configuracion/catalogos`. */
export async function syncCatalogEntryToContact(
  tx: DbExecutor,
  params: {
    action: "upsert" | "delete";
    category: string;
    value: string;
    previousValue?: string | null;
    isActive?: boolean;
    description?: string | null;
  },
) {
  if (params.category !== "comprador" && params.category !== "proveedor") return;
  const targetRole: "cliente" | "proveedor" = params.category === "comprador" ? "cliente" : "proveedor";
  const name = params.value.trim();
  if (!name) return;

  const lookupNames = [params.previousValue?.trim(), name].filter((v): v is string => Boolean(v));
  const candidates = await tx.select().from(contacts);
  const existing = candidates.find((c) =>
    lookupNames.some((n) => normalizeContactNameKey(c.name) === normalizeContactNameKey(n)),
  );

  if (params.action === "delete") {
    if (!existing) return;
    if (existing.role === "ambos") {
      const remainingRole: ContactRole = targetRole === "cliente" ? "proveedor" : "cliente";
      await tx.update(contacts).set({ role: remainingRole, updatedAt: new Date() }).where(eq(contacts.id, existing.id));
      return;
    }
    const used = await hasContactOperations(tx, existing.name);
    if (used) {
      await tx.update(contacts).set({ isActive: false, updatedAt: new Date() }).where(eq(contacts.id, existing.id));
    } else {
      await tx.delete(contacts).where(eq(contacts.id, existing.id));
    }
    return;
  }

  if (!existing) {
    await tx
      .insert(contacts)
      .values({
        name,
        role: targetRole,
        personType: "natural",
        notes: params.description ?? null,
        isActive: params.isActive ?? true,
      })
      .onConflictDoNothing();
    return;
  }

  let nextRole = existing.role;
  if (
    (targetRole === "cliente" && existing.role === "proveedor") ||
    (targetRole === "proveedor" && existing.role === "cliente")
  ) {
    nextRole = "ambos";
  }

  await tx
    .update(contacts)
    .set({
      name,
      role: nextRole,
      notes: params.description !== undefined ? params.description : existing.notes,
      isActive: params.isActive !== undefined ? params.isActive : existing.isActive,
      updatedAt: new Date(),
    })
    .where(eq(contacts.id, existing.id));
}

/** Actualiza referencias por nombre cuando el administrador corrige el nombre de un contacto. */
export async function propagateContactRename(
  tx: DbExecutor,
  previousName: string,
  newName: string,
): Promise<void> {
  const oldTrimmed = previousName.trim();
  const newTrimmed = newName.trim();
  if (!oldTrimmed || !newTrimmed || oldTrimmed === newTrimmed) return;

  await Promise.all([
    tx.update(eggSales).set({ buyer: newTrimmed }).where(eq(eggSales.buyer, oldTrimmed)),
    tx.update(chickenSales).set({ buyer: newTrimmed }).where(eq(chickenSales.buyer, oldTrimmed)),
    tx.update(meatSales).set({ buyer: newTrimmed }).where(eq(meatSales.buyer, oldTrimmed)),
    tx.update(manureSales).set({ buyer: newTrimmed }).where(eq(manureSales.buyer, oldTrimmed)),
    tx.update(accountsReceivable).set({ buyer: newTrimmed }).where(eq(accountsReceivable.buyer, oldTrimmed)),
    tx.update(accountsPayable).set({ supplier: newTrimmed }).where(eq(accountsPayable.supplier, oldTrimmed)),
    tx.update(feedInventory).set({ supplier: newTrimmed }).where(eq(feedInventory.supplier, oldTrimmed)),
    tx.update(supplyInventory).set({ supplier: newTrimmed }).where(eq(supplyInventory.supplier, oldTrimmed)),
    tx.update(birdAcquisitions).set({ supplier: newTrimmed }).where(eq(birdAcquisitions.supplier, oldTrimmed)),
    tx.update(purchaseProducts).set({ defaultSupplier: newTrimmed }).where(eq(purchaseProducts.defaultSupplier, oldTrimmed)),
    tx.update(transactions).set({ counterparty: newTrimmed }).where(eq(transactions.counterparty, oldTrimmed)),
  ]);
}

/** Verifica si el contacto tiene operaciones registradas antes de eliminar físicamente. */
export async function hasContactOperations(executor: DbExecutor, contactName: string): Promise<boolean> {
  const name = contactName.trim();
  if (!name) return false;

  const counts = await Promise.all([
    executor.select({ n: sql<number>`count(*)::int` }).from(eggSales).where(eq(eggSales.buyer, name)),
    executor.select({ n: sql<number>`count(*)::int` }).from(chickenSales).where(eq(chickenSales.buyer, name)),
    executor.select({ n: sql<number>`count(*)::int` }).from(meatSales).where(eq(meatSales.buyer, name)),
    executor.select({ n: sql<number>`count(*)::int` }).from(manureSales).where(eq(manureSales.buyer, name)),
    executor.select({ n: sql<number>`count(*)::int` }).from(accountsReceivable).where(eq(accountsReceivable.buyer, name)),
    executor.select({ n: sql<number>`count(*)::int` }).from(accountsPayable).where(eq(accountsPayable.supplier, name)),
    executor.select({ n: sql<number>`count(*)::int` }).from(feedInventory).where(eq(feedInventory.supplier, name)),
    executor.select({ n: sql<number>`count(*)::int` }).from(supplyInventory).where(eq(supplyInventory.supplier, name)),
    executor.select({ n: sql<number>`count(*)::int` }).from(birdAcquisitions).where(eq(birdAcquisitions.supplier, name)),
    executor.select({ n: sql<number>`count(*)::int` }).from(purchaseProducts).where(eq(purchaseProducts.defaultSupplier, name)),
    executor.select({ n: sql<number>`count(*)::int` }).from(transactions).where(eq(transactions.counterparty, name)),
  ]);

  return counts.some((rows) => (rows[0]?.n ?? 0) > 0);
}

/** Calcula métricas operativas reales por contacto sin duplicar ingresos/egresos. */
export async function computeContactStatsMap(executor: DbExecutor = db): Promise<Map<string, ContactStats>> {
  const todayStr = new Date().toISOString().split("T")[0];
  const emptyStats = (): ContactStats => ({
    salesCount: 0,
    totalSalesAmount: 0,
    receivablePending: 0,
    overdueReceivables: 0,
    purchasesCount: 0,
    totalPurchasesAmount: 0,
    payablePending: 0,
    overduePayables: 0,
    associatedCatalogItems: 0,
    lastActivityDate: null,
  });

  const [
    txAgg,
    arRows,
    apRows,
    feedRows,
    supplyRows,
    productRows,
    acqRows,
  ] = await Promise.all([
    executor
      .select({
        party: transactions.counterparty,
        type: transactions.type,
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${transactions.amount}), 0)::text`,
        lastDate: sql<string | null>`max(${transactions.date})`,
      })
      .from(transactions)
      .where(sql`${transactions.counterparty} is not null and btrim(${transactions.counterparty}) <> ''`)
      .groupBy(transactions.counterparty, transactions.type),
    executor
      .select({
        buyer: accountsReceivable.buyer,
        pendingAmount: accountsReceivable.pendingAmount,
        dueDate: accountsReceivable.dueDate,
        status: accountsReceivable.status,
      })
      .from(accountsReceivable),
    executor
      .select({
        supplier: accountsPayable.supplier,
        pendingAmount: accountsPayable.pendingAmount,
        dueDate: accountsPayable.dueDate,
        status: accountsPayable.status,
      })
      .from(accountsPayable),
    executor
      .select({ supplier: feedInventory.supplier })
      .from(feedInventory)
      .where(sql`${feedInventory.supplier} is not null and btrim(${feedInventory.supplier}) <> ''`),
    executor
      .select({ supplier: supplyInventory.supplier })
      .from(supplyInventory)
      .where(sql`${supplyInventory.supplier} is not null and btrim(${supplyInventory.supplier}) <> ''`),
    executor
      .select({ supplier: purchaseProducts.defaultSupplier })
      .from(purchaseProducts)
      .where(sql`${purchaseProducts.defaultSupplier} is not null and btrim(${purchaseProducts.defaultSupplier}) <> ''`),
    executor
      .select({ supplier: birdAcquisitions.supplier, date: birdAcquisitions.date })
      .from(birdAcquisitions)
      .where(sql`${birdAcquisitions.supplier} is not null and btrim(${birdAcquisitions.supplier}) <> ''`),
  ]);

  const map = new Map<string, ContactStats>();
  const ensure = (rawName: string | null | undefined) => {
    const key = normalizeContactNameKey(rawName);
    if (!key) return null;
    let entry = map.get(key);
    if (!entry) {
      entry = emptyStats();
      map.set(key, entry);
    }
    return entry;
  };

  const bumpDate = (entry: ContactStats, candidate: string | null | undefined) => {
    if (!candidate) return;
    if (!entry.lastActivityDate || candidate > entry.lastActivityDate) {
      entry.lastActivityDate = candidate;
    }
  };

  for (const row of txAgg) {
    const entry = ensure(row.party);
    if (!entry) continue;
    const total = Number(row.total) || 0;
    if (row.type === "ingreso") {
      entry.salesCount += row.count;
      entry.totalSalesAmount += total;
    } else if (row.type === "egreso") {
      entry.purchasesCount += row.count;
      entry.totalPurchasesAmount += total;
    }
    bumpDate(entry, row.lastDate);
  }

  for (const row of arRows) {
    const entry = ensure(row.buyer);
    if (!entry || row.status === "pagado") continue;
    entry.receivablePending += Number(row.pendingAmount) || 0;
    if (row.dueDate && row.dueDate < todayStr) {
      entry.overdueReceivables += 1;
    }
  }

  for (const row of apRows) {
    const entry = ensure(row.supplier);
    if (!entry || row.status === "pagado") continue;
    entry.payablePending += Number(row.pendingAmount) || 0;
    if (row.dueDate && row.dueDate < todayStr) {
      entry.overduePayables += 1;
    }
  }

  for (const row of [...feedRows, ...supplyRows, ...productRows]) {
    const entry = ensure(row.supplier);
    if (entry) entry.associatedCatalogItems += 1;
  }

  for (const row of acqRows) {
    const entry = ensure(row.supplier);
    if (!entry) continue;
    entry.associatedCatalogItems += 1;
    bumpDate(entry, row.date);
  }

  return map;
}


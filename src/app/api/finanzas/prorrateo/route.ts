import { db } from "@/db";
import {
  broilerBatches,
  costAllocations,
  farmLocations,
  feedMovements,
  hens,
  roosters,
  transactions,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { isDateOnly, todayColombiaIso } from "@/lib/date-validation";
import { HEN_PRESENT_STATUSES } from "@/lib/animal-status";
import { normalizeFeedingSpecies, SPECIES_LABELS } from "@/lib/species";
import { getSessionUser } from "@/lib/auth";
import { canPerformAction, forbiddenResponse } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const VALID_BASES = new Set(["head_count", "biomass", "feed_kg", "area_m2", "manual"]);

interface WeightBucket {
  species: string | null;
  locationId: string | null;
  batchId: string | null;
  label: string;
  weight: number;
}

function speciesLabel(sp: string | null | undefined): string {
  if (!sp) return "Sin asignar";
  return (SPECIES_LABELS as Record<string, { plural?: string; singular?: string }>)[sp]?.plural || sp;
}

async function computeSuggestedWeights(basis: string, periodFrom?: string, periodTo?: string): Promise<WeightBucket[]> {
  if (basis === "area_m2") {
    const locs = await db
      .select({ id: farmLocations.id, name: farmLocations.name, areaM2: farmLocations.areaM2, status: farmLocations.status })
      .from(farmLocations)
      .where(eq(farmLocations.status, "activa"));
    return locs
      .map((l) => ({
        species: null,
        locationId: l.id,
        batchId: null,
        label: l.name,
        weight: Math.max(0, Number(l.areaM2 || 0)),
      }))
      .filter((b) => b.weight > 0);
  }

  if (basis === "feed_kg") {
    const conds = [eq(feedMovements.isEntry, false)];
    if (periodFrom && isDateOnly(periodFrom)) conds.push(gte(feedMovements.date, periodFrom));
    if (periodTo && isDateOnly(periodTo)) conds.push(lte(feedMovements.date, periodTo));
    const rows = await db
      .select({
        species: feedMovements.species,
        kg: sql<string>`coalesce(sum(${feedMovements.quantity}::numeric), 0)`,
      })
      .from(feedMovements)
      .where(and(...conds))
      .groupBy(feedMovements.species);
    return rows
      .map((r) => ({
        species: r.species || "gallina",
        locationId: null,
        batchId: null,
        label: speciesLabel(r.species || "gallina"),
        weight: Math.max(0, Number(r.kg || 0)),
      }))
      .filter((b) => b.weight > 0);
  }

  // head_count or biomass
  const [henRows, roosterRows, batchRows] = await Promise.all([
    db.select({ weight: hens.weight, status: hens.status }).from(hens)
      .where(inArray(hens.status, HEN_PRESENT_STATUSES as (typeof hens.status.enumValues)[number][])),
    db.select({ weight: roosters.weight, status: roosters.status }).from(roosters)
      .where(inArray(roosters.status, ["activo", "enfermo"])),
    db.select({
      species: broilerBatches.species,
      qty: broilerBatches.currentQuantity,
      avgWeightKg: broilerBatches.avgWeightKg,
      targetWeightKg: broilerBatches.targetWeightKg,
      status: broilerBatches.status,
    }).from(broilerBatches).where(inArray(broilerBatches.status, ["activo", "listo_sacrificio"])),
  ]);

  const bySpecies = new Map<string, number>();
  const add = (sp: string, val: number) => {
    if (val > 0) bySpecies.set(sp, (bySpecies.get(sp) || 0) + val);
  };

  if (basis === "biomass") {
    add("gallina", henRows.reduce((s, h) => s + Math.max(0.5, Number(h.weight || 1.8)), 0));
    add("gallo", roosterRows.reduce((s, r) => s + Math.max(0.5, Number(r.weight || 2.5)), 0));
    for (const b of batchRows) {
      const unitKg = Math.max(0.1, Number(b.avgWeightKg || b.targetWeightKg || 1));
      add(b.species, b.qty * unitKg);
    }
  } else {
    add("gallina", henRows.length);
    add("gallo", roosterRows.length);
    for (const b of batchRows) {
      add(b.species, b.qty);
    }
  }

  return Array.from(bySpecies.entries()).map(([sp, w]) => ({
    species: sp,
    locationId: null,
    batchId: null,
    label: speciesLabel(sp),
    weight: Number(w.toFixed(2)),
  }));
}

function distributeByWeights(totalAmount: number, buckets: WeightBucket[]) {
  const totalWeight = buckets.reduce((s, b) => s + b.weight, 0);
  if (buckets.length === 0 || totalWeight <= 0) return [];
  let remainingPct = 100;
  let remainingAmount = totalAmount;
  return buckets.map((b, idx) => {
    const isLast = idx === buckets.length - 1;
    const pct = isLast
      ? Number(remainingPct.toFixed(2))
      : Number(((b.weight / totalWeight) * 100).toFixed(2));
    const amt = isLast
      ? Number(remainingAmount.toFixed(2))
      : Number(((totalAmount * pct) / 100).toFixed(2));
    remainingPct -= pct;
    remainingAmount -= amt;
    return {
      species: b.species,
      locationId: b.locationId,
      batchId: b.batchId,
      label: b.label,
      percentage: pct,
      amount: amt,
    };
  });
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const conds = [];
  if (from && isDateOnly(from)) conds.push(gte(costAllocations.date, from));
  if (to && isDateOnly(to)) conds.push(lte(costAllocations.date, to));

  const txConds = [
    eq(transactions.type, "egreso"),
    isNull(transactions.species),
    isNull(transactions.locationId),
  ];
  if (from && isDateOnly(from)) txConds.push(gte(transactions.date, from));
  if (to && isDateOnly(to)) txConds.push(lte(transactions.date, to));

  const [allocations, unallocatedTransactions, byHead, byBiomass, byFeed, byArea] = await Promise.all([
    db.select().from(costAllocations)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(costAllocations.date), desc(costAllocations.createdAt)),
    db.select().from(transactions)
      .where(and(...txConds))
      .orderBy(desc(transactions.date))
      .limit(100),
    computeSuggestedWeights("head_count", from || undefined, to || undefined),
    computeSuggestedWeights("biomass", from || undefined, to || undefined),
    computeSuggestedWeights("feed_kg", from || undefined, to || undefined),
    computeSuggestedWeights("area_m2"),
  ]);

  const allocatedSourceIds = new Set(
    allocations.map((a) => a.sourceTransactionId).filter((id): id is string => Boolean(id)),
  );

  return NextResponse.json({
    allocations,
    unallocatedTransactions: unallocatedTransactions.map((t) => ({
      ...t,
      alreadyAllocated: allocatedSourceIds.has(t.id),
    })),
    suggestedWeights: {
      head_count: byHead,
      biomass: byBiomass,
      feed_kg: byFeed,
      area_m2: byArea,
    },
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (user && !canPerformAction(user.role, "finance:write")) {
    return forbiddenResponse();
  }
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const basis = String(body.basis || "head_count");
  if (!VALID_BASES.has(basis)) {
    return NextResponse.json({ error: "Base de prorrateo no válida" }, { status: 400 });
  }

  const date = isDateOnly(body.date) ? String(body.date) : todayColombiaIso();
  const periodFrom = isDateOnly(body.periodFrom) ? String(body.periodFrom) : null;
  const periodTo = isDateOnly(body.periodTo) ? String(body.periodTo) : null;

  let sourceTransactionId: string | null = null;
  let totalAmount = Number(body.totalAmount);
  let expenseCategory = typeof body.expenseCategory === "string" && body.expenseCategory.trim()
    ? body.expenseCategory.trim()
    : null;
  let title = typeof body.title === "string" ? body.title.trim() : "";

  if (body.sourceTransactionId) {
    const [txRow] = await db.select().from(transactions).where(eq(transactions.id, String(body.sourceTransactionId)));
    if (!txRow) return NextResponse.json({ error: "La transacción origen no existe" }, { status: 404 });
    sourceTransactionId = txRow.id;
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) totalAmount = Number(txRow.amount);
    if (!expenseCategory) expenseCategory = txRow.category;
    if (!title) title = txRow.description || txRow.category;
  }

  if (!title) return NextResponse.json({ error: "El título del prorrateo es requerido" }, { status: 400 });
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: "El monto total debe ser mayor a cero" }, { status: 400 });
  }

  let computedAllocations: Array<{
    species?: string | null;
    locationId?: string | null;
    batchId?: string | null;
    label?: string;
    percentage: number;
    amount: number;
  }> = [];

  if (basis === "manual" || (Array.isArray(body.allocations) && body.allocations.length > 0)) {
    const rawItems = Array.isArray(body.allocations) ? body.allocations : [];
    if (rawItems.length === 0) {
      return NextResponse.json({ error: "Debes incluir al menos un destino de prorrateo" }, { status: 400 });
    }
    const pctSum = rawItems.reduce((s: number, item: { percentage?: unknown }) => s + Number(item?.percentage || 0), 0);
    if (Math.abs(pctSum - 100) > 0.6) {
      return NextResponse.json({ error: `Los porcentajes deben sumar 100% (actual: ${pctSum.toFixed(2)}%)` }, { status: 400 });
    }
    let remAmt = totalAmount;
    computedAllocations = rawItems.map((item: {
      species?: unknown;
      locationId?: unknown;
      batchId?: unknown;
      label?: unknown;
      percentage?: unknown;
    }, idx: number) => {
      const sp = item.species ? normalizeFeedingSpecies(item.species) || String(item.species) : null;
      const pct = Number(Number(item.percentage || 0).toFixed(2));
      const amt = idx === rawItems.length - 1
        ? Number(remAmt.toFixed(2))
        : Number(((totalAmount * pct) / 100).toFixed(2));
      remAmt -= amt;
      return {
        species: sp,
        locationId: item.locationId ? String(item.locationId) : null,
        batchId: item.batchId ? String(item.batchId) : null,
        label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : speciesLabel(sp),
        percentage: pct,
        amount: amt,
      };
    });
  } else {
    const buckets = await computeSuggestedWeights(basis, periodFrom || undefined, periodTo || undefined);
    if (buckets.length === 0) {
      return NextResponse.json(
        { error: `No hay datos activos suficientes para prorratear por "${basis}". Usa prorrateo manual.` },
        { status: 400 },
      );
    }
    computedAllocations = distributeByWeights(totalAmount, buckets);
  }

  const [created] = await db.insert(costAllocations).values({
    date,
    title,
    sourceTransactionId,
    expenseCategory,
    totalAmount: totalAmount.toFixed(2),
    basis,
    allocations: computedAllocations,
    periodFrom,
    periodTo,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
  }).returning();

  return NextResponse.json(created, { status: 201 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (user && !canPerformAction(user.role, "finance:write")) {
    return forbiddenResponse();
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const [deleted] = await db.delete(costAllocations).where(eq(costAllocations.id, id)).returning();
  if (!deleted) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
});

import { db } from "@/db";
import {
  costAllocations,
  transactions,
} from "@/db/schema";
import { and, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { isDateOnly, todayColombiaIso } from "@/lib/date-validation";
import { resolveExpenseClassification } from "@/lib/finance/standard-expense-catalog";
import { normalizeFeedingSpecies } from "@/lib/species";
import { getSessionUser } from "@/lib/auth";
import { canPerformAction, forbiddenResponse } from "@/lib/rbac";
import {
  computeSuggestedProrationWeights,
  distributeAmountByWeights,
  formatProrationSpeciesLabel,
  VALID_PRORATION_BASES,
} from "@/lib/analytics/proration";

export const dynamic = "force-dynamic";

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
    computeSuggestedProrationWeights("head_count", from || undefined, to || undefined),
    computeSuggestedProrationWeights("biomass", from || undefined, to || undefined),
    computeSuggestedProrationWeights("feed_kg", from || undefined, to || undefined),
    computeSuggestedProrationWeights("area_m2"),
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
  if (!VALID_PRORATION_BASES.has(basis)) {
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
  let expenseCatalogId = typeof body.expenseCatalogId === "string" && body.expenseCatalogId.trim()
    ? body.expenseCatalogId.trim()
    : null;
  let expenseFamily = typeof body.expenseFamily === "string" && body.expenseFamily.trim()
    ? body.expenseFamily.trim()
    : null;
  let title = typeof body.title === "string" ? body.title.trim() : "";

  if (body.sourceTransactionId) {
    const [txRow] = await db.select().from(transactions).where(eq(transactions.id, String(body.sourceTransactionId)));
    if (!txRow) return NextResponse.json({ error: "La transacción origen no existe" }, { status: 404 });
    sourceTransactionId = txRow.id;
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) totalAmount = Number(txRow.amount);
    if (!expenseCategory) expenseCategory = txRow.category;
    if (!expenseCatalogId) expenseCatalogId = txRow.expenseCatalogId;
    if (!expenseFamily) expenseFamily = txRow.expenseFamily;
    if (!title) title = txRow.description || txRow.category;
  }

  const resolvedProrrateo = resolveExpenseClassification({
    type: "egreso",
    category: expenseCategory || expenseFamily || title,
    expenseCatalogId,
    expenseFamily,
    description: title,
  });
  expenseCatalogId = expenseCatalogId ?? resolvedProrrateo.expenseCatalogId;
  expenseFamily = expenseFamily ?? resolvedProrrateo.expenseFamily;

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
        label: typeof item.label === "string" && item.label.trim() ? item.label.trim() : formatProrationSpeciesLabel(sp),
        percentage: pct,
        amount: amt,
      };
    });
  } else {
    const buckets = await computeSuggestedProrationWeights(basis, periodFrom || undefined, periodTo || undefined);
    if (buckets.length === 0) {
      return NextResponse.json(
        { error: `No hay datos activos suficientes para prorratear por "${basis}". Usa prorrateo manual.` },
        { status: 400 },
      );
    }
    computedAllocations = distributeAmountByWeights(totalAmount, buckets);
  }

  const [created] = await db.insert(costAllocations).values({
    date,
    title,
    sourceTransactionId,
    expenseCategory,
    expenseCatalogId,
    expenseFamily,
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

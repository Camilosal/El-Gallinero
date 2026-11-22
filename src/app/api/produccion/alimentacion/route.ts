import { db } from "@/db";
import { feedInventory, feedMovements, transactions } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getFeedInventoryProjection } from "@/lib/feeding/inventory";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { deleteTransactionsAndUnpaidAccounts } from "@/lib/financial-records";
import {
  currentFeedCategory,
  currentFeedType,
  inferFeedCatalogGroup,
  normalizeFeedCatalogGroup,
  normalizeFeedCategory,
  normalizeFeedType,
} from "@/lib/feed-classification";
import { parseOptionalNutrientDecimal, parseOptionalPercent } from "@/lib/feeding/ration";
import { findStandardFeedById, type StandardFeedItem } from "@/lib/feeding/standard-feed-catalog";
import { getSessionUser } from "@/lib/auth";
import { canPerformAction } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const ALLOWED_SANITARY_STATUSES = new Set(["CONDICIONAL", "RESTRINGIDO", "NO USAR"]);

function buildStandardProfileSnapshot(std: StandardFeedItem | null, existing?: unknown): Record<string, unknown> | null {
  if (!std) return existing && typeof existing === "object" ? (existing as Record<string, unknown>) : null;
  return {
    group: std.group,
    botanicalName: std.botanicalName,
    presentation: std.presentation,
    origin: std.origin,
    preparation: std.preparation,
    evidenceQuality: std.evidenceQuality,
    risks: std.risks,
    sourceUrl: std.sourceUrl,
    compositionNotes: std.compositionNotes,
    crudeProteinDmPct: std.crudeProteinDmPct,
    fatDmPct: std.fatDmPct,
    totalPhosphorusDmPct: std.totalPhosphorusDmPct,
    formulationStatus: std.formulationStatus,
  };
}

function validateExtraNutritionFields(body: Record<string, unknown>) {
  const energy =
    body.energyKcalKgDm === undefined
      ? undefined
      : parseOptionalNutrientDecimal(body.energyKcalKgDm, "La energía metabolizable (EM)", { max: 9000 });
  if (energy && "error" in energy) return { error: energy.error };

  const calcium =
    body.calciumDmPct === undefined ? undefined : parseOptionalPercent(body.calciumDmPct, "El calcio (% MS)");
  if (calcium && "error" in calcium) return { error: calcium.error };

  const phosphorus =
    body.availablePhosphorusDmPct === undefined
      ? undefined
      : parseOptionalPercent(body.availablePhosphorusDmPct, "El fósforo disponible (% MS)");
  if (phosphorus && "error" in phosphorus) return { error: phosphorus.error };

  const lysine =
    body.lysineDigDmPct === undefined ? undefined : parseOptionalPercent(body.lysineDigDmPct, "La lisina digestible (% MS)");
  if (lysine && "error" in lysine) return { error: lysine.error };

  const metCys =
    body.metCysDigDmPct === undefined ? undefined : parseOptionalPercent(body.metCysDigDmPct, "Metionina+Cistina (% MS)");
  if (metCys && "error" in metCys) return { error: metCys.error };

  const fiber =
    body.crudeFiberDmPct === undefined ? undefined : parseOptionalPercent(body.crudeFiberDmPct, "La fibra bruta (% MS)");
  if (fiber && "error" in fiber) return { error: fiber.error };

  const rawSanitary =
    body.sanitaryStatus === undefined || body.sanitaryStatus === null || body.sanitaryStatus === ""
      ? undefined
      : String(body.sanitaryStatus).trim().toUpperCase();
  if (rawSanitary !== undefined && !ALLOWED_SANITARY_STATUSES.has(rawSanitary)) {
    return { error: "Estado sanitario no reconocido. Usa CONDICIONAL, RESTRINGIDO o NO USAR." };
  }

  return { energy, calcium, phosphorus, lysine, metCys, fiber, sanitaryStatus: rawSanitary };
}

// GET - feed inventory contains stock costs and supplier data, so it is private.
export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const days = parseInt(searchParams.get("days") || "30", 10);

  const items = await getFeedInventoryProjection(days);

  const user = await getSessionUser();
  const canSeeCosts = canPerformAction(user?.role, "finance:read");
  const visibleItems = canSeeCosts
    ? items
    : items.map((item) => ({ ...item, costPerUnit: null, supplier: null }));

  // Contrato histórico del endpoint: array plano de alimentos.
  return NextResponse.json(visibleItems);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const requestedStdId = typeof body.standardCatalogId === "string" ? body.standardCatalogId.trim() : "";
  const standardItem = requestedStdId ? findStandardFeedById(requestedStdId) : null;
  if (requestedStdId && !standardItem) {
    return NextResponse.json({ error: `Ingrediente base '${requestedStdId}' no encontrado en el catálogo estandarizado.` }, { status: 400 });
  }
  if (standardItem?.isBlocked) {
    return NextResponse.json(
      { error: `Ingrediente bloqueado (NO USAR): ${standardItem.name}. ${standardItem.risks || standardItem.preparation || ""}`.trim() },
      { status: 400 },
    );
  }

  const dryMatterInput = body.dryMatterPct === undefined || body.dryMatterPct === "" ? standardItem?.dryMatterPct : body.dryMatterPct;
  const proteinInput = body.crudeProteinPct === undefined || body.crudeProteinPct === "" ? standardItem?.crudeProteinAsFedPct : body.crudeProteinPct;

  const dryMatter = parseOptionalPercent(dryMatterInput, "La materia seca", { positive: true });
  if ("error" in dryMatter) return NextResponse.json({ error: dryMatter.error }, { status: 400 });
  const protein = parseOptionalPercent(proteinInput, "La proteína cruda");
  if ("error" in protein) return NextResponse.json({ error: protein.error }, { status: 400 });

  const extra = validateExtraNutritionFields(body);
  if ("error" in extra) return NextResponse.json({ error: extra.error }, { status: 400 });
  const resolvedSanitary = extra.sanitaryStatus ?? standardItem?.sanitaryStatus ?? null;
  if (resolvedSanitary === "NO USAR") {
    return NextResponse.json(
      { error: "No se puede registrar un alimento con estado sanitario NO USAR." },
      { status: 400 },
    );
  }

  const initialStock = Number(body.currentStock ?? 0);
  if (!Number.isFinite(initialStock) || initialStock < 0) {
    return NextResponse.json({ error: "Stock inicial inválido" }, { status: 400 });
  }
  const rawCategory = normalizeFeedCategory(body.category ?? standardItem?.defaultCategory);
  const rawFeedType = normalizeFeedType(body.feedType ?? standardItem?.defaultFeedType);
  if (!rawCategory) return NextResponse.json({ error: "Categoría de alimento no reconocida. Revisa el catálogo de categorías." }, { status: 400 });
  if (!rawFeedType) return NextResponse.json({ error: "Tipo de alimento no reconocido. Revisa el catálogo de tipos." }, { status: 400 });
  const category = currentFeedCategory(rawCategory) ?? rawCategory;
  const feedType = currentFeedType(rawFeedType) ?? rawFeedType;
  const feedName = (typeof body.name === "string" && body.name.trim()) ? body.name.trim() : standardItem?.name || "";
  const catalogGroup =
    standardItem?.group ??
    normalizeFeedCatalogGroup(body.catalogGroup) ??
    inferFeedCatalogGroup(feedType, feedName, category);

  const toDecimalOrStd = (parsed: { value: string | null } | undefined, stdVal: number | null | undefined) => {
    if (parsed !== undefined && parsed.value !== null) return parsed.value;
    if (parsed !== undefined && parsed.value === null) return null;
    return stdVal !== null && stdVal !== undefined ? stdVal.toFixed(2) : null;
  };

  const [created] = await db.transaction(async (tx) => {
    const [row] = await tx.insert(feedInventory).values({
      name: feedName,
      category,
      feedType,
      unit: body.unit || standardItem?.defaultUnit || "kg",
      currentStock: initialStock.toFixed(2),
      minStock: body.minStock || "0",
      costPerUnit: body.costPerUnit || "0",
      supplier: body.supplier || null,
      dryMatterPct: dryMatter.value,
      crudeProteinPct: protein.value,
      standardCatalogId: standardItem?.id ?? null,
      catalogGroup,
      sanitaryStatus: resolvedSanitary,
      energyKcalKgDm: toDecimalOrStd(extra.energy, standardItem?.energyKcalKgDm),
      calciumDmPct: toDecimalOrStd(extra.calcium, standardItem?.calciumDmPct),
      availablePhosphorusDmPct: toDecimalOrStd(extra.phosphorus, standardItem?.availablePhosphorusDmPct),
      lysineDigDmPct: toDecimalOrStd(extra.lysine, standardItem?.lysineDigDmPct),
      metCysDigDmPct: toDecimalOrStd(extra.metCys, standardItem?.metCysDigDmPct),
      crudeFiberDmPct: toDecimalOrStd(extra.fiber, standardItem?.crudeFiberDmPct),
      nutritionProfile: body.nutritionProfile ?? buildStandardProfileSnapshot(standardItem),
    }).returning();
    if (initialStock > 0) {
      await tx.insert(feedMovements).values({
        feedId: row.id,
        quantity: initialStock.toFixed(2),
        isEntry: true,
        movementType: "ajuste",
        autoGenerated: false,
        date: new Date().toISOString().slice(0, 10),
        notes: "Stock inicial del alimento",
      });
    }
    return [row];
  });
  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const requestedStdId =
    body.standardCatalogId === undefined
      ? undefined
      : typeof body.standardCatalogId === "string" && body.standardCatalogId.trim()
        ? body.standardCatalogId.trim()
        : null;
  const standardItem = requestedStdId ? findStandardFeedById(requestedStdId) : null;
  if (requestedStdId && !standardItem) {
    return NextResponse.json({ error: `Ingrediente base '${requestedStdId}' no encontrado en el catálogo estandarizado.` }, { status: 400 });
  }
  if (standardItem?.isBlocked) {
    return NextResponse.json(
      { error: `Ingrediente bloqueado (NO USAR): ${standardItem.name}. ${standardItem.risks || standardItem.preparation || ""}`.trim() },
      { status: 400 },
    );
  }

  const dryMatter = body.dryMatterPct === undefined ? undefined : parseOptionalPercent(body.dryMatterPct, "La materia seca", { positive: true });
  if (dryMatter && "error" in dryMatter) return NextResponse.json({ error: dryMatter.error }, { status: 400 });
  const protein = body.crudeProteinPct === undefined ? undefined : parseOptionalPercent(body.crudeProteinPct, "La proteína cruda");
  if (protein && "error" in protein) return NextResponse.json({ error: protein.error }, { status: 400 });
  const extra = validateExtraNutritionFields(body);
  if ("error" in extra) return NextResponse.json({ error: extra.error }, { status: 400 });
  if (extra.sanitaryStatus === "NO USAR") {
    return NextResponse.json({ error: "No se permite estado sanitario NO USAR." }, { status: 400 });
  }

  const parsedCategory = body.category == null ? undefined : normalizeFeedCategory(body.category);
  const parsedFeedType = body.feedType == null ? undefined : normalizeFeedType(body.feedType);
  if (body.category != null && !parsedCategory) {
    return NextResponse.json({ error: "Categoría de alimento no reconocida. Revisa el catálogo de categorías." }, { status: 400 });
  }
  if (body.feedType != null && !parsedFeedType) {
    return NextResponse.json({ error: "Tipo de alimento no reconocido. Revisa el catálogo de tipos." }, { status: 400 });
  }
  const requestedCategory = parsedCategory ? (currentFeedCategory(parsedCategory) ?? parsedCategory) : undefined;
  const requestedFeedType = parsedFeedType ? (currentFeedType(parsedFeedType) ?? parsedFeedType) : undefined;
  const requestedGroup = body.catalogGroup == null ? undefined : normalizeFeedCatalogGroup(body.catalogGroup);

  const [updated] = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(feedInventory).where(eq(feedInventory.id, body.id)).for("update");
    if (!existing) return [];
    const nextStock = body.currentStock != null ? Number(body.currentStock) : Number(existing.currentStock);
    if (!Number.isFinite(nextStock) || nextStock < 0) throw new Error("Stock inválido");
    const previousStock = Number(existing.currentStock);
    const nextName = body.name ?? existing.name;
    const nextCategory = requestedCategory ?? existing.category;
    const nextFeedType = requestedFeedType ?? existing.feedType;
    const [row] = await tx.update(feedInventory).set({
      name: nextName,
      category: nextCategory,
      feedType: nextFeedType,
      unit: body.unit ?? existing.unit,
      currentStock: nextStock.toFixed(2),
      minStock: body.minStock ?? existing.minStock,
      costPerUnit: body.costPerUnit ?? existing.costPerUnit,
      supplier: body.supplier !== undefined ? body.supplier : existing.supplier,
      dryMatterPct: dryMatter === undefined ? existing.dryMatterPct : dryMatter.value,
      crudeProteinPct: protein === undefined ? existing.crudeProteinPct : protein.value,
      standardCatalogId: requestedStdId === undefined ? existing.standardCatalogId : requestedStdId,
      catalogGroup:
        standardItem?.group ??
        requestedGroup ??
        normalizeFeedCatalogGroup(existing.catalogGroup) ??
        inferFeedCatalogGroup(nextFeedType, nextName, nextCategory),
      sanitaryStatus:
        extra.sanitaryStatus !== undefined
          ? extra.sanitaryStatus
          : requestedStdId === null
            ? null
            : standardItem?.sanitaryStatus ?? existing.sanitaryStatus,
      energyKcalKgDm: extra.energy === undefined ? existing.energyKcalKgDm : extra.energy.value,
      calciumDmPct: extra.calcium === undefined ? existing.calciumDmPct : extra.calcium.value,
      availablePhosphorusDmPct: extra.phosphorus === undefined ? existing.availablePhosphorusDmPct : extra.phosphorus.value,
      lysineDigDmPct: extra.lysine === undefined ? existing.lysineDigDmPct : extra.lysine.value,
      metCysDigDmPct: extra.metCys === undefined ? existing.metCysDigDmPct : extra.metCys.value,
      crudeFiberDmPct: extra.fiber === undefined ? existing.crudeFiberDmPct : extra.fiber.value,
      nutritionProfile:
        body.nutritionProfile !== undefined
          ? body.nutritionProfile
          : standardItem
            ? buildStandardProfileSnapshot(standardItem, existing.nutritionProfile)
            : requestedStdId === null
              ? null
              : existing.nutritionProfile,
      updatedAt: new Date(),
    }).where(eq(feedInventory.id, body.id)).returning();

    if (Math.abs(nextStock - previousStock) >= 0.005) {
      const delta = nextStock - previousStock;
      await tx.insert(feedMovements).values({
        feedId: existing.id,
        quantity: Math.abs(delta).toFixed(2),
        isEntry: delta > 0,
        movementType: "ajuste",
        autoGenerated: false,
        date: new Date().toISOString().slice(0, 10),
        notes: "Ajuste manual del stock desde el catálogo de alimentos",
      });
    }
    return [row];
  });

  if (!updated) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    const [feed] = await tx.select().from(feedInventory).where(eq(feedInventory.id, id)).for("update");
    if (!feed) throw new Error("No encontrado");
    // Remove linked expense transactions of its movements
    const movs = await tx.select({ id: feedMovements.id }).from(feedMovements).where(eq(feedMovements.feedId, id));
    const movIds = movs.map((m) => m.id);
    if (movIds.length > 0) {
      await deleteTransactionsAndUnpaidAccounts(
        tx,
        and(eq(transactions.sourceType, "alimento"), inArray(transactions.sourceId, movIds)),
      );
    }

    await tx.delete(feedMovements).where(eq(feedMovements.feedId, id));
    await tx.delete(feedInventory).where(eq(feedInventory.id, id));
  });
  return NextResponse.json({ ok: true });
});

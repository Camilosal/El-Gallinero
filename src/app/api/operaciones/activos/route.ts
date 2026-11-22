import { and, asc, eq, getTableColumns, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farmAssets, farmLocations, transactions } from "@/db/schema";
import {
  CAPEX_CLASSIFICATION_LABELS,
  computeSuggestedResidualCop,
  findStandardCapexById,
  resolveCapexClassification,
} from "@/lib/finance/standard-capex-catalog";
import { isDateOnly } from "@/lib/date-validation";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set(["equipo", "herramienta", "estructura", "vehiculo", "otro"]);
const STATUSES = new Set(["operativo", "requiere_mantenimiento", "fuera_servicio", "retirado"]);
const DEPRECIATION_BASES = new Set(["meses", "ciclos"]);

function cleanText(value: unknown, max: number, label: string): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} inválido`);
  const text = value.trim();
  if (text.length > max) throw new Error(`${label} supera ${max} caracteres`);
  return text || null;
}

function validateAsset(body: Record<string, unknown>) {
  if (typeof body.name !== "string" || !body.name.trim()) throw new Error("El nombre del activo es requerido");
  if (body.name.trim().length > 200) throw new Error("El nombre supera 200 caracteres");

  const rawCapexCatalogId = cleanText(body.capexCatalogId, 20, "Código de catálogo CapEx");
  if (rawCapexCatalogId && !findStandardCapexById(rawCapexCatalogId)) {
    throw new Error("Código de catálogo CapEx inválido (usa un código CAP-XXX vigente)");
  }

  const rawCapexFamily = cleanText(body.capexFamily, 120, "Familia CapEx");
  const rawCapexSubfamily = cleanText(body.capexSubfamily, 120, "Subfamilia CapEx");
  const rawCapexClassification = cleanText(body.capexClassification, 40, "Clasificación CapEx");
  const rawCapexDestination = cleanText(body.capexDestination, 40, "Destino CapEx");
  const rawCapexDriver = cleanText(body.capexDriver, 60, "Driver CapEx");

  if (body.category && !CATEGORIES.has(String(body.category))) {
    throw new Error("Tipo de activo inválido");
  }

  const resolved = resolveCapexClassification({
    capexCatalogId: rawCapexCatalogId,
    capexFamily: rawCapexFamily,
    capexSubfamily: rawCapexSubfamily,
    capexClassification: rawCapexClassification,
    capexDestination: rawCapexDestination,
    capexDriver: rawCapexDriver,
    name: body.name.trim(),
    category: body.category ? String(body.category) : null,
    description: typeof body.description === "string" ? body.description : null,
  });

  if (resolved.isFrontierExclusion && body.allowFrontierOverride !== true) {
    const classLabel = CAPEX_CLASSIFICATION_LABELS[resolved.capexClassification] || resolved.capexClassification;
    const redirectLabel = resolved.frontierRedirect?.moduleLabel || "el módulo operativo correspondiente";
    throw new Error(
      `Frontera contable (${classLabel}): este concepto no se registra como activo fijo depreciable. Regístralo en ${redirectLabel}.`,
    );
  }

  const category =
    body.category && CATEGORIES.has(String(body.category)) && !rawCapexCatalogId
      ? String(body.category)
      : resolved.legacyCategory;
  const status = String(body.status || "operativo");
  if (!CATEGORIES.has(category)) throw new Error("Tipo de activo inválido");
  if (!STATUSES.has(status)) throw new Error("Estado del activo inválido");
  if (body.acquisitionDate && !isDateOnly(body.acquisitionDate)) throw new Error("Fecha de adquisición inválida");
  if (body.warrantyUntil && !isDateOnly(body.warrantyUntil)) throw new Error("Fecha de garantía inválida");
  const cost = Number(body.acquisitionCost ?? 0);
  if (!Number.isFinite(cost) || cost < 0) throw new Error("El costo de adquisición no puede ser negativo");

  const depreciationBasis = body.depreciationBasis ? String(body.depreciationBasis) : "meses";
  if (!DEPRECIATION_BASES.has(depreciationBasis)) throw new Error("Base de depreciación inválida");

  const rawMonths = body.usefulLifeMonths;
  let usefulLifeMonths: number | null;
  if (resolved.isNonDepreciableLand) {
    usefulLifeMonths =
      rawMonths === "" || rawMonths === null || rawMonths === undefined ? 0 : Math.trunc(Number(rawMonths));
    if (!Number.isFinite(usefulLifeMonths) || usefulLifeMonths < 0 || usefulLifeMonths > 600) {
      throw new Error("La vida útil en meses debe estar entre 0 y 600");
    }
  } else {
    usefulLifeMonths =
      rawMonths === "" || rawMonths === null || rawMonths === undefined
        ? depreciationBasis === "meses"
          ? resolved.suggestedLifeMonths ?? 36
          : null
        : Math.trunc(Number(rawMonths));
    if (usefulLifeMonths !== null && (!Number.isFinite(usefulLifeMonths) || usefulLifeMonths <= 0 || usefulLifeMonths > 600)) {
      throw new Error("La vida útil en meses debe estar entre 1 y 600");
    }
  }

  const rawCycles = body.usefulLifeCycles;
  const usefulLifeCycles = resolved.isNonDepreciableLand
    ? null
    : rawCycles === "" || rawCycles === null || rawCycles === undefined
      ? depreciationBasis === "ciclos"
        ? 18
        : null
      : Math.trunc(Number(rawCycles));
  if (usefulLifeCycles !== null && (!Number.isFinite(usefulLifeCycles) || usefulLifeCycles <= 0 || usefulLifeCycles > 500)) {
    throw new Error("La vida útil en ciclos/lotes debe estar entre 1 y 500");
  }

  const hasExplicitResidual =
    body.residualValue !== "" && body.residualValue !== null && body.residualValue !== undefined;
  const residualValue = hasExplicitResidual
    ? Number(body.residualValue)
    : resolved.isNonDepreciableLand
      ? 0
      : computeSuggestedResidualCop(cost, resolved.suggestedResidualRate);
  if (!Number.isFinite(residualValue) || residualValue < 0) throw new Error("El valor residual no puede ser negativo");

  return {
    suggestedExpenseCatalogId: resolved.suggestedExpenseCatalogId,
    values: {
      name: body.name.trim(),
      category,
      capexCatalogId: rawCapexCatalogId ?? resolved.capexCatalogId,
      capexFamily: resolved.capexFamily,
      capexSubfamily: resolved.capexSubfamily,
      capexClassification: resolved.capexClassification,
      capexDestination: resolved.capexDestination,
      capexDriver: resolved.capexDriver,
      brand: cleanText(body.brand, 120, "Marca"),
      model: cleanText(body.model, 120, "Modelo"),
      serialNumber: cleanText(body.serialNumber, 150, "Número de serie"),
      acquisitionDate: body.acquisitionDate ? String(body.acquisitionDate) : null,
      acquisitionCost: cost.toFixed(2),
      usefulLifeMonths,
      usefulLifeCycles,
      residualValue: residualValue.toFixed(2),
      depreciationBasis,
      warrantyUntil: body.warrantyUntil ? String(body.warrantyUntil) : null,
      locationId: body.locationId ? String(body.locationId) : null,
      status,
      description: cleanText(body.description, 4000, "Descripción"),
      notes: cleanText(body.notes, 4000, "Notas"),
    },
  };
}

async function nextAssetCode(tx: any) {
  await tx.execute(sql`LOCK TABLE ${farmAssets} IN EXCLUSIVE MODE`);
  const rows = await tx.select({ code: farmAssets.code }).from(farmAssets);
  const max = rows.reduce((current: number, row: { code: string }) => {
    const match = /^ACT-(\d+)$/.exec(row.code);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `ACT-${String(max + 1).padStart(4, "0")}`;
}

async function validateLocation(locationId: string | null) {
  if (!locationId) return null;
  const [location] = await db.select({ id: farmLocations.id, status: farmLocations.status })
    .from(farmLocations).where(eq(farmLocations.id, locationId));
  if (!location || location.status !== "activa") throw new Error("Selecciona un lugar de manejo activo");
  return location;
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const activeOnly = new URL(req.url).searchParams.get("active") === "true";
  const rows = await db.select({ ...getTableColumns(farmAssets), locationName: farmLocations.name })
    .from(farmAssets)
    .leftJoin(farmLocations, eq(farmAssets.locationId, farmLocations.id))
    .where(activeOnly ? sql`${farmAssets.status} <> 'retirado'` : undefined)
    .orderBy(asc(farmAssets.name));
  return NextResponse.json(rows);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  let validated: ReturnType<typeof validateAsset>;
  try {
    validated = validateAsset(body);
    await validateLocation(validated.values.locationId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos del activo inválidos" }, { status: 400 });
  }
  const { values, suggestedExpenseCatalogId } = validated;
  const [created] = await db.transaction(async (tx) => {
    const code = await nextAssetCode(tx);
    const [inserted] = await tx.insert(farmAssets).values({ ...values, code }).returning();
    if (body.recordCashPurchase === true && Number(values.acquisitionCost) > 0) {
      const txDate = values.acquisitionDate || new Date().toISOString().slice(0, 10);
      await tx.insert(transactions).values({
        farmId: inserted.farmId,
        type: "egreso",
        category: "Equipamiento",
        description: `Compra CapEx: ${inserted.name} (${inserted.code})`,
        amount: values.acquisitionCost,
        date: txDate,
        sourceType: "farm_asset",
        sourceId: inserted.id,
        expenseCatalogId: suggestedExpenseCatalogId,
        expenseFamily: "22 Activos / inversión",
        expenseConcept: `Adquisición: ${inserted.capexFamily ? `${inserted.capexFamily} · ` : ""}${inserted.name}`,
        expenseTreatment: "CAPEX",
        expenseDriver: "EVENTO",
        capexCatalogId: inserted.capexCatalogId,
        capexFamily: inserted.capexFamily,
        notes: "Compra de activo/infraestructura diferida por vida útil",
      });
    }
    return [inserted];
  });
  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (typeof body.id !== "string" || !body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  let validated: ReturnType<typeof validateAsset>;
  try {
    validated = validateAsset(body);
    await validateLocation(validated.values.locationId);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Datos del activo inválidos" }, { status: 400 });
  }
  const [updated] = await db.update(farmAssets).set({ ...validated.values, updatedAt: new Date() })
    .where(eq(farmAssets.id, body.id)).returning();
  if (!updated) return NextResponse.json({ error: "Activo no encontrado" }, { status: 404 });
  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const [updated] = await db.update(farmAssets)
    .set({ status: "retirado", updatedAt: new Date() })
    .where(eq(farmAssets.id, id)).returning({ id: farmAssets.id });
  if (!updated) return NextResponse.json({ error: "Activo no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true, status: "retirado" });
});

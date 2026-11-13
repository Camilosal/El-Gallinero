import { isDateOnly } from "@/lib/date-validation";
import { db } from "@/db";
import {
  manureFactors, manureSales, manureAdjustments,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { daysSince, isTodayOrEarlierManureDate } from "@/lib/manure";
import { buildManureEstimate } from "@/lib/manure-estimate";
import { computeManureInventory } from "@/lib/inventory";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { resolveDimensions } from "@/lib/analytics-dimensions";
import {
  createManureAdjustment,
  createManureSale,
  deleteManureAdjustment,
  deleteManureSale,
} from "@/lib/manure-operations";

export const dynamic = "force-dynamic";


export const GET = withApiHandler(async () => {
  try {
    const { groups, totalKgPerDay } = await buildManureEstimate();

    // Usar inventario computado en lugar de mutar singleton
    const inventory = await computeManureInventory(totalKgPerDay);

    const [sales, adjustments] = await Promise.all([
      db.select().from(manureSales).orderBy(desc(manureSales.date)),
      db.select().from(manureAdjustments).orderBy(desc(manureAdjustments.date)),
    ]);

    return NextResponse.json({
      estimation: { groups, totalKgPerDay },
      inventory: { currentStockKg: inventory.summary.available, asOfDate: new Date().toISOString().split("T")[0] },
      sales,
      adjustments,
    });
  } catch (error) {
    console.error("Gallinaza GET error:", error);
    return NextResponse.json({ error: "Error cargando gallinaza" }, { status: 500 });
  }
});

export const POST = withApiHandler(async (req: NextRequest) => {
  try {
    const body = await safeParseJson(req);
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

    if (body.action === "factor") {
      const kg = Number(Number(body.kgPerBirdPerDay).toFixed(3));
      if (!body.id || !Number.isFinite(kg) || kg < 0) {
        return NextResponse.json({ error: "Factor inválido (debe ser un número ≥ 0)" }, { status: 400 });
      }
      const [updated] = await db.update(manureFactors).set({
        kgPerBirdPerDay: kg.toFixed(3),
        updatedAt: new Date(),
      }).where(eq(manureFactors.id, body.id)).returning();
      if (!updated) return NextResponse.json({ error: "Factor no encontrado" }, { status: 404 });
      return NextResponse.json(updated, { status: 200 });
    }

    if (body.action === "sale") {
      const quantityKg = Number(Number(body.quantityKg).toFixed(2));
      const pricePerKg = Number(Number(body.pricePerKg).toFixed(2));
      if (!isDateOnly(body.date) || !isTodayOrEarlierManureDate(body.date) || !Number.isFinite(quantityKg) || quantityKg <= 0 || !Number.isFinite(pricePerKg) || pricePerKg < 0) {
        return NextResponse.json({ error: "La fecha no puede ser futura y la cantidad/precio deben ser válidos" }, { status: 400 });
      }
      if (body.isCredit && body.dueDate && !isDateOnly(body.dueDate)) {
        return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
      }

      const sale = await db.transaction(async (tx) => {
        const dimRes = await resolveDimensions(tx, { species: body.species, locationId: body.locationId, batchId: body.batchId });
        if ("error" in dimRes) throw new Error(dimRes.error);
        return createManureSale(tx, {
          date: body.date,
          quantityKg,
          pricePerKg,
          presentation: body.presentation,
          buyer: body.buyer,
          notes: body.notes,
          species: dimRes.dimensions.species,
          locationId: dimRes.dimensions.locationId,
          batchId: dimRes.dimensions.batchId,
          isCredit: Boolean(body.isCredit),
          dueDate: body.dueDate || null,
        });
      });

      return NextResponse.json(sale, { status: 201 });
    }

    if (body.action === "adjust") {
      const deltaKg = Number(Number(body.deltaKg).toFixed(2));
      if (!isDateOnly(body.date) || !isTodayOrEarlierManureDate(body.date) || !Number.isFinite(deltaKg) || deltaKg === 0 || typeof body.reason !== "string" || !body.reason.trim()) {
        return NextResponse.json({ error: "La fecha no puede ser futura y el ajuste/motivo deben ser válidos" }, { status: 400 });
      }

      const adjustment = await db.transaction((tx) => createManureAdjustment(tx, {
        date: body.date,
        deltaKg,
        reason: body.reason,
      }));

      return NextResponse.json(adjustment, { status: 201 });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error) {
    console.error("Gallinaza POST error:", error);
    if (error instanceof Error && (error.message.startsWith("Stock insuficiente") || error.message.startsWith("No se puede eliminar"))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  try {
    const { searchParams } = new URL(req.url);
    const saleId = searchParams.get("saleId");
    const adjustId = searchParams.get("adjustId");

    if (saleId) {
      const deleted = await db.transaction((tx) => deleteManureSale(tx, saleId));
      if (!deleted) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    if (adjustId) {
      const deleted = await db.transaction((tx) => deleteManureAdjustment(tx, adjustId));
      if (!deleted) return NextResponse.json({ error: "Ajuste no encontrado" }, { status: 404 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "saleId o adjustId requerido" }, { status: 400 });
  } catch (error) {
    console.error("Gallinaza DELETE error:", error);
    if (error instanceof Error && (error.message.includes("pagos o cobros registrados") || error.message.includes("pagos registrados") || error.message.includes("cobros registrados"))) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && (error.message.startsWith("Stock insuficiente") || error.message.startsWith("No se puede eliminar"))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
});

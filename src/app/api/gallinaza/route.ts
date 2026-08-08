import { db } from "@/db";
import {
  hens, roosters, broilerBatches, catalogos,
  manureFactors, manureInventory, manureSales, manureAdjustments, transactions,
} from "@/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ageInWeeks, isAvailableForExit, stageForAge, type StageRange } from "@/lib/lifecycle";
import { estimatedKgPerDay, totalEstimatedKgPerDay, daysSince, type BirdGroupCount } from "@/lib/manure";

export const dynamic = "force-dynamic";

interface EstimationGroup extends BirdGroupCount {
  factorId: string | null;
  kgPerDay: number;
}

/** Calcula los grupos de aves con su factor (crea factores faltantes con 0) */
async function buildGroups(): Promise<{ groups: EstimationGroup[]; totalKgPerDay: number }> {
  const today = new Date();
  const [stages, allHens, factors] = await Promise.all([
    db.select().from(catalogos)
      .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
      .orderBy(sql`${catalogos.sortOrder}`),
    db.select({ birthDate: hens.birthDate, status: hens.status }).from(hens),
    db.select().from(manureFactors),
  ]);

  const [roosterCount, batchRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(roosters).where(eq(roosters.status, "activo")),
    db.select({ currentQuantity: broilerBatches.currentQuantity }).from(broilerBatches)
      .where(inArray(broilerBatches.status, ["activo", "listo_sacrificio"])),
  ]);

  const stageRanges: StageRange[] = stages.map((s) => ({
    id: s.id, value: s.value, minWeeks: s.minWeeks, maxWeeks: s.maxWeeks,
  }));

  // Contar gallinas por etapa (solo las que siguen en el gallinero)
  const countByStage = new Map<string, number>();
  for (const hen of allHens) {
    if (!isAvailableForExit(hen.status)) continue;
    const weeks = ageInWeeks(hen.birthDate, today);
    const stage = stageForAge(stageRanges, weeks);
    if (stage) countByStage.set(stage.id, (countByStage.get(stage.id) || 0) + 1);
  }

  const factorForStage = (stageId: string) => factors.find((f) => f.stageCatalogoId === stageId);
  const groups: EstimationGroup[] = [];

  for (const stage of stages) {
    let factor = factorForStage(stage.id);
    if (!factor) {
      // Etapa nueva sin factor: crearlo en 0 para que sea editable desde la UI
      const [created] = await db.insert(manureFactors).values({
        stageCatalogoId: stage.id, birdGroup: "etapa", kgPerBirdPerDay: "0",
      }).returning();
      factor = created;
    }
    const group: BirdGroupCount = {
      key: stage.id,
      label: stage.value,
      count: countByStage.get(stage.id) || 0,
      kgPerBirdPerDay: Number(factor.kgPerBirdPerDay),
    };
    groups.push({ ...group, factorId: factor.id, kgPerDay: estimatedKgPerDay(group) });
  }

  const galloFactor = factors.find((f) => f.birdGroup === "gallo");
  const gallosGroup: BirdGroupCount = {
    key: "gallo",
    label: "Gallos",
    count: roosterCount[0]?.count || 0,
    kgPerBirdPerDay: galloFactor ? Number(galloFactor.kgPerBirdPerDay) : 0,
  };
  groups.push({ ...gallosGroup, factorId: galloFactor?.id || null, kgPerDay: estimatedKgPerDay(gallosGroup) });

  const loteCount = batchRows.reduce((sum, b) => sum + b.currentQuantity, 0);
  const loteFactor = factors.find((f) => f.birdGroup === "lote");
  const lotesGroup: BirdGroupCount = {
    key: "lote",
    label: "Lotes de engorde",
    count: loteCount,
    kgPerBirdPerDay: loteFactor ? Number(loteFactor.kgPerBirdPerDay) : 0,
  };
  groups.push({ ...lotesGroup, factorId: loteFactor?.id || null, kgPerDay: estimatedKgPerDay(lotesGroup) });

  return { groups, totalKgPerDay: totalEstimatedKgPerDay(groups) };
}

/** Fila única de inventario; se crea si no existe */
async function getInventoryRow() {
  const [row] = await db.select().from(manureInventory);
  if (row) return row;
  const [created] = await db.insert(manureInventory).values({
    currentStockKg: "0",
    lastAccumulatedDate: new Date().toISOString().split("T")[0],
  }).returning();
  return created;
}

export async function GET() {
  try {
    const { groups, totalKgPerDay } = await buildGroups();
    const todayStr = new Date().toISOString().split("T")[0];

    // Lazy-sync: acumular la producción estimada de los días transcurridos
    const inv = await getInventoryRow();
    const days = daysSince(inv.lastAccumulatedDate);
    let stockKg = Number(inv.currentStockKg);
    if (days > 0 && totalKgPerDay > 0) {
      stockKg = Math.round((stockKg + days * totalKgPerDay) * 100) / 100;
      await db.update(manureInventory).set({
        currentStockKg: stockKg.toFixed(2),
        lastAccumulatedDate: todayStr,
        updatedAt: new Date(),
      }).where(eq(manureInventory.id, inv.id));
    } else if (days > 0) {
      await db.update(manureInventory).set({
        lastAccumulatedDate: todayStr,
        updatedAt: new Date(),
      }).where(eq(manureInventory.id, inv.id));
    }

    const [sales, adjustments] = await Promise.all([
      db.select().from(manureSales).orderBy(desc(manureSales.date)),
      db.select().from(manureAdjustments).orderBy(desc(manureAdjustments.date)),
    ]);

    return NextResponse.json({
      estimation: { groups, totalKgPerDay },
      inventory: { currentStockKg: stockKg, lastAccumulatedDate: todayStr },
      sales,
      adjustments,
    });
  } catch (error) {
    console.error("Gallinaza GET error:", error);
    return NextResponse.json({ error: "Error cargando gallinaza" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const todayStr = new Date().toISOString().split("T")[0];

    if (body.action === "factor") {
      const kg = Number(body.kgPerBirdPerDay);
      if (!body.id || isNaN(kg) || kg < 0) {
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
      const quantityKg = Number(body.quantityKg);
      const pricePerKg = Number(body.pricePerKg);
      if (!body.date || isNaN(quantityKg) || quantityKg <= 0 || isNaN(pricePerKg) || pricePerKg < 0) {
        return NextResponse.json({ error: "Fecha, cantidad kg y precio/kg son obligatorios" }, { status: 400 });
      }
      const totalAmount = (quantityKg * pricePerKg).toFixed(2);
      const inv = await getInventoryRow();
      if (quantityKg > Number(inv.currentStockKg)) {
        return NextResponse.json({ error: `Stock insuficiente (disponible: ${Number(inv.currentStockKg).toFixed(2)} kg)` }, { status: 400 });
      }

      const sale = await db.transaction(async (tx) => {
        const [created] = await tx.insert(manureSales).values({
          date: body.date,
          quantityKg: quantityKg.toFixed(2),
          pricePerKg: pricePerKg.toFixed(2),
          totalAmount,
          presentation: body.presentation || null,
          buyer: body.buyer || null,
          notes: body.notes || null,
        }).returning();

        await tx.update(manureInventory).set({
          currentStockKg: (Number(inv.currentStockKg) - quantityKg).toFixed(2),
          updatedAt: new Date(),
        }).where(eq(manureInventory.id, inv.id));

        await tx.insert(transactions).values({
          date: body.date,
          type: "ingreso",
          category: "Venta de abono/gallinaza",
          description: `Venta de gallinaza (${quantityKg} kg)`,
          counterparty: body.buyer || null,
          amount: totalAmount,
          quantity: quantityKg.toFixed(2),
          unitPrice: pricePerKg.toFixed(2),
          unit: "kg",
          sourceType: "gallinaza",
          sourceId: created.id,
          notes: body.notes || null,
        });

        return created;
      });

      return NextResponse.json(sale, { status: 201 });
    }

    if (body.action === "adjust") {
      const deltaKg = Number(body.deltaKg);
      if (!body.date || isNaN(deltaKg) || deltaKg === 0 || !body.reason) {
        return NextResponse.json({ error: "Fecha, ajuste en kg (≠ 0) y motivo son obligatorios" }, { status: 400 });
      }
      const inv = await getInventoryRow();
      const newStock = Number(inv.currentStockKg) + deltaKg;
      if (newStock < 0) {
        return NextResponse.json({ error: `El ajuste dejaría el stock en negativo (disponible: ${Number(inv.currentStockKg).toFixed(2)} kg)` }, { status: 400 });
      }

      const adjustment = await db.transaction(async (tx) => {
        const [created] = await tx.insert(manureAdjustments).values({
          date: body.date,
          deltaKg: deltaKg.toFixed(2),
          reason: body.reason,
        }).returning();
        await tx.update(manureInventory).set({
          currentStockKg: newStock.toFixed(2),
          updatedAt: new Date(),
        }).where(eq(manureInventory.id, inv.id));
        return created;
      });

      return NextResponse.json(adjustment, { status: 201 });
    }

    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  } catch (error) {
    console.error("Gallinaza POST error:", error);
    return NextResponse.json({ error: "Error al guardar" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const saleId = searchParams.get("saleId");
    const adjustId = searchParams.get("adjustId");

    if (saleId) {
      const [sale] = await db.select().from(manureSales).where(eq(manureSales.id, saleId));
      if (!sale) return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });

      await db.transaction(async (tx) => {
        const [inv] = await tx.select().from(manureInventory);
        await tx.update(manureInventory).set({
          currentStockKg: (Number(inv.currentStockKg) + Number(sale.quantityKg)).toFixed(2),
          updatedAt: new Date(),
        }).where(eq(manureInventory.id, inv.id));
        await tx.delete(transactions).where(and(eq(transactions.sourceType, "gallinaza"), eq(transactions.sourceId, saleId)));
        await tx.delete(manureSales).where(eq(manureSales.id, saleId));
      });
      return NextResponse.json({ ok: true });
    }

    if (adjustId) {
      const [adjustment] = await db.select().from(manureAdjustments).where(eq(manureAdjustments.id, adjustId));
      if (!adjustment) return NextResponse.json({ error: "Ajuste no encontrado" }, { status: 404 });

      await db.transaction(async (tx) => {
        const [inv] = await tx.select().from(manureInventory);
        const newStock = Math.max(0, Number(inv.currentStockKg) - Number(adjustment.deltaKg));
        await tx.update(manureInventory).set({
          currentStockKg: newStock.toFixed(2),
          updatedAt: new Date(),
        }).where(eq(manureInventory.id, inv.id));
        await tx.delete(manureAdjustments).where(eq(manureAdjustments.id, adjustId));
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "saleId o adjustId requerido" }, { status: 400 });
  } catch (error) {
    console.error("Gallinaza DELETE error:", error);
    return NextResponse.json({ error: "Error al eliminar" }, { status: 500 });
  }
}

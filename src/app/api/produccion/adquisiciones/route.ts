import { db } from "@/db";
import {
  birdAcquisitions, hens, roosters, broilerBatches, transactions,
  incubation, chickenSales, slaughter, mortalityRecords, eggProduction, autoconsumoLogs, weightLogs,
} from "@/db/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { deleteTransactionsAndUnpaidAccounts, upsertExpenseTransaction } from "@/lib/financial-records";

export const dynamic = "force-dynamic";

/** Generate next sequential codes inside a transaction */
async function nextCodesInTx(tx: any, table: any, prefix: string, count: number): Promise<string[]> {
  const existingCodes = (await tx.select({ code: table.code }).from(table)).map((r: any) => r.code);
  let max = 0;
  const re = new RegExp(`^${prefix.replace("-", "\\-")}-(\\d+)$`);
  for (const code of existingCodes) {
    const m = code.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + i + 1).padStart(3, "0")}`);
}

export const GET = withApiHandler(async () => {
  const data = await db.select().from(birdAcquisitions).orderBy(desc(birdAcquisitions.createdAt));
  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { date, acquisitionType, birdType, quantity, unitCost, supplier, breed, birthDate, notes } = body;
  const quantityNumber = Number(quantity);

  if (!date || !acquisitionType || !birdType || !Number.isInteger(quantityNumber) || quantityNumber < 1) {
    return NextResponse.json({ error: "Fecha, tipo, especie y cantidad son requeridos" }, { status: 400 });
  }
  if (!["compra", "donacion", "pollito_comprado"].includes(acquisitionType)) {
    return NextResponse.json({ error: "Tipo de adquisición inválido" }, { status: 400 });
  }
  if (!["gallina", "gallo", "lote_pollos"].includes(birdType)) {
    return NextResponse.json({ error: "Tipo de ave inválido" }, { status: 400 });
  }
  if (!Number.isFinite(new Date(date).getTime())) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const unitCostNumber = unitCost == null || unitCost === "" ? null : Number(unitCost);
  if (acquisitionType !== "donacion" && (!Number.isFinite(unitCostNumber) || unitCostNumber! <= 0)) {
    return NextResponse.json({ error: "El costo unitario debe ser mayor que cero" }, { status: 400 });
  }
  if (unitCostNumber != null && (!Number.isFinite(unitCostNumber) || unitCostNumber < 0)) {
    return NextResponse.json({ error: "Costo unitario inválido" }, { status: 400 });
  }

  const totalCost = acquisitionType !== "donacion" ? unitCostNumber! * quantityNumber : null;
  const today = birthDate || new Date().toISOString().split("T")[0];

  const result = await db.transaction(async (tx) => {
    const [acquisition] = await tx.insert(birdAcquisitions).values({
      date,
      acquisitionType,
      birdType,
      quantity: quantityNumber,
      unitCost: unitCostNumber == null ? null : String(unitCostNumber),
      totalCost: totalCost == null ? null : String(totalCost),
      supplier: supplier || null,
      breed: breed || null,
      birthDate: today,
      notes: notes || null,
    }).returning();

    let createdBirdIds: string[] = [];

    if (birdType === "gallina") {
      await tx.execute(sql`LOCK TABLE ${hens} IN EXCLUSIVE MODE`);
      const codes = await nextCodesInTx(tx, hens, "G", quantityNumber);
      const inserted = await tx.insert(hens).values(
        codes.map((code) => ({
          code,
          breed: breed || "Criolla",
          birthDate: today,
          status: "activa" as const,
          isBroody: false,
          acquisitionId: acquisition.id,
        }))
      ).returning();
      createdBirdIds = inserted.map((h) => h.id);
    } else if (birdType === "gallo") {
      await tx.execute(sql`LOCK TABLE ${roosters} IN EXCLUSIVE MODE`);
      const codes = await nextCodesInTx(tx, roosters, "GA", quantityNumber);
      const inserted = await tx.insert(roosters).values(
        codes.map((code) => ({
          code,
          breed: breed || "Criolla",
          birthDate: today,
          status: "activo" as const,
          acquisitionId: acquisition.id,
        }))
      ).returning();
      createdBirdIds = inserted.map((r) => r.id);
    } else if (birdType === "lote_pollos") {
      // Lock to prevent concurrent batch code generation
      await tx.execute(sql`LOCK TABLE ${broilerBatches} IN EXCLUSIVE MODE`);
      const existingCodes = await tx.select({ code: broilerBatches.code }).from(broilerBatches);
      let max = 0;
      for (const row of existingCodes) {
        const m = String(row.code).match(/^L-(\d+)$/);
        if (m) max = Math.max(max, Number(m[1]));
      }
      const code = `L-${String(max + 1).padStart(3, "0")}`;
      const [batch] = await tx.insert(broilerBatches).values({
        code,
        breed: breed || "Pollo de engorde",
        startDate: today,
        initialQuantity: quantityNumber,
        currentQuantity: quantityNumber,
        acquisitionId: acquisition.id,
        notes: notes || `Lote adquirido por ${acquisitionType}`,
      }).returning();
      createdBirdIds = [batch.id];
    }

    if (acquisitionType !== "donacion" && totalCost != null) {
      const birdLabel = birdType === "gallina" ? "gallinas" : birdType === "gallo" ? "gallos" : "pollos";
      await tx.insert(transactions).values({
        date,
        type: "egreso",
        category: "Compra de aves",
        description: `Compra de ${quantity} ${birdLabel}${breed ? ` (${breed})` : ""}${supplier ? ` a ${supplier}` : ""}`,
        counterparty: supplier || null,
        amount: String(totalCost),
        quantity: String(quantityNumber),
        unitPrice: unitCostNumber == null ? null : String(unitCostNumber),
        unit: "aves",
        sourceType: "adquisicion",
        sourceId: acquisition.id,
        notes: notes || null,
      });
    }

    return { ...acquisition, createdBirdIds };
  });

  return NextResponse.json(result, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(birdAcquisitions).where(eq(birdAcquisitions.id, body.id)).for("update");
    if (!existing) throw new Error("No encontrado");

    const date = body.date ?? existing.date;
    const acquisitionType = body.acquisitionType ?? existing.acquisitionType;
    const unitCost = body.unitCost !== undefined
      ? (body.unitCost === "" || body.unitCost == null ? null : Number(body.unitCost))
      : (existing.unitCost == null ? null : Number(existing.unitCost));
    if (!Number.isFinite(new Date(date).getTime())) throw new Error("Fecha inválida");
    if (!["compra", "donacion", "pollito_comprado"].includes(acquisitionType)) throw new Error("Tipo de adquisición inválido");
    if (acquisitionType !== "donacion" && (!Number.isFinite(unitCost) || unitCost! <= 0)) {
      throw new Error("El costo unitario debe ser mayor que cero");
    }
    if (unitCost != null && (!Number.isFinite(unitCost) || unitCost < 0)) throw new Error("Costo unitario inválido");

    const totalCost = acquisitionType === "donacion" ? null : unitCost! * existing.quantity;
    const nextBreed = body.breed !== undefined ? body.breed : existing.breed;
    const nextBirthDate = body.birthDate !== undefined ? body.birthDate : existing.birthDate;
    if (nextBirthDate && !Number.isFinite(new Date(nextBirthDate).getTime())) throw new Error("Fecha de nacimiento inválida");
    const [row] = await tx.update(birdAcquisitions).set({
      date,
      acquisitionType,
      unitCost: acquisitionType === "donacion" ? null : unitCost == null ? null : String(unitCost),
      totalCost: totalCost == null ? null : String(totalCost),
      supplier: body.supplier !== undefined ? body.supplier : existing.supplier,
      breed: nextBreed,
      birthDate: nextBirthDate,
      notes: body.notes !== undefined ? body.notes : existing.notes,
    }).where(eq(birdAcquisitions.id, body.id)).returning();

    if (body.breed !== undefined || body.birthDate !== undefined) {
      const birdValues = {
        ...(body.breed !== undefined ? { breed: body.breed } : {}),
        ...(body.birthDate !== undefined ? { birthDate: body.birthDate } : {}),
        updatedAt: new Date(),
      };
      if (existing.birdType === "gallina") await tx.update(hens).set(birdValues).where(eq(hens.acquisitionId, body.id));
      else if (existing.birdType === "gallo") await tx.update(roosters).set(birdValues).where(eq(roosters.acquisitionId, body.id));
      else if (existing.birdType === "lote_pollos") await tx.update(broilerBatches).set(birdValues).where(eq(broilerBatches.acquisitionId, body.id));
    }

    const transactionCondition = and(eq(transactions.sourceType, "adquisicion"), eq(transactions.sourceId, body.id));
    if (acquisitionType === "donacion") {
      await deleteTransactionsAndUnpaidAccounts(tx, transactionCondition);
    } else {
      const birdLabel = existing.birdType === "gallina" ? "gallinas" : existing.birdType === "gallo" ? "gallos" : "pollos";
      await upsertExpenseTransaction(tx, {
        condition: transactionCondition,
        date,
        category: "Compra de aves",
        description: `Compra de ${existing.quantity} ${birdLabel}${row.breed ? ` (${row.breed})` : ""}${row.supplier ? ` a ${row.supplier}` : ""}`,
        amount: String(totalCost),
        sourceType: "adquisicion",
        sourceId: body.id,
        counterparty: row.supplier,
      });
    }

    return row;
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    const [acquisition] = await tx.select().from(birdAcquisitions).where(eq(birdAcquisitions.id, id)).for("update");
    if (!acquisition) throw new Error("No encontrada");

    const acquisitionBirds = acquisition.birdType === "gallina"
      ? await tx.select({ id: hens.id, status: hens.status }).from(hens).where(eq(hens.acquisitionId, id)).for("update")
      : acquisition.birdType === "gallo"
        ? await tx.select({ id: roosters.id, status: roosters.status }).from(roosters).where(eq(roosters.acquisitionId, id)).for("update")
        : acquisition.birdType === "lote_pollos"
          ? await tx.select({ id: broilerBatches.id, status: broilerBatches.status, currentQuantity: broilerBatches.currentQuantity, initialQuantity: broilerBatches.initialQuantity }).from(broilerBatches).where(eq(broilerBatches.acquisitionId, id)).for("update")
          : [];
    const birdIds = acquisitionBirds.map((bird) => bird.id);
    if (birdIds.length > 0) {
      const hasExited = acquisitionBirds.some((bird) => ["vendida", "vendido", "faena", "muerta", "muerto"].includes(String(bird.status))) ||
        acquisitionBirds.some((bird) => "currentQuantity" in bird && Number(bird.currentQuantity) !== Number(bird.initialQuantity));
      if (hasExited) throw new Error("No se puede eliminar la adquisición porque las aves asociadas ya salieron del inventario");

      let hasLinkedActivity = false;
      if (acquisition.birdType === "gallina") {
        hasLinkedActivity = (await tx.select({ id: incubation.id }).from(incubation).where(inArray(incubation.henId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: chickenSales.id }).from(chickenSales).where(inArray(chickenSales.henId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: slaughter.id }).from(slaughter).where(inArray(slaughter.henId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(inArray(mortalityRecords.henId, birdIds)).limit(1)).length > 0;
      } else if (acquisition.birdType === "gallo") {
        hasLinkedActivity = (await tx.select({ id: chickenSales.id }).from(chickenSales).where(inArray(chickenSales.roosterId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: slaughter.id }).from(slaughter).where(inArray(slaughter.roosterId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(inArray(mortalityRecords.roosterId, birdIds)).limit(1)).length > 0;
      } else if (acquisition.birdType === "lote_pollos") {
        hasLinkedActivity = (await tx.select({ id: chickenSales.id }).from(chickenSales).where(inArray(chickenSales.batchId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: slaughter.id }).from(slaughter).where(inArray(slaughter.batchId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: mortalityRecords.id }).from(mortalityRecords).where(inArray(mortalityRecords.batchId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: eggProduction.id }).from(eggProduction).where(inArray(eggProduction.batchId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: autoconsumoLogs.id }).from(autoconsumoLogs).where(inArray(autoconsumoLogs.batchId, birdIds)).limit(1)).length > 0 ||
          (await tx.select({ id: weightLogs.id }).from(weightLogs).where(inArray(weightLogs.batchId, birdIds)).limit(1)).length > 0;
      }
      if (hasLinkedActivity) throw new Error("No se puede eliminar la adquisición porque las aves asociadas tienen movimientos registrados");
    }

    if (acquisition.birdType === "gallina") {
      await tx.delete(hens).where(eq(hens.acquisitionId, id));
    } else if (acquisition.birdType === "gallo") {
      await tx.delete(roosters).where(eq(roosters.acquisitionId, id));
    } else if (acquisition.birdType === "lote_pollos") {
      await tx.delete(broilerBatches).where(eq(broilerBatches.acquisitionId, id));
    }

    if (acquisition.acquisitionType !== "donacion") {
      await deleteTransactionsAndUnpaidAccounts(
        tx,
        and(eq(transactions.sourceType, "adquisicion"), eq(transactions.sourceId, id)),
      );
    }

    await tx.delete(birdAcquisitions).where(eq(birdAcquisitions.id, id));
  });

  return NextResponse.json({ ok: true });
});

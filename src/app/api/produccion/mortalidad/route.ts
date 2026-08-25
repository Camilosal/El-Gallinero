import { db } from "@/db";
import { mortalityRecords, hens, roosters, broilerBatches, slaughter, chickenSales } from "@/db/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const period = Number(searchParams.get("period")) || 30;

  const records = await db
    .select({
      id: mortalityRecords.id,
      date: mortalityRecords.date,
      birdType: mortalityRecords.birdType,
      quantity: mortalityRecords.quantity,
      cause: mortalityRecords.cause,
      henId: mortalityRecords.henId,
      roosterId: mortalityRecords.roosterId,
      batchId: mortalityRecords.batchId,
      description: mortalityRecords.description,
      createdAt: mortalityRecords.createdAt,
      henCode: hens.code,
      roosterCode: roosters.code,
      batchCode: broilerBatches.code,
    })
    .from(mortalityRecords)
    .leftJoin(hens, eq(mortalityRecords.henId, hens.id))
    .leftJoin(roosters, eq(mortalityRecords.roosterId, roosters.id))
    .leftJoin(broilerBatches, eq(mortalityRecords.batchId, broilerBatches.id))
    .orderBy(desc(mortalityRecords.createdAt));

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period);
  const cutoffStr = cutoff.toISOString().split("T")[0];

  const [periodRecords] = await db
    .select({ total: sql<number>`coalesce(sum(${mortalityRecords.quantity}), 0)::int` })
    .from(mortalityRecords)
    .where(gte(mortalityRecords.date, cutoffStr));

  const [henCount] = await db.select({ count: sql<number>`count(*)::int` }).from(hens).where(eq(hens.status, "activa"));
  const [roosterCount] = await db.select({ count: sql<number>`count(*)::int` }).from(roosters).where(eq(roosters.status, "activo"));
  const totalFlock = (henCount?.count || 0) + (roosterCount?.count || 0);
  const totalDeaths = periodRecords?.total || 0;
  const mortalityRate = totalFlock > 0 ? ((totalDeaths / totalFlock) * 100).toFixed(2) : "0";

  const byCause = await db
    .select({ cause: mortalityRecords.cause, total: sql<number>`sum(${mortalityRecords.quantity})::int` })
    .from(mortalityRecords)
    .where(gte(mortalityRecords.date, cutoffStr))
    .groupBy(mortalityRecords.cause);

  return NextResponse.json({ records, mortalityRate: Number(mortalityRate), totalDeaths, totalFlock, byCause, periodDays: period });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { date, birdType, cause, henId, roosterId, batchId, quantity, description } = body;

  if (!date || !birdType || !cause) {
    return NextResponse.json({ error: "Fecha, tipo de ave y causa son requeridos" }, { status: 400 });
  }

  const qty = birdType === "lote_pollos" ? Number(quantity || 1) : 1;

  try {
    const result = await db.transaction(async (tx) => {
      if (birdType === "gallina" && henId) {
        const [hen] = await tx.select().from(hens).where(eq(hens.id, henId));
        if (!hen) throw new Error("Gallina no encontrada");
        if (!isAvailableForExit(hen.status) && hen.status !== "activa" && hen.status !== "enferma") {
          throw new Error(`La gallina no está disponible (status: ${hen.status})`);
        }
        await tx.update(hens).set({ status: "muerta", updatedAt: new Date() }).where(eq(hens.id, henId));
      }

      if (birdType === "gallo" && roosterId) {
        const [rooster] = await tx.select().from(roosters).where(eq(roosters.id, roosterId));
        if (!rooster) throw new Error("Gallo no encontrado");
        await tx.update(roosters).set({ status: "muerto", updatedAt: new Date() }).where(eq(roosters.id, roosterId));
      }

      if (birdType === "lote_pollos" && batchId) {
        const [batch] = await tx.select().from(broilerBatches).where(eq(broilerBatches.id, batchId));
        if (!batch) throw new Error("Lote no encontrado");
        if (qty > batch.currentQuantity) {
          throw new Error("Cantidad excede aves en el lote");
        }
        const newQty = batch.currentQuantity - qty;
        await tx.update(broilerBatches).set({
          currentQuantity: newQty,
          status: newQty === 0 ? "faena" : batch.status,
          updatedAt: new Date(),
        }).where(eq(broilerBatches.id, batchId));
      }

      const [created] = await tx.insert(mortalityRecords).values({
        date,
        birdType,
        quantity: qty,
        cause,
        henId: henId || null,
        roosterId: roosterId || null,
        batchId: batchId || null,
        description: description || null,
      }).returning();

      return created;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    const msg = err.message || "Error al registrar mortalidad";
    if (msg.includes("no encontrad")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [record] = await db.select().from(mortalityRecords).where(eq(mortalityRecords.id, id));
  if (!record) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  await db.transaction(async (tx) => {
    if (record.henId) {
      // Only restore hen if no other exit records exist
      const [hasSlaughter] = await tx.select({ id: slaughter.id })
        .from(slaughter).where(eq(slaughter.henId, record.henId)).limit(1);
      const [hasSale] = await tx.select({ id: chickenSales.id })
        .from(chickenSales).where(eq(chickenSales.henId, record.henId)).limit(1);
      const [otherMortality] = await tx.select({ id: mortalityRecords.id })
        .from(mortalityRecords)
        .where(and(eq(mortalityRecords.henId, record.henId), sql`${mortalityRecords.id} != ${record.id}`))
        .limit(1);
      if (!hasSlaughter && !hasSale && !otherMortality) {
        await tx.update(hens).set({ status: "activa", updatedAt: new Date() }).where(eq(hens.id, record.henId));
      }
    }
    if (record.roosterId) {
      // Only restore rooster if no other exit records exist
      const [otherMortality] = await tx.select({ id: mortalityRecords.id })
        .from(mortalityRecords)
        .where(and(eq(mortalityRecords.roosterId, record.roosterId), sql`${mortalityRecords.id} != ${record.id}`))
        .limit(1);
      if (!otherMortality) {
        await tx.update(roosters).set({ status: "activo", updatedAt: new Date() }).where(eq(roosters.id, record.roosterId));
      }
    }
    if (record.batchId) {
      const [batch] = await tx.select().from(broilerBatches).where(eq(broilerBatches.id, record.batchId));
      if (batch) {
        const newQty = batch.currentQuantity + record.quantity;
        await tx.update(broilerBatches).set({
          currentQuantity: newQty,
          status: batch.status === "faena" ? "activo" : batch.status,
          updatedAt: new Date(),
        }).where(eq(broilerBatches.id, record.batchId));
      }
    }
    await tx.delete(mortalityRecords).where(eq(mortalityRecords.id, id));
  });

  return NextResponse.json({ ok: true });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const { date, birdType, cause, description } = body;
  if (!date || !birdType || !cause) {
    return NextResponse.json({ error: "Fecha, tipo de ave y causa son requeridos" }, { status: 400 });
  }

  const [existing] = await db.select().from(mortalityRecords).where(eq(mortalityRecords.id, body.id));
  if (!existing) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  try {
    await db.transaction(async (tx) => {
      // Restore old bird status only if no other exit records exist
      if (existing.henId) {
        const [hasSlaughter] = await tx.select({ id: slaughter.id })
          .from(slaughter).where(eq(slaughter.henId, existing.henId)).limit(1);
        const [hasSale] = await tx.select({ id: chickenSales.id })
          .from(chickenSales).where(eq(chickenSales.henId, existing.henId)).limit(1);
        if (!hasSlaughter && !hasSale) {
          await tx.update(hens).set({ status: "activa", updatedAt: new Date() }).where(eq(hens.id, existing.henId));
        }
      }
      if (existing.roosterId) {
        await tx.update(roosters).set({ status: "activo", updatedAt: new Date() }).where(eq(roosters.id, existing.roosterId));
      }
      if (existing.batchId) {
        const [batch] = await tx.select().from(broilerBatches).where(eq(broilerBatches.id, existing.batchId));
        if (batch) {
          const newQty = batch.currentQuantity + existing.quantity;
          await tx.update(broilerBatches).set({
            currentQuantity: newQty,
            status: batch.status === "faena" ? "activo" : batch.status,
            updatedAt: new Date(),
          }).where(eq(broilerBatches.id, existing.batchId));
        }
      }

      // Update the record
      await tx.update(mortalityRecords).set({
        date,
        birdType,
        cause,
        description: description || null,
      }).where(eq(mortalityRecords.id, body.id));

      // Apply new bird status — only if not already exited by another record
      if (existing.henId) {
        const [hasSlaughter] = await tx.select({ id: slaughter.id })
          .from(slaughter).where(eq(slaughter.henId, existing.henId)).limit(1);
        const [hasSale] = await tx.select({ id: chickenSales.id })
          .from(chickenSales).where(eq(chickenSales.henId, existing.henId)).limit(1);
        if (!hasSlaughter && !hasSale) {
          await tx.update(hens).set({ status: "muerta", updatedAt: new Date() }).where(eq(hens.id, existing.henId));
        }
      }
      if (existing.roosterId) {
        await tx.update(roosters).set({ status: "muerto", updatedAt: new Date() }).where(eq(roosters.id, existing.roosterId));
      }
      if (existing.batchId) {
        const [batch] = await tx.select().from(broilerBatches).where(eq(broilerBatches.id, existing.batchId));
        if (batch) {
          const newQty = batch.currentQuantity - existing.quantity;
          await tx.update(broilerBatches).set({
            currentQuantity: Math.max(0, newQty),
            status: newQty === 0 ? "faena" : batch.status,
            updatedAt: new Date(),
          }).where(eq(broilerBatches.id, existing.batchId));
        }
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar" }, { status: 400 });
  }

  const [updated] = await db.select().from(mortalityRecords).where(eq(mortalityRecords.id, body.id));
  return NextResponse.json(updated);
});

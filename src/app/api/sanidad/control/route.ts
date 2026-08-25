import { db } from "@/db";
import { healthControl, transactions, hens, roosters, mortalityRecords, supplyInventory, supplyMovements, sanitaryCalendar } from "@/db/schema";
import { eq, desc, and, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const data = await db.select().from(healthControl).orderBy(desc(healthControl.date));
  return NextResponse.json(data);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function markAffectedAsSick(type: string, affectedHens: string | null, client: any = db) {
  const affected = (affectedHens || "").trim();
  if (type === "tratamiento" && affected && affected.toLowerCase() !== "todas") {
    const codes = affected.split(",").map((c: string) => c.trim()).filter(Boolean);
    if (codes.length > 0) {
      const match = await client.select({ id: hens.id }).from(hens).where(inArray(hens.code, codes));
      const ids = match.map((m: { id: string }) => m.id);
      if (ids.length > 0) {
        await client.update(hens).set({ status: "enferma", updatedAt: new Date() }).where(inArray(hens.id, ids));
      }
    }
  }
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);

  const created = await db.transaction(async (tx) => {
    // 1. Insert health control record
    const [record] = await tx.insert(healthControl).values({
      date: body.date,
      type: body.type,
      description: body.description,
      affectedHens: body.affectedHens || null,
      product: body.product || null,
      cost: body.cost || "0",
      nextScheduled: body.nextScheduled || null,
      notes: body.notes || null,
    }).returning();

    // 2. Register expense if cost > 0
    if (Number(body.cost) > 0) {
      await tx.insert(transactions).values({
        date: body.date,
        type: "egreso",
        category: "Control sanitario",
        description: `${body.type}: ${body.description}`,
        amount: body.cost,
        sourceType: "sanidad",
        sourceId: record.id,
      });
    }

    // 3. Mark affected hens as sick
    await markAffectedAsSick(body.type, body.affectedHens, tx);

    // 4. Record mortality if animals died
    if (body.deaths && body.deaths.length > 0) {
      await tx.insert(mortalityRecords).values(
        body.deaths.map((d: { birdType: string; quantity: number; henId?: string; roosterId?: string; batchId?: string; cause?: string }) => ({
          date: body.date,
          birdType: d.birdType || "gallina",
          quantity: d.quantity || 1,
          cause: (d.cause || "enfermedad") as any,
          henId: d.henId || null,
          roosterId: d.roosterId || null,
          batchId: d.batchId || null,
          healthControlId: record.id,
          description: body.description || null,
        }))
      );
      // Update hen/rooster statuses to dead
      for (const d of body.deaths) {
        if (d.henId) {
          await tx.update(hens).set({ status: "muerta", updatedAt: new Date() }).where(eq(hens.id, d.henId));
        }
        if (d.roosterId) {
          await tx.update(roosters).set({ status: "muerto", updatedAt: new Date() }).where(eq(roosters.id, d.roosterId));
        }
      }
    }

    // 5. Discount supplies used — relative SQL update to avoid race conditions
    if (body.supplies && body.supplies.length > 0) {
      for (const s of body.supplies) {
        const qty = Number(s.quantity);
        if (qty <= 0) continue;
        // Create movement
        await tx.insert(supplyMovements).values({
          supplyId: s.supplyId,
          quantity: String(qty),
          isEntry: false,
          movementType: "uso",
          date: body.date,
          healthControlId: record.id,
          notes: `Usado en: ${body.description || body.type}`,
        });
        // Decrement stock with relative SQL
        await tx.update(supplyInventory).set({
          currentStock: sql`GREATEST(0, ${supplyInventory.currentStock}::numeric - ${qty})`,
          updatedAt: new Date(),
        }).where(eq(supplyInventory.id, s.supplyId));
      }
    }

    // 6. Advance sanitary calendar if matching type found
    const [calEntry] = await tx.select().from(sanitaryCalendar)
      .where(and(eq(sanitaryCalendar.type, body.type), eq(sanitaryCalendar.isActive, true)))
      .limit(1);
    if (calEntry && calEntry.frequencyDays) {
      const nextDate = new Date(body.date);
      nextDate.setDate(nextDate.getDate() + calEntry.frequencyDays);
      await tx.update(sanitaryCalendar).set({
        nextDueDate: nextDate.toISOString().split("T")[0],
        lastHealthControlId: record.id,
        updatedAt: new Date(),
      }).where(eq(sanitaryCalendar.id, calEntry.id));
    }

    return record;
  });

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const updated = await db.transaction(async (tx) => {
    // 1. Update health control record
    const [record] = await tx.update(healthControl).set({
      date: body.date,
      type: body.type,
      description: body.description,
      affectedHens: body.affectedHens || null,
      product: body.product || null,
      cost: body.cost || "0",
      nextScheduled: body.nextScheduled || null,
      notes: body.notes || null,
    }).where(eq(healthControl.id, body.id)).returning();

    if (!record) throw new Error("No encontrado");

    // 2. Sync linked expense transaction (delete + reinsert)
    await tx.delete(transactions).where(and(eq(transactions.sourceType, "sanidad"), eq(transactions.sourceId, body.id)));
    if (Number(body.cost) > 0) {
      await tx.insert(transactions).values({
        date: body.date,
        type: "egreso",
        category: "Control sanitario",
        description: `${body.type}: ${body.description}`,
        amount: body.cost,
        sourceType: "sanidad",
        sourceId: body.id,
      });
    }

    // 3. Mark affected hens as sick
    await markAffectedAsSick(body.type, body.affectedHens, tx);

    // 4. Reverse old supply movements and restore stock (relative SQL)
    const oldMovements = await tx.select().from(supplyMovements).where(eq(supplyMovements.healthControlId, body.id));
    for (const m of oldMovements) {
      if (!m.isEntry) {
        const qty = Number(m.quantity);
        await tx.update(supplyInventory).set({
          currentStock: sql`(${supplyInventory.currentStock}::numeric + ${qty})`,
          updatedAt: new Date(),
        }).where(eq(supplyInventory.id, m.supplyId));
      }
    }
    await tx.delete(supplyMovements).where(eq(supplyMovements.healthControlId, body.id));

    // 5. Re-create supply movements from new body data (relative SQL)
    if (body.supplies && body.supplies.length > 0) {
      for (const s of body.supplies) {
        const qty = Number(s.quantity);
        if (qty <= 0) continue;
        await tx.insert(supplyMovements).values({
          supplyId: s.supplyId,
          quantity: String(qty),
          isEntry: false,
          movementType: "uso",
          date: body.date,
          healthControlId: body.id,
          notes: `Usado en: ${body.description || body.type}`,
        });
        await tx.update(supplyInventory).set({
          currentStock: sql`GREATEST(0, ${supplyInventory.currentStock}::numeric - ${qty})`,
          updatedAt: new Date(),
        }).where(eq(supplyInventory.id, s.supplyId));
      }
    }

    // 6. Advance sanitary calendar if matching type found
    const [calEntry] = await tx.select().from(sanitaryCalendar)
      .where(and(eq(sanitaryCalendar.type, body.type), eq(sanitaryCalendar.isActive, true)))
      .limit(1);
    if (calEntry && calEntry.frequencyDays) {
      const nextDate = new Date(body.date);
      nextDate.setDate(nextDate.getDate() + calEntry.frequencyDays);
      await tx.update(sanitaryCalendar).set({
        nextDueDate: nextDate.toISOString().split("T")[0],
        lastHealthControlId: body.id,
        updatedAt: new Date(),
      }).where(eq(sanitaryCalendar.id, calEntry.id));
    }

    return record;
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    // 1. Delete linked mortality records
    await tx.delete(mortalityRecords).where(eq(mortalityRecords.healthControlId, id));

    // 2. Reverse supply movements (restore stock with relative SQL)
    const movements = await tx.select().from(supplyMovements).where(eq(supplyMovements.healthControlId, id));
    for (const m of movements) {
      if (!m.isEntry) {
        const qty = Number(m.quantity);
        await tx.update(supplyInventory).set({
          currentStock: sql`(${supplyInventory.currentStock}::numeric + ${qty})`,
          updatedAt: new Date(),
        }).where(eq(supplyInventory.id, m.supplyId));
      }
    }

    // 3. Delete supply movements
    await tx.delete(supplyMovements).where(eq(supplyMovements.healthControlId, id));

    // 4. Revert hen statuses if this was a tratamiento that marked specific hens
    const [hcRecord] = await tx.select({ affectedHens: healthControl.affectedHens, type: healthControl.type }).from(healthControl).where(eq(healthControl.id, id));
    if (hcRecord && hcRecord.type === "tratamiento" && hcRecord.affectedHens && hcRecord.affectedHens.toLowerCase() !== "todas") {
      const codes = hcRecord.affectedHens.split(",").map((c: string) => c.trim()).filter(Boolean);
      if (codes.length > 0) {
        const match = await tx.select({ id: hens.id }).from(hens).where(inArray(hens.code, codes));
        const ids = match.map((m: any) => m.id);
        if (ids.length > 0) {
          await tx.update(hens).set({ status: "activa", updatedAt: new Date() }).where(inArray(hens.id, ids));
        }
      }
    }

    // 5. Delete the health control record
    await tx.delete(healthControl).where(eq(healthControl.id, id));

    // 6. Delete linked transaction
    await tx.delete(transactions).where(and(eq(transactions.sourceType, "sanidad"), eq(transactions.sourceId, id)));
  });

  return NextResponse.json({ ok: true });
});

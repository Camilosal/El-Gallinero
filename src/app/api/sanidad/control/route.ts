import { db } from "@/db";
import { healthControl, transactions, hens, roosters, broilerBatches, chickenSales, slaughter, mortalityRecords, supplyInventory, supplyMovements, sanitaryCalendar, farmLocations } from "@/db/schema";
import { eq, desc, and, inArray, sql, or, getTableColumns } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/rbac-server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { deleteTransactionsAndUnpaidAccounts, upsertExpenseTransaction } from "@/lib/financial-records";
import { HEN_TERMINAL_STATUSES } from "@/lib/animal-status";
import { applyBatchExit, validateBatchForExit, validateRoosterForExit } from "@/lib/birdExit";
import { resolveDimensions } from "@/lib/analytics-dimensions";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const data = await db.select({ ...getTableColumns(healthControl), locationName: farmLocations.name })
    .from(healthControl).leftJoin(farmLocations, eq(healthControl.locationId, farmLocations.id))
    .orderBy(desc(healthControl.date));
  return NextResponse.json(data);
});

async function markAffectedAsSick(type: string, affectedHens: string | null, client: any = db) {
  const references = type === "tratamiento" ? parseAffectedHenReferences(affectedHens) : [];
  const match = await selectHensByReferences(client, references);
  const previous: Record<string, string> = {};
  const ids = match.filter((hen: { id: string; status: string }) => !HEN_TERMINAL_STATUSES.includes(hen.status as any))
    .map((hen: { id: string; status: string }) => {
      previous[hen.id] = hen.status;
      return hen.id;
    });
  if (ids.length > 0) {
    await client.update(hens).set({ status: "enferma", updatedAt: new Date() }).where(inArray(hens.id, ids));
  }
  return previous;
}

function parseAffectedHenReferences(value: string | null | undefined): string[] {
  const raw = (value || "").trim();
  if (!raw || raw.toLowerCase() === "todas") return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return [...new Set(parsed.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
  } catch {
    // Existing controls also store a comma-separated list of hen codes.
  }
  return [...new Set(raw.split(",").map((item) => item.trim()).filter(Boolean))];
}

async function selectHensByReferences(client: any, references: string[]) {
  if (references.length === 0) return [];
  const ids = references.filter((value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
  const codes = references.filter((value) => !ids.includes(value));
  const conditions = [
    ...(ids.length > 0 ? [inArray(hens.id, ids)] : []),
    ...(codes.length > 0 ? [inArray(hens.code, codes)] : []),
  ];
  return client.select({ id: hens.id, code: hens.code, status: hens.status }).from(hens).where(or(...conditions)).for("update");
}

async function syncTreatmentHenStatuses(
  client: any,
  nextType: string,
  nextAffectedHens: string | null,
  previousStates: Record<string, { status: string; currentQuantity?: number }> | null,
) {
  const states = { ...(previousStates || {}) };
  const targetReferences = nextType === "tratamiento" ? parseAffectedHenReferences(nextAffectedHens) : [];
  const priorIds = Object.keys(states).filter((key) => key.startsWith("treatmentHen:")).map((key) => key.slice("treatmentHen:".length));
  const hensToSync = await selectHensByReferences(client, [...new Set([...priorIds, ...targetReferences])]);
  const targetIds = new Set((await selectHensByReferences(client, targetReferences)).map((hen: { id: string }) => hen.id));

  for (const hen of hensToSync) {
    const key = `treatmentHen:${hen.id}`;
    const saved = states[key];
    const remainsAffected = targetIds.has(hen.id);
    if (remainsAffected && !HEN_TERMINAL_STATUSES.includes(hen.status as any)) {
      if (!saved) states[key] = { status: hen.status };
      if (hen.status !== "enferma") {
        await client.update(hens).set({ status: "enferma", updatedAt: new Date() }).where(eq(hens.id, hen.id));
      }
    } else if (saved) {
      if (hen.status === "enferma") {
        await client.update(hens).set({ status: saved.status as any, updatedAt: new Date() }).where(eq(hens.id, hen.id));
      }
      delete states[key];
    }
  }
  return states;
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("sanitary:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.date || typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || Number.isNaN(new Date(`${body.date}T00:00:00.000Z`).getTime()) || new Date(`${body.date}T00:00:00.000Z`).toISOString().slice(0, 10) !== body.date) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  if (typeof body.locationId !== "string" || !body.locationId) return NextResponse.json({ error: "Selecciona el lugar donde se realizó el control sanitario" }, { status: 400 });
  const [controlLocation] = await db.select().from(farmLocations).where(eq(farmLocations.id, body.locationId));
  if (!controlLocation || controlLocation.status !== "activa") return NextResponse.json({ error: "El lugar del control debe estar activo" }, { status: 400 });

  const withdrawalDays = Math.max(0, Math.round(Number(body.withdrawalDays ?? 0) || 0));
  const computeWithdrawalDate = (baseDate: string, days: number): string | null => {
    if (!days || days <= 0) return null;
    const d = new Date(`${baseDate}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const withdrawalUntilDate =
    typeof body.withdrawalUntilDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.withdrawalUntilDate)
      ? body.withdrawalUntilDate
      : computeWithdrawalDate(body.date, withdrawalDays);

  const created = await db.transaction(async (tx) => {
    const dimRes = await resolveDimensions(tx, {
      species: body.species,
      locationId: body.locationId,
      batchId: body.batchId,
    });
    if ("error" in dimRes) throw new Error(dimRes.error);
    const dims = dimRes.dimensions;

    // 1. Insert health control record
    const [record] = await tx.insert(healthControl).values({
      date: body.date,
      species: dims.species,
      locationId: dims.locationId ?? body.locationId,
      batchId: dims.batchId,
      type: body.type,
      description: body.description,
      affectedHens: body.affectedHens || null,
      product: body.product || null,
      withdrawalDays,
      withdrawalUntilDate,
      vaccineLot: typeof body.vaccineLot === "string" && body.vaccineLot.trim() ? body.vaccineLot.trim() : null,
      vaccineLab: typeof body.vaccineLab === "string" && body.vaccineLab.trim() ? body.vaccineLab.trim() : null,
      vaccineExpiryDate:
        typeof body.vaccineExpiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.vaccineExpiryDate)
          ? body.vaccineExpiryDate
          : null,
      coldChainTempC:
        body.coldChainTempC !== undefined && body.coldChainTempC !== null && String(body.coldChainTempC).trim() !== "" && Number.isFinite(Number(String(body.coldChainTempC).replace(/[^0-9.-]/g, "")))
          ? String(Number(String(body.coldChainTempC).replace(/[^0-9.-]/g, "")))
          : null,
      administrationRoute:
        typeof body.administrationRoute === "string" && body.administrationRoute.trim()
          ? body.administrationRoute.trim()
          : null,
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
        species: record.species,
        locationId: record.locationId,
        batchId: record.batchId,
      });
    }

    // 3. Save the state before applying the treatment so deletion can restore
    // it instead of assuming every treated hen was active.
    const previousAnimalStates: Record<string, { status: string; currentQuantity?: number }> = {};
    const treatmentHenStates = await markAffectedAsSick(body.type, body.affectedHens, tx);
    for (const [henId, status] of Object.entries(treatmentHenStates)) {
      previousAnimalStates[`treatmentHen:${henId}`] = { status };
    }

    // 4. Record mortality if animals died, applying the same stock checks as
    // direct mortality entries.
    if (body.deaths !== undefined && !Array.isArray(body.deaths)) {
      throw new Error("Lista de muertes inválida");
    }
    if (Array.isArray(body.deaths)) {
      const BATCH_SPECIES: Record<string, string> = {
        lote_pollos: "pollo",
        lote_codornices: "codorniz",
        lote_patos: "pato",
        lote_conejos: "conejo",
        lote_cuyes: "cuy",
      };
      for (const death of body.deaths) {
        const birdType = death.birdType || "gallina";
        const cause = death.cause || "enfermedad";
        const isBatchDeath = Object.hasOwn(BATCH_SPECIES, birdType);
        if (birdType !== "gallina" && birdType !== "gallo" && !isBatchDeath) {
          throw new Error("Tipo de animal inválido en mortalidad");
        }
        if (!["enfermedad", "depredador", "accidente", "sacrificio_sanitario", "causa_natural", "otro"].includes(cause)) {
          throw new Error("Causa de mortalidad inválida");
        }
        const quantity = isBatchDeath ? Number(death.quantity ?? 1) : 1;
        if (!Number.isSafeInteger(quantity) || quantity < 1) throw new Error("Cantidad de mortalidad inválida");

        if (birdType === "gallina") {
          if (!death.henId || death.roosterId || death.batchId) throw new Error("Seleccione una sola gallina para la mortalidad");
          const [hen] = await tx.select().from(hens).where(eq(hens.id, death.henId)).for("update");
          if (!hen) throw new Error("Gallina no encontrada");
          if (HEN_TERMINAL_STATUSES.includes(hen.status)) throw new Error("La gallina ya salió del inventario");
          previousAnimalStates[`hen:${hen.id}`] ??= { status: hen.status };
          await tx.update(hens).set({ status: "muerta", updatedAt: new Date() }).where(eq(hens.id, death.henId));
        } else if (birdType === "gallo") {
          if (!death.roosterId || death.henId || death.batchId) throw new Error("Seleccione un solo gallo para la mortalidad");
          const error = await validateRoosterForExit(death.roosterId, tx);
          if (error) throw new Error(error);
          const [rooster] = await tx.select().from(roosters).where(eq(roosters.id, death.roosterId)).for("update");
          if (!rooster) throw new Error("Gallo no encontrado");
          previousAnimalStates[`rooster:${rooster.id}`] ??= { status: rooster.status };
          await tx.update(roosters).set({ status: "muerto", updatedAt: new Date() }).where(eq(roosters.id, death.roosterId));
        } else {
          if (!death.batchId || death.henId || death.roosterId) throw new Error("Seleccione un solo lote para la mortalidad");
          const error = await validateBatchForExit(death.batchId, quantity, tx);
          if (error) throw new Error(error);
          const [batch] = await tx.select().from(broilerBatches).where(eq(broilerBatches.id, death.batchId)).for("update");
          if (!batch) throw new Error("Lote no encontrado");
          if (batch.species !== BATCH_SPECIES[birdType]) {
            throw new Error("El lote seleccionado no corresponde al tipo de animal");
          }
          previousAnimalStates[`batch:${batch.id}`] ??= { status: batch.status };
          await applyBatchExit(death.batchId, quantity, "sacrificio", tx);
        }

        await tx.insert(mortalityRecords).values({
          date: body.date,
          locationId: body.locationId,
          species: (birdType === "gallina" || birdType === "gallo" ? "gallina" : BATCH_SPECIES[birdType]) as "gallina" | "pollo" | "codorniz" | "pato" | "conejo" | "cuy",
          birdType,
          quantity,
          cause,
          henId: death.henId || null,
          roosterId: death.roosterId || null,
          batchId: death.batchId || null,
          healthControlId: record.id,
          description: body.description || null,
        });
      }
    }

    // 5. Discount supplies used — relative SQL update to avoid race conditions
    if (body.supplies && body.supplies.length > 0) {
      for (const s of body.supplies) {
        const qty = Number(s.quantity);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Cantidad de insumo inválida");
        const [supply] = await tx.select().from(supplyInventory).where(eq(supplyInventory.id, s.supplyId)).for("update");
        if (!supply) throw new Error("Insumo no encontrado");
        if (qty > Number(supply.currentStock)) {
          throw new Error(`Stock insuficiente de ${supply.name}: disponibles ${supply.currentStock} ${supply.unit}`);
        }
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
        // Decrement stock while holding the supply row lock.
        await tx.update(supplyInventory).set({
          currentStock: sql`(${supplyInventory.currentStock}::numeric - ${qty})`,
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

    await tx.update(healthControl).set({ previousAnimalStates }).where(eq(healthControl.id, record.id));
    return { ...record, previousAnimalStates };
  });

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("sanitary:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (!body.date || typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || Number.isNaN(new Date(`${body.date}T00:00:00.000Z`).getTime()) || new Date(`${body.date}T00:00:00.000Z`).toISOString().slice(0, 10) !== body.date) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  if (typeof body.locationId !== "string" || !body.locationId) return NextResponse.json({ error: "Selecciona el lugar donde se realizó el control sanitario" }, { status: 400 });
  const [requestedLocation] = await db.select({ id: farmLocations.id }).from(farmLocations).where(eq(farmLocations.id, body.locationId));
  if (!requestedLocation) return NextResponse.json({ error: "El lugar seleccionado no existe" }, { status: 400 });

  const updated = await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(healthControl).where(eq(healthControl.id, body.id)).for("update");
    if (!existing) throw new Error("No encontrado");
    const nextType = body.type ?? existing.type;
    const nextAffectedHens = body.affectedHens !== undefined ? body.affectedHens : existing.affectedHens;
    const nextDescription = body.description ?? existing.description;
    const nextCost = body.cost !== undefined ? body.cost : existing.cost;
    const previousAnimalStates = await syncTreatmentHenStatuses(
      tx,
      nextType,
      nextAffectedHens,
      existing.previousAnimalStates,
    );

    const nextWithdrawalDays =
      body.withdrawalDays !== undefined
        ? Math.max(0, Math.round(Number(body.withdrawalDays) || 0))
        : (existing.withdrawalDays ?? 0);
    const computedWithdrawalUntil = (() => {
      if (typeof body.withdrawalUntilDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.withdrawalUntilDate)) {
        return body.withdrawalUntilDate;
      }
      if (nextWithdrawalDays > 0) {
        const d = new Date(`${body.date}T12:00:00.000Z`);
        if (!Number.isNaN(d.getTime())) {
          d.setUTCDate(d.getUTCDate() + nextWithdrawalDays);
          return d.toISOString().slice(0, 10);
        }
      }
      return null;
    })();

    const dimRes = await resolveDimensions(tx, {
      species: body.species !== undefined ? body.species : existing.species,
      locationId: body.locationId,
      batchId: body.batchId !== undefined ? body.batchId : existing.batchId,
    });
    if ("error" in dimRes) throw new Error(dimRes.error);
    const dims = dimRes.dimensions;

    // 1. Update health control record
    const [record] = await tx.update(healthControl).set({
      date: body.date,
      species: dims.species,
      locationId: dims.locationId ?? body.locationId,
      batchId: dims.batchId,
      type: nextType,
      description: nextDescription,
      affectedHens: nextAffectedHens || null,
      product: body.product !== undefined ? body.product : existing.product,
      withdrawalDays: nextWithdrawalDays,
      withdrawalUntilDate: computedWithdrawalUntil,
      vaccineLot:
        body.vaccineLot !== undefined
          ? typeof body.vaccineLot === "string" && body.vaccineLot.trim()
            ? body.vaccineLot.trim()
            : null
          : existing.vaccineLot,
      vaccineLab:
        body.vaccineLab !== undefined
          ? typeof body.vaccineLab === "string" && body.vaccineLab.trim()
            ? body.vaccineLab.trim()
            : null
          : existing.vaccineLab,
      vaccineExpiryDate:
        body.vaccineExpiryDate !== undefined
          ? typeof body.vaccineExpiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.vaccineExpiryDate)
            ? body.vaccineExpiryDate
            : null
          : existing.vaccineExpiryDate,
      coldChainTempC:
        body.coldChainTempC !== undefined
          ? body.coldChainTempC !== null && String(body.coldChainTempC).trim() !== "" && Number.isFinite(Number(String(body.coldChainTempC).replace(/[^0-9.-]/g, "")))
            ? String(Number(String(body.coldChainTempC).replace(/[^0-9.-]/g, "")))
            : null
          : existing.coldChainTempC,
      administrationRoute:
        body.administrationRoute !== undefined
          ? typeof body.administrationRoute === "string" && body.administrationRoute.trim()
            ? body.administrationRoute.trim()
            : null
          : existing.administrationRoute,
      cost: nextCost || "0",
      nextScheduled: body.nextScheduled !== undefined ? body.nextScheduled || null : existing.nextScheduled,
      notes: body.notes !== undefined ? body.notes || null : existing.notes,
      previousAnimalStates,
    }).where(eq(healthControl.id, body.id)).returning();

    if (!record) throw new Error("No encontrado");
    await tx.update(mortalityRecords).set({ date: body.date, locationId: body.locationId }).where(eq(mortalityRecords.healthControlId, body.id));
    await tx.update(supplyMovements).set({ date: body.date }).where(eq(supplyMovements.healthControlId, body.id));

    // Update the source transaction in place so credit status and payment links survive edits.
    await upsertExpenseTransaction(tx, {
      condition: and(eq(transactions.sourceType, "sanidad"), eq(transactions.sourceId, body.id)),
      date: body.date,
      category: "Control sanitario",
      description: `${nextType}: ${nextDescription}`,
      amount: String(nextCost || "0"),
      sourceType: "sanidad",
      sourceId: body.id,
      species: record.species,
      locationId: record.locationId,
      batchId: record.batchId,
    });

    // 3. Mark affected hens as sick
    // Only replace usage history when the caller explicitly sends a supplies
    // array. The current UI edits the health event without resending it.
    if (Array.isArray(body.supplies)) {
      const oldMovements = await tx.select().from(supplyMovements)
        .where(eq(supplyMovements.healthControlId, body.id)).for("update");
      for (const movement of oldMovements) {
        if (!movement.isEntry) {
          const [supply] = await tx.select().from(supplyInventory)
            .where(eq(supplyInventory.id, movement.supplyId)).for("update");
          if (supply) {
            await tx.update(supplyInventory).set({
              currentStock: sql`(${supplyInventory.currentStock}::numeric + ${Number(movement.quantity)})`,
              updatedAt: new Date(),
            }).where(eq(supplyInventory.id, movement.supplyId));
          }
        }
      }
      await tx.delete(supplyMovements).where(eq(supplyMovements.healthControlId, body.id));

      for (const s of body.supplies) {
        const qty = Number(s.quantity);
        if (!Number.isFinite(qty) || qty <= 0) throw new Error("Cantidad de insumo inválida");
        const [supply] = await tx.select().from(supplyInventory).where(eq(supplyInventory.id, s.supplyId)).for("update");
        if (!supply) throw new Error("Insumo no encontrado");
        if (qty > Number(supply.currentStock)) {
          throw new Error(`Stock insuficiente de ${supply.name}: disponibles ${supply.currentStock} ${supply.unit}`);
        }
        await tx.insert(supplyMovements).values({
          supplyId: s.supplyId,
          quantity: String(qty),
          isEntry: false,
          movementType: "uso",
          date: body.date,
          healthControlId: body.id,
          notes: `Usado en: ${nextDescription || nextType}`,
        });
        await tx.update(supplyInventory).set({
          currentStock: sql`(${supplyInventory.currentStock}::numeric - ${qty})`,
          updatedAt: new Date(),
        }).where(eq(supplyInventory.id, s.supplyId));
      }
    }

    // 6. Advance sanitary calendar if matching type found
    const [calEntry] = await tx.select().from(sanitaryCalendar)
      .where(and(eq(sanitaryCalendar.type, nextType), eq(sanitaryCalendar.isActive, true)))
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
  const denied = await requirePermission("sanitary:write");
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    const [control] = await tx.select({
      id: healthControl.id,
      type: healthControl.type,
      affectedHens: healthControl.affectedHens,
      previousAnimalStates: healthControl.previousAnimalStates,
    }).from(healthControl).where(eq(healthControl.id, id)).for("update");
    if (!control) throw new Error("No encontrado");
    // 1. Restore animals before deleting mortality records linked to this event.
    const linkedMortality = await tx.select().from(mortalityRecords)
      .where(eq(mortalityRecords.healthControlId, id)).for("update");
    const henIds = [...new Set(linkedMortality.flatMap((record) => record.henId ? [record.henId] : []))];
    const roosterIds = [...new Set(linkedMortality.flatMap((record) => record.roosterId ? [record.roosterId] : []))];
    const batchTotals = new Map<string, number>();
    for (const record of linkedMortality) {
      if (record.batchId) batchTotals.set(record.batchId, (batchTotals.get(record.batchId) || 0) + record.quantity);
    }
    for (const henId of henIds) {
      await tx.select({ id: hens.id }).from(hens).where(eq(hens.id, henId)).for("update");
      const [hasSale] = await tx.select({ id: chickenSales.id }).from(chickenSales).where(eq(chickenSales.henId, henId)).limit(1);
      const [hasSlaughter] = await tx.select({ id: slaughter.id }).from(slaughter).where(eq(slaughter.henId, henId)).limit(1);
      const [externalDeath] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords)
        .where(and(eq(mortalityRecords.henId, henId), sql`${mortalityRecords.healthControlId} IS DISTINCT FROM ${id}`))
        .limit(1);
      if (!hasSale && !hasSlaughter && !externalDeath) {
        const priorStatus = control.previousAnimalStates?.[`hen:${henId}`]?.status;
        await tx.update(hens).set({ status: (priorStatus || "activa") as any, updatedAt: new Date() }).where(eq(hens.id, henId));
      }
    }
    for (const roosterId of roosterIds) {
      await tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.id, roosterId)).for("update");
      const [hasSale] = await tx.select({ id: chickenSales.id }).from(chickenSales).where(eq(chickenSales.roosterId, roosterId)).limit(1);
      const [hasSlaughter] = await tx.select({ id: slaughter.id }).from(slaughter).where(eq(slaughter.roosterId, roosterId)).limit(1);
      const [externalDeath] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords)
        .where(and(eq(mortalityRecords.roosterId, roosterId), sql`${mortalityRecords.healthControlId} IS DISTINCT FROM ${id}`))
        .limit(1);
      if (!hasSale && !hasSlaughter && !externalDeath) {
        const priorStatus = control.previousAnimalStates?.[`rooster:${roosterId}`]?.status;
        await tx.update(roosters).set({ status: (priorStatus || "activo") as any, updatedAt: new Date() }).where(eq(roosters.id, roosterId));
      }
    }
    for (const [batchId, quantity] of batchTotals) {
      const [batch] = await tx.select().from(broilerBatches).where(eq(broilerBatches.id, batchId)).for("update");
      if (batch) {
        const [hasSale] = await tx.select({ id: chickenSales.id }).from(chickenSales).where(eq(chickenSales.batchId, batchId)).limit(1);
        const [hasSlaughter] = await tx.select({ id: slaughter.id }).from(slaughter).where(eq(slaughter.batchId, batchId)).limit(1);
        const [externalDeath] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords)
          .where(and(eq(mortalityRecords.batchId, batchId), sql`${mortalityRecords.healthControlId} IS DISTINCT FROM ${id}`))
          .limit(1);
        const priorStatus = control.previousAnimalStates?.[`batch:${batchId}`]?.status;
        await tx.update(broilerBatches).set({
          currentQuantity: batch.currentQuantity + quantity,
          status: hasSale || hasSlaughter || externalDeath
            ? batch.status
            : (priorStatus || (batch.status === "faena" ? "activo" : batch.status)) as any,
          updatedAt: new Date(),
        }).where(eq(broilerBatches.id, batchId));
      }
    }
    await tx.delete(mortalityRecords).where(eq(mortalityRecords.healthControlId, id));

    // 2. Reverse supply movements (restore stock with relative SQL)
    const movements = await tx.select().from(supplyMovements).where(eq(supplyMovements.healthControlId, id));
    for (const m of movements) {
      if (!m.isEntry) {
        const qty = Number(m.quantity);
        await tx.select({ id: supplyInventory.id }).from(supplyInventory)
          .where(eq(supplyInventory.id, m.supplyId)).for("update");
        await tx.update(supplyInventory).set({
          currentStock: sql`(${supplyInventory.currentStock}::numeric + ${qty})`,
          updatedAt: new Date(),
        }).where(eq(supplyInventory.id, m.supplyId));
      }
    }

    // 3. Delete supply movements
    await tx.delete(supplyMovements).where(eq(supplyMovements.healthControlId, id));

    // 4. Restore prior treatment states for new records. Older controls have no
    // saved state; leave their status untouched instead of guessing "activa".
    const treatmentHenStates = Object.entries(control.previousAnimalStates || {})
      .filter(([key]) => key.startsWith("treatmentHen:"));
    for (const [key, state] of treatmentHenStates) {
      const henId = key.slice("treatmentHen:".length);
      const [hen] = await tx.select({ id: hens.id, status: hens.status }).from(hens).where(eq(hens.id, henId)).for("update");
      if (!hen || HEN_TERMINAL_STATUSES.includes(hen.status)) continue;
      const [hasSale] = await tx.select({ id: chickenSales.id }).from(chickenSales).where(eq(chickenSales.henId, henId)).limit(1);
      const [hasSlaughter] = await tx.select({ id: slaughter.id }).from(slaughter).where(eq(slaughter.henId, henId)).limit(1);
      const [externalDeath] = await tx.select({ id: mortalityRecords.id }).from(mortalityRecords)
        .where(and(eq(mortalityRecords.henId, henId), sql`${mortalityRecords.healthControlId} IS DISTINCT FROM ${id}`))
        .limit(1);
      if (!hasSale && !hasSlaughter && !externalDeath) {
        await tx.update(hens).set({ status: state.status as any, updatedAt: new Date() }).where(eq(hens.id, henId));
      }
    }

    await tx.update(sanitaryCalendar).set({ lastHealthControlId: null, updatedAt: new Date() })
      .where(eq(sanitaryCalendar.lastHealthControlId, id));

    // 5. Delete the health control record
    await tx.delete(healthControl).where(eq(healthControl.id, id));

    // 6. Delete linked transaction
    await deleteTransactionsAndUnpaidAccounts(
      tx,
      and(eq(transactions.sourceType, "sanidad"), eq(transactions.sourceId, id)),
    );
  });

  return NextResponse.json({ ok: true });
});

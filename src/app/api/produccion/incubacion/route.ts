import { db } from "@/db";
import { incubation, hens, roosters, broilerBatches, birdAcquisitions, animalLocationMovements, farmLocations } from "@/db/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import { HEN_PRESENT_STATUSES } from "@/lib/animal-status";
import { assignMales, requiredRoosters } from "@/lib/flock";
import { getFlockRules, getIncubationDays } from "@/lib/settings";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { addDaysIso } from "@/lib/date-validation";
import { assertDateNotClosed, assertLocationEntryAllowed } from "@/lib/sanitary-locks";

export const dynamic = "force-dynamic";

const INCUBATION_SPECS: Record<string, { days: number; turnStopDay: number; tempC: string; humidityPct: string; label: string }> = {
  gallina: { days: 21, turnStopDay: 18, tempC: "37.8", humidityPct: "55.0", label: "Gallina (21d)" },
  codorniz: { days: 17, turnStopDay: 14, tempC: "37.7", humidityPct: "60.0", label: "Codorniz (17d)" },
  pato: { days: 28, turnStopDay: 25, tempC: "37.5", humidityPct: "65.0", label: "Pato (28d)" },
};

export const GET = withApiHandler(async () => {
  const [data, locations, batches] = await Promise.all([
    db
      .select({
        id: incubation.id,
        species: incubation.species,
        henId: incubation.henId,
        henCode: hens.code,
        roosterId: incubation.roosterId,
        roosterCode: sql<string | null>`COALESCE(${roosters.code}, ${incubation.roosterCode})`,
        batchId: incubation.batchId,
        locationId: incubation.locationId,
        incubatorName: incubation.incubatorName,
        trayCode: incubation.trayCode,
        startDate: incubation.startDate,
        turnStopDate: incubation.turnStopDate,
        expectedHatchDate: incubation.expectedHatchDate,
        humidityTargetPct: incubation.humidityTargetPct,
        tempTargetC: incubation.tempTargetC,
        eggsSet: incubation.eggsSet,
        fertileEggs: incubation.fertileEggs,
        discardedEggs: incubation.discardedEggs,
        eggsHatched: incubation.eggsHatched,
        malesHatched: incubation.malesHatched,
        femalesHatched: incubation.femalesHatched,
        isComplete: incubation.isComplete,
        notes: incubation.notes,
        createdAt: incubation.createdAt,
      })
      .from(incubation)
      .leftJoin(hens, eq(incubation.henId, hens.id))
      .leftJoin(roosters, eq(incubation.roosterId, roosters.id))
      .orderBy(desc(incubation.createdAt)),
    db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations),
    db.select({ id: broilerBatches.id, code: broilerBatches.code }).from(broilerBatches),
  ]);

  const locNames = new Map(locations.map((l) => [l.id, l.name]));
  const batchCodes = new Map(batches.map((b) => [b.id, b.code]));

  return NextResponse.json(
    data.map((row) => {
      const fertile = row.fertileEggs != null ? Number(row.fertileEggs) : null;
      const hatched = row.eggsHatched != null ? Number(row.eggsHatched) : 0;
      const eggsSet = Math.max(1, Number(row.eggsSet || 1));
      return {
        ...row,
        locationName: row.locationId ? locNames.get(row.locationId) || null : null,
        batchCode: row.batchId ? batchCodes.get(row.batchId) || null : null,
        fertilityPct: fertile != null ? Math.round((fertile / eggsSet) * 1000) / 10 : null,
        hatchOfFertilePct: row.isComplete && fertile != null && fertile > 0 ? Math.round((hatched / fertile) * 1000) / 10 : null,
        hatchTotalPct: row.isComplete ? Math.round((hatched / eggsSet) * 1000) / 10 : null,
      };
    }),
  );
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const eggsSet = Number(body.eggsSet);
  if (!Number.isInteger(eggsSet) || eggsSet < 1) {
    return NextResponse.json({ error: "La cantidad de huevos debe ser un entero mayor que cero" }, { status: 400 });
  }
  const species = String(body.species || "gallina").trim().toLowerCase();
  if (!INCUBATION_SPECS[species]) {
    return NextResponse.json({ error: "Especie de incubación inválida (gallina, codorniz o pato)" }, { status: 400 });
  }
  if (species !== "gallina" && body.henId) {
    return NextResponse.json({ error: "Solo se asigna gallina individual a incubaciones de gallina" }, { status: 400 });
  }
  const startDate = new Date(body.startDate);
  if (isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Fecha de inicio inválida" }, { status: 400 });
  }

  const spec = INCUBATION_SPECS[species];
  const configuredGallinaDays = species === "gallina" ? await getIncubationDays() : spec.days;
  const incubationDays = species === "gallina" ? configuredGallinaDays : spec.days;
  const expectedHatchDate = addDaysIso(String(body.startDate), incubationDays);
  const turnStopDate = body.turnStopDate || addDaysIso(String(body.startDate), spec.turnStopDay);
  const fertileEggs = body.fertileEggs != null && body.fertileEggs !== "" ? Number(body.fertileEggs) : null;
  const discardedEggs = body.discardedEggs != null && body.discardedEggs !== "" ? Number(body.discardedEggs) : 0;
  if (fertileEggs != null && (!Number.isInteger(fertileEggs) || fertileEggs < 0 || fertileEggs > eggsSet)) {
    return NextResponse.json({ error: "Huevos fértiles inválido" }, { status: 400 });
  }
  if (!Number.isInteger(discardedEggs) || discardedEggs < 0 || discardedEggs > eggsSet) {
    return NextResponse.json({ error: "Huevos descartados inválido" }, { status: 400 });
  }

  const created = await db.transaction(async (tx) => {
    if (body.henId) {
      const [hen] = await tx.select({ id: hens.id, status: hens.status }).from(hens).where(eq(hens.id, body.henId)).for("update");
      if (!hen) throw new Error("Gallina no encontrada");
      if (hen.status !== "activa") throw new Error("La gallina no está disponible para incubar");
      const [openIncubation] = await tx.select({ id: incubation.id }).from(incubation)
        .where(and(eq(incubation.henId, body.henId), eq(incubation.isComplete, false))).limit(1);
      if (openIncubation) throw new Error("La gallina ya tiene una incubación activa");
    }

    let roosterCode: string | null = null;
    if (body.roosterId) {
      const [rooster] = await tx.select({ id: roosters.id, code: roosters.code }).from(roosters).where(eq(roosters.id, body.roosterId));
      if (!rooster) throw new Error("Padre no encontrado");
      roosterCode = rooster.code;
    }

    const [row] = await tx.insert(incubation).values({
      species: species as any,
      henId: body.henId || null,
      roosterId: body.roosterId || null,
      roosterCode,
      batchId: body.batchId || null,
      locationId: body.locationId || null,
      incubatorName: body.incubatorName ? String(body.incubatorName).trim() : null,
      trayCode: body.trayCode ? String(body.trayCode).trim() : null,
      startDate: body.startDate,
      turnStopDate,
      expectedHatchDate,
      humidityTargetPct: body.humidityTargetPct ? String(body.humidityTargetPct) : spec.humidityPct,
      tempTargetC: body.tempTargetC ? String(body.tempTargetC) : spec.tempC,
      eggsSet,
      fertileEggs,
      discardedEggs,
      notes: body.notes || null,
    }).returning();

    if (body.henId) {
      await tx.update(hens).set({ status: "empollando", isBroody: true, updatedAt: new Date() }).where(eq(hens.id, body.henId));
    }

    return row;
  });

  return NextResponse.json(created, { status: 201 });
});

async function nextCodesInTx(tx: any, table: any, prefix: string, count: number): Promise<string[]> {
  const existingCodes = (await tx.select({ code: table.code }).from(table)).map((r: any) => r.code);
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const code of existingCodes) {
    const m = code.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + i + 1).padStart(3, "0")}`);
}

async function nextSpeciesBatchCodeInTx(tx: any, species: string): Promise<string> {
  const prefixes: Record<string, string> = { pollo: "L-", codorniz: "L-COD-", pato: "L-PAT-" };
  const prefix = prefixes[species] || "L-";
  const existing = await tx.select({ code: broilerBatches.code }).from(broilerBatches);
  let max = 0;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\$&");
  const re = new RegExp(`^${escaped}(\\d+)$`);
  for (const row of existing) {
    const m = re.exec(String(row.code));
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (body.isComplete !== undefined && typeof body.isComplete !== "boolean") {
    return NextResponse.json({ error: "Estado de eclosión inválido" }, { status: 400 });
  }

  const flockRules = await getFlockRules();

  const result = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(incubation).where(eq(incubation.id, body.id)).for("update");
    if (!before) throw new Error("No encontrado");
    const wasAlreadyComplete = !!before.isComplete;
    const nextIsComplete = body.isComplete ?? before.isComplete;

    const fertileEggs = body.fertileEggs === undefined
      ? before.fertileEggs
      : body.fertileEggs == null || body.fertileEggs === ""
        ? null
        : Number(body.fertileEggs);
    const discardedEggs = body.discardedEggs === undefined
      ? Number(before.discardedEggs || 0)
      : Number(body.discardedEggs || 0);
    if (fertileEggs != null && (!Number.isInteger(fertileEggs) || fertileEggs < 0 || fertileEggs > before.eggsSet)) {
      throw new Error("Cantidad de huevos fértiles inválida");
    }
    if (!Number.isInteger(discardedEggs) || discardedEggs < 0 || discardedEggs > before.eggsSet) {
      throw new Error("Cantidad descartada inválida");
    }

    const eggsHatched = body.eggsHatched === undefined ? Number(before.eggsHatched || 0) : Number(body.eggsHatched);
    const malesHatched = body.malesHatched === undefined
      ? (before.malesHatched == null ? null : Number(before.malesHatched))
      : body.malesHatched == null ? null : Number(body.malesHatched);
    const femalesHatched = body.femalesHatched === undefined
      ? (before.femalesHatched == null ? null : Number(before.femalesHatched))
      : body.femalesHatched == null ? null : Number(body.femalesHatched);
    if (!Number.isInteger(eggsHatched) || eggsHatched < 0 || eggsHatched > before.eggsSet) {
      throw new Error("La cantidad nacida debe ser un entero entre cero y los huevos incubados");
    }
    if (malesHatched != null && (!Number.isInteger(malesHatched) || malesHatched < 0)) throw new Error("Cantidad de machos inválida");
    if (femalesHatched != null && (!Number.isInteger(femalesHatched) || femalesHatched < 0)) throw new Error("Cantidad de hembras inválida");
    if (malesHatched != null && femalesHatched != null && malesHatched + femalesHatched > eggsHatched) {
      throw new Error("La suma de machos y hembras no puede superar la cantidad nacida");
    }
    if (wasAlreadyComplete && (
      nextIsComplete === false ||
      eggsHatched !== Number(before.eggsHatched || 0) ||
      malesHatched !== (before.malesHatched == null ? null : Number(before.malesHatched)) ||
      femalesHatched !== (before.femalesHatched == null ? null : Number(before.femalesHatched))
    )) {
      throw new Error("No se puede reabrir ni cambiar los conteos de una incubación ya completada");
    }

    if (nextIsComplete && !wasAlreadyComplete) {
      if (before.henId || Number(femalesHatched) > 0) {
        await tx.execute(sql`LOCK TABLE ${hens} IN EXCLUSIVE MODE`);
      }
      if (Number(malesHatched) > 0 || before.species !== "gallina") {
        await tx.execute(sql`LOCK TABLE ${roosters} IN EXCLUSIVE MODE`);
        await tx.execute(sql`LOCK TABLE ${broilerBatches} IN EXCLUSIVE MODE`);
      }
    }

    const [updated] = await tx.update(incubation).set({
      fertileEggs,
      discardedEggs,
      eggsHatched,
      malesHatched,
      femalesHatched,
      isComplete: nextIsComplete,
      notes: body.notes !== undefined ? body.notes : before.notes,
    }).where(eq(incubation.id, body.id)).returning();

    if (!updated) throw new Error("No encontrado");

    if (nextIsComplete && !wasAlreadyComplete && updated.henId) {
      await tx.update(hens).set({ status: "activa", isBroody: false, updatedAt: new Date() }).where(eq(hens.id, updated.henId));
    }

    const assignment = { hensCreated: 0, roostersCreated: 0, batchCode: null as string | null };
    if (nextIsComplete && !wasAlreadyComplete) {
      const sp = updated.species || "gallina";
      const today = new Date().toISOString().split("T")[0];
      const originNote = `Cría propia por incubación ${updated.id}`;

      if (sp !== "gallina" && eggsHatched > 0) {
        const destLocationId = updated.locationId || null;
        if (destLocationId) {
          await assertLocationEntryAllowed(tx, { locationId: destLocationId, species: sp, date: today, lock: true });
        }
        const [acquisition] = await tx.insert(birdAcquisitions).values({
          date: today,
          acquisitionType: "cria_propia",
          species: sp as any,
          birdType: sp,
          quantity: eggsHatched,
          breed: sp === "codorniz" ? "Codorniz Japonesa" : "Pato Pekín",
          sourceBatchCode: `INC-${updated.id}`,
          destinationLocationId: destLocationId,
          birthDate: today,
          notes: originNote,
        }).returning({ id: birdAcquisitions.id });
        const code = await nextSpeciesBatchCodeInTx(tx, sp);
        const [batch] = await tx.insert(broilerBatches).values({
          code,
          species: sp as any,
          purpose: sp === "codorniz" ? "mixto" : "engorde_carne",
          breed: sp === "codorniz" ? "Codorniz Japonesa" : "Pato Pekín",
          startDate: today,
          initialQuantity: eggsHatched,
          currentQuantity: eggsHatched,
          acquisitionId: acquisition.id,
          locationId: destLocationId,
          targetWeeks: sp === "codorniz" ? 6 : 9,
          targetDays: sp === "codorniz" ? 42 : 63,
          targetWeightKg: sp === "codorniz" ? "0.18" : "3.20",
          notes: `Eclosión multiespecie (${eggsHatched} crías)`,
        }).returning();
        if (destLocationId) {
          await tx.insert(animalLocationMovements).values({
            batchId: batch.id,
            fromLocationId: null,
            toLocationId: destLocationId,
            quantity: eggsHatched,
            date: today,
            reason: "Nacimiento por incubación",
            notes: `Adquisición ${acquisition.id}`,
          });
        }
        assignment.batchCode = batch.code;
        return { incubation: updated, assignment };
      }

      const females = femalesHatched || 0;
      const males = malesHatched || 0;

      const mother = updated.henId
        ? (await tx.select({ breed: hens.breed, code: hens.code, acquisitionId: hens.acquisitionId, locationId: hens.locationId }).from(hens).where(eq(hens.id, updated.henId)))[0]
        : undefined;
      const father = updated.roosterId
        ? (await tx.select({ breed: roosters.breed, code: roosters.code, acquisitionId: roosters.acquisitionId, locationId: roosters.locationId }).from(roosters).where(eq(roosters.id, updated.roosterId)))[0]
        : undefined;
      const destinationLocationId = updated.locationId || mother?.locationId || father?.locationId || null;
      const motherAcquisition = mother?.acquisitionId
        ? (await tx.select({ geneticLine: birdAcquisitions.geneticLine }).from(birdAcquisitions).where(eq(birdAcquisitions.id, mother.acquisitionId)))[0]
        : undefined;
      const fatherAcquisition = father?.acquisitionId
        ? (await tx.select({ geneticLine: birdAcquisitions.geneticLine }).from(birdAcquisitions).where(eq(birdAcquisitions.id, father.acquisitionId)))[0]
        : undefined;
      const breed = mother?.breed || "Criolla";
      const maternalLine = motherAcquisition?.geneticLine || mother?.breed || null;
      const paternalLine = fatherAcquisition?.geneticLine || father?.breed || null;
      const geneticLine = maternalLine && paternalLine
        ? maternalLine === paternalLine ? maternalLine : `Cruce: ${maternalLine} × ${paternalLine}`.slice(0, 150)
        : maternalLine || paternalLine;

      let assignedRoosters = 0;
      let assignedBatchQuantity = 0;
      if (males > 0) {
        const [henRows, roosterRows] = await Promise.all([
          tx.select({ status: hens.status }).from(hens),
          tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.status, "activo")),
        ]);
        const hensInCoop = henRows.filter((h) => isAvailableForExit(h.status)).length;
        const assignmentPlan = assignMales(
          males,
          roosterRows.length,
          requiredRoosters(hensInCoop, flockRules.hensPerRooster),
        );
        assignedRoosters = assignmentPlan.toRoosters;
        assignedBatchQuantity = assignmentPlan.toSlaughter;
      }

      const hatchlings = females + assignedRoosters + assignedBatchQuantity;
      if (destinationLocationId && hatchlings > 0) {
        const [destination] = await tx.select().from(farmLocations)
          .where(eq(farmLocations.id, destinationLocationId)).for("update");
        if (!destination || destination.status !== "activa" || ["restringida", "fuera_servicio"].includes(destination.operationalStatus)) {
          throw new Error("El lugar actual de los progenitores no admite nuevas crías; actualiza su alojamiento antes de completar la incubación");
        }
        if (destination.capacity != null) {
          const [[henCount], [roosterCount], [batchCount]] = await Promise.all([
            tx.select({ total: sql<number>`count(*)::int` }).from(hens)
              .where(and(eq(hens.locationId, destination.id), inArray(hens.status, HEN_PRESENT_STATUSES as (typeof hens.status.enumValues)[number][]))),
            tx.select({ total: sql<number>`count(*)::int` }).from(roosters)
              .where(and(eq(roosters.locationId, destination.id), inArray(roosters.status, ["activo", "enfermo"]))),
            tx.select({ total: sql<number>`coalesce(sum(${broilerBatches.currentQuantity}), 0)::int` }).from(broilerBatches)
              .where(and(eq(broilerBatches.locationId, destination.id), inArray(broilerBatches.status, ["activo", "listo_sacrificio"]))),
          ]);
          const occupied = Number(henCount?.total || 0) + Number(roosterCount?.total || 0) + Number(batchCount?.total || 0);
          if (occupied + hatchlings > destination.capacity) {
            throw new Error(`La capacidad de ${destination.name} no alcanza para alojar las ${hatchlings} crías; registra otro lugar o ajusta su capacidad`);
          }
        }
      }

      if (females > 0) {
        const [acquisition] = await tx.insert(birdAcquisitions).values({
          date: today,
          acquisitionType: "cria_propia",
          species: "gallina",
          birdType: "gallina",
          quantity: females,
          breed,
          geneticLine,
          sourceBatchCode: `INC-${updated.id}`,
          motherHenId: updated.henId,
          fatherRoosterId: updated.roosterId,
          destinationLocationId,
          motherIdentifier: mother?.code || null,
          fatherIdentifier: father?.code || updated.roosterCode || null,
          birthDate: today,
          notes: originNote,
        }).returning({ id: birdAcquisitions.id });
        const codes = await nextCodesInTx(tx, hens, "G", females);
        const insertedHens = await tx.insert(hens).values(
          codes.map((code) => ({ code, breed, birthDate: today, status: "activa" as const, isBroody: false, acquisitionId: acquisition.id, locationId: destinationLocationId }))
        ).returning({ id: hens.id });
        if (destinationLocationId) await tx.insert(animalLocationMovements).values(insertedHens.map((hen) => ({
          henId: hen.id, fromLocationId: null, toLocationId: destinationLocationId, quantity: 1, date: today,
          reason: "Nacimiento por incubación", notes: `Adquisición ${acquisition.id}`,
        })));
        assignment.hensCreated = females;
      }

      if (males > 0) {
        if (assignedRoosters > 0) {
          const [acquisition] = await tx.insert(birdAcquisitions).values({
            date: today,
            acquisitionType: "cria_propia",
            species: "gallina",
            birdType: "gallo",
            quantity: assignedRoosters,
            breed,
            geneticLine,
            sourceBatchCode: `INC-${updated.id}`,
            motherHenId: updated.henId,
            fatherRoosterId: updated.roosterId,
            destinationLocationId,
            motherIdentifier: mother?.code || null,
            fatherIdentifier: father?.code || updated.roosterCode || null,
            birthDate: today,
            notes: originNote,
          }).returning({ id: birdAcquisitions.id });
          const codes = await nextCodesInTx(tx, roosters, "GA", assignedRoosters);
          const insertedRoosters = await tx.insert(roosters).values(
            codes.map((code) => ({ code, breed, birthDate: today, status: "activo" as const, acquisitionId: acquisition.id, locationId: destinationLocationId }))
          ).returning({ id: roosters.id });
          if (destinationLocationId) await tx.insert(animalLocationMovements).values(insertedRoosters.map((rooster) => ({
            roosterId: rooster.id, fromLocationId: null, toLocationId: destinationLocationId, quantity: 1, date: today,
            reason: "Nacimiento por incubación", notes: `Adquisición ${acquisition.id}`,
          })));
          assignment.roostersCreated = assignedRoosters;
        }

        if (assignedBatchQuantity > 0) {
          const [acquisition] = await tx.insert(birdAcquisitions).values({
            date: today,
            acquisitionType: "cria_propia",
            species: "pollo",
            birdType: "lote_pollos",
            quantity: assignedBatchQuantity,
            breed: "Pollo de engorde",
            geneticLine,
            sourceBatchCode: `INC-${updated.id}`,
            motherHenId: updated.henId,
            fatherRoosterId: updated.roosterId,
            destinationLocationId,
            motherIdentifier: mother?.code || null,
            fatherIdentifier: father?.code || updated.roosterCode || null,
            birthDate: today,
            notes: originNote,
          }).returning({ id: birdAcquisitions.id });
          const code = await nextSpeciesBatchCodeInTx(tx, "pollo");
          const [batch] = await tx.insert(broilerBatches).values({
            code,
            breed: "Pollo de engorde",
            startDate: today,
            initialQuantity: assignedBatchQuantity,
            currentQuantity: assignedBatchQuantity,
            acquisitionId: acquisition.id,
            locationId: destinationLocationId,
            targetWeeks: flockRules.defaultTargetWeeks,
            targetWeightKg: String(flockRules.defaultTargetWeightKg),
            notes: `Machos de eclosión (${updated.eggsHatched ?? 0} nacidos)`,
          }).returning();
          if (destinationLocationId) await tx.insert(animalLocationMovements).values({
            batchId: batch.id, fromLocationId: null, toLocationId: destinationLocationId, quantity: assignedBatchQuantity, date: today,
            reason: "Nacimiento por incubación", notes: `Adquisición ${acquisition.id}`,
          });
          assignment.batchCode = batch.code;
        }
      }
    }

    return { incubation: updated, assignment };
  });

  return NextResponse.json(result);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(incubation).where(eq(incubation.id, id)).limit(1);
    if (!existing) throw new Error("No encontrado");
    await assertDateNotClosed(tx, { date: existing.startDate });
    if (existing.isComplete) {
      throw new Error("No se puede eliminar una incubación ya completada porque generó crías trazadas");
    }
    await tx.delete(incubation).where(eq(incubation.id, id));
  });

  return NextResponse.json({ ok: true });
});

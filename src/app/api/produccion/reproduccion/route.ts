import { db } from "@/db";
import { animalLocationMovements, broilerBatches, farmLocations, reproductionEvents } from "@/db/schema";
import { and, desc, eq, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ApiHttpError, safeParseJson, withApiHandler } from "@/lib/api-handler";
import { addDaysIso, isDateOnly } from "@/lib/date-validation";
import { assertLocationEntryAllowed } from "@/lib/sanitary-locks";

export const dynamic = "force-dynamic";

const SPECIES_REPRO_CONFIG = {
  conejo: {
    label: "Conejos (F1 híbrido)",
    gestationDays: 31,
    palpationDay: 14,
    nestboxDay: 26,
    weaningDays: 32,
    maxRecommendedParities: 5,
    prefix: "L-CON-D",
    targetWeeks: 11,
    targetWeightKg: "2.40",
  },
  cuy: {
    label: "Cuyes mejorados",
    gestationDays: 67,
    palpationDay: 18,
    nestboxDay: 58,
    weaningDays: 18,
    maxRecommendedParities: 4,
    prefix: "L-CUY-D",
    targetWeeks: 13,
    targetWeightKg: "1.10",
  },
} as const;

type MammalSpecies = keyof typeof SPECIES_REPRO_CONFIG;
const VALID_EVENT_TYPES = new Set(["empadre", "palpacion", "nidal", "parto", "destete", "diagnostico"]);
const ELITE_DAM_GAIN_G_DAY = 32;

function normCode(value: unknown): string | null {
  if (value == null) return null;
  const clean = String(value).trim().toUpperCase();
  return clean || null;
}

async function detectLineageOverlap(
  tx: any,
  species: MammalSpecies,
  opts: {
    damCode: string;
    sireCode: string | null;
    damMotherCode: string | null;
    damFatherCode: string | null;
    sireMotherCode: string | null;
    sireFatherCode: string | null;
  },
): Promise<string | null> {
  if (!opts.sireCode) return null;
  if (opts.damCode === opts.sireCode) {
    return `Auto-empadre bloqueado: la hembra y el macho tienen el mismo código (${opts.damCode}).`;
  }

  // Enrich known parents from prior reproduction records if omitted on this mating
  const history = await tx
    .select({
      damCode: reproductionEvents.damCode,
      sireCode: reproductionEvents.sireCode,
      damMotherCode: reproductionEvents.damMotherCode,
      damFatherCode: reproductionEvents.damFatherCode,
      sireMotherCode: reproductionEvents.sireMotherCode,
      sireFatherCode: reproductionEvents.sireFatherCode,
    })
    .from(reproductionEvents)
    .where(
      and(
        eq(reproductionEvents.species, species),
        or(eq(reproductionEvents.damCode, opts.damCode), eq(reproductionEvents.sireCode, opts.sireCode)),
      ),
    );

  const damAncestors = new Set<string>([opts.damCode]);
  if (opts.damMotherCode) damAncestors.add(opts.damMotherCode);
  if (opts.damFatherCode) damAncestors.add(opts.damFatherCode);
  const sireAncestors = new Set<string>([opts.sireCode]);
  if (opts.sireMotherCode) sireAncestors.add(opts.sireMotherCode);
  if (opts.sireFatherCode) sireAncestors.add(opts.sireFatherCode);

  for (const row of history) {
    if (normCode(row.damCode) === opts.damCode) {
      if (normCode(row.damMotherCode)) damAncestors.add(normCode(row.damMotherCode)!);
      if (normCode(row.damFatherCode)) damAncestors.add(normCode(row.damFatherCode)!);
    }
    if (normCode(row.sireCode) === opts.sireCode) {
      if (normCode(row.sireMotherCode)) sireAncestors.add(normCode(row.sireMotherCode)!);
      if (normCode(row.sireFatherCode)) sireAncestors.add(normCode(row.sireFatherCode)!);
    }
  }

  for (const code of damAncestors) {
    if (sireAncestors.has(code)) {
      return `Riesgo de consanguinidad detectado: ${opts.damCode} y ${opts.sireCode} comparten ancestro o línea directa (${code}). Selecciona otro reproductor.`;
    }
  }
  return null;
}

async function nextWeanedBatchCode(tx: any, prefix: string): Promise<string> {
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

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const speciesParam = searchParams.get("species");
  const [rows, locations, batches] = await Promise.all([
    speciesParam && (speciesParam === "conejo" || speciesParam === "cuy")
      ? db.select().from(reproductionEvents).where(eq(reproductionEvents.species, speciesParam)).orderBy(desc(reproductionEvents.eventDate), desc(reproductionEvents.createdAt)).limit(300)
      : db.select().from(reproductionEvents).orderBy(desc(reproductionEvents.eventDate), desc(reproductionEvents.createdAt)).limit(300),
    db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations),
    db.select({ id: broilerBatches.id, code: broilerBatches.code }).from(broilerBatches),
  ]);

  const locNames = new Map(locations.map((l) => [l.id, l.name]));
  const batchCodes = new Map(batches.map((b) => [b.id, b.code]));

  const enriched = rows.map((row) => {
    const sp = (row.species === "cuy" ? "cuy" : "conejo") as MammalSpecies;
    const cfg = SPECIES_REPRO_CONFIG[sp];
    const gain = row.litterDailyGainG != null ? Number(row.litterDailyGainG) : null;
    const parity = Number(row.parityNumber || 1);
    return {
      ...row,
      locationName: row.locationId ? locNames.get(row.locationId) || null : null,
      batchCode: row.batchId ? batchCodes.get(row.batchId) || null : null,
      weanedBatchCode: row.weanedBatchId ? batchCodes.get(row.weanedBatchId) || null : null,
      cullRecommended: parity >= cfg.maxRecommendedParities,
      isEliteDam: gain != null && gain >= ELITE_DAM_GAIN_G_DAY,
    };
  });

  return NextResponse.json(enriched);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const speciesRaw = String(body.species || "").trim().toLowerCase();
  if (speciesRaw !== "conejo" && speciesRaw !== "cuy") {
    return NextResponse.json({ error: "Especie reproductiva inválida (usa conejo o cuy)" }, { status: 400 });
  }
  const species: MammalSpecies = speciesRaw;
  const cfg = SPECIES_REPRO_CONFIG[species];

  const eventType = String(body.eventType || "empadre").trim().toLowerCase();
  if (!VALID_EVENT_TYPES.has(eventType)) {
    return NextResponse.json({ error: "Tipo de evento reproductivo inválido" }, { status: 400 });
  }
  if (!isDateOnly(body.eventDate)) {
    return NextResponse.json({ error: "Fecha de evento inválida" }, { status: 400 });
  }
  const damCode = normCode(body.damCode);
  if (!damCode) {
    return NextResponse.json({ error: "El código o identificación de la hembra (madre) es requerido" }, { status: 400 });
  }
  const sireCode = normCode(body.sireCode);
  const damMotherCode = normCode(body.damMotherCode);
  const damFatherCode = normCode(body.damFatherCode);
  const sireMotherCode = normCode(body.sireMotherCode);
  const sireFatherCode = normCode(body.sireFatherCode);

  const created = await db.transaction(async (tx) => {
    if (eventType === "empadre") {
      const inbreedingErr = await detectLineageOverlap(tx, species, {
        damCode,
        sireCode,
        damMotherCode,
        damFatherCode,
        sireMotherCode,
        sireFatherCode,
      });
      if (inbreedingErr) {
        throw new ApiHttpError(409, inbreedingErr, { code: "INBREEDING_DETECTED" });
      }
    }

    let parentEvent: typeof reproductionEvents.$inferSelect | undefined;
    if (body.parentEventId) {
      [parentEvent] = await tx
        .select()
        .from(reproductionEvents)
        .where(eq(reproductionEvents.id, String(body.parentEventId)))
        .for("update");
      if (!parentEvent) throw new Error("Evento padre no encontrado");
    }

    const priorPartos = await tx
      .select({ id: reproductionEvents.id })
      .from(reproductionEvents)
      .where(
        and(
          eq(reproductionEvents.species, species),
          eq(reproductionEvents.damCode, damCode),
          eq(reproductionEvents.eventType, "parto"),
        ),
      );
    const defaultParity = eventType === "parto" || eventType === "empadre" ? priorPartos.length + 1 : (parentEvent?.parityNumber || Math.max(1, priorPartos.length));
    const parityNumber = body.parityNumber != null && Number.isSafeInteger(Number(body.parityNumber)) && Number(body.parityNumber) >= 1
      ? Number(body.parityNumber)
      : defaultParity;

    let expectedPalpationDate = body.expectedPalpationDate || null;
    let expectedNestboxDate = body.expectedNestboxDate || null;
    let expectedBirthDate = body.expectedBirthDate || null;
    if (eventType === "empadre") {
      expectedPalpationDate = expectedPalpationDate || addDaysIso(body.eventDate, cfg.palpationDay);
      expectedNestboxDate = expectedNestboxDate || addDaysIso(body.eventDate, cfg.nestboxDay);
      expectedBirthDate = expectedBirthDate || addDaysIso(body.eventDate, cfg.gestationDays);
    }

    const bornAlive = body.bornAlive != null && body.bornAlive !== "" ? Number(body.bornAlive) : null;
    const bornDead = body.bornDead != null && body.bornDead !== "" ? Number(body.bornDead) : 0;
    const litterBirthWeightG = body.litterBirthWeightG != null && body.litterBirthWeightG !== "" ? Number(body.litterBirthWeightG) : null;
    if (bornAlive != null && (!Number.isSafeInteger(bornAlive) || bornAlive < 0)) throw new Error("Nacidos vivos inválido");
    if (!Number.isSafeInteger(bornDead) || bornDead < 0) throw new Error("Nacidos muertos inválido");

    const weanedMales = body.weanedMales != null && body.weanedMales !== "" ? Number(body.weanedMales) : null;
    const weanedFemales = body.weanedFemales != null && body.weanedFemales !== "" ? Number(body.weanedFemales) : null;
    let weanedTotal = body.weanedTotal != null && body.weanedTotal !== "" ? Number(body.weanedTotal) : null;
    if (weanedTotal == null && (weanedMales != null || weanedFemales != null)) {
      weanedTotal = Number(weanedMales || 0) + Number(weanedFemales || 0);
    }
    const litterWeanWeightG = body.litterWeanWeightG != null && body.litterWeanWeightG !== "" ? Number(body.litterWeanWeightG) : null;
    let litterDailyGainG: string | null = body.litterDailyGainG != null && body.litterDailyGainG !== "" ? String(body.litterDailyGainG) : null;

    if (eventType === "destete") {
      if (weanedTotal == null || !Number.isSafeInteger(weanedTotal) || weanedTotal < 0) {
        throw new Error("Cantidad total destetada inválida");
      }
      if (weanedMales != null && weanedFemales != null && weanedMales + weanedFemales !== weanedTotal) {
        throw new Error("La suma de machos y hembras destetados debe coincidir con el total destetado");
      }
      if (litterDailyGainG == null && litterWeanWeightG != null) {
        const birthWeight = parentEvent?.litterBirthWeightG != null ? Number(parentEvent.litterBirthWeightG) : 0;
        let days: number = cfg.weaningDays;
        if (parentEvent?.eventDate) {
          const diffMs = new Date(`${body.eventDate}T12:00:00`).getTime() - new Date(`${parentEvent.eventDate}T12:00:00`).getTime();
          const parsedDays = Math.round(diffMs / 86400000);
          if (parsedDays > 0) days = parsedDays;
        }
        const gain = Math.max(0, (litterWeanWeightG - birthWeight) / days);
        litterDailyGainG = gain.toFixed(2);
      }
    }

    const effectiveLocationId = body.locationId || parentEvent?.locationId || null;
    let weanedBatchId: string | null = null;
    let weanedBatchCode: string | null = null;

    if (eventType === "destete" && body.createWeanedBatch !== false && (weanedTotal || 0) > 0) {
      if (!effectiveLocationId) {
        throw new Error("Selecciona el lugar de alojamiento para crear el lote destetado");
      }
      await assertLocationEntryAllowed(tx, {
        locationId: String(effectiveLocationId),
        species,
        date: body.eventDate,
        lock: true,
      });
      const code = await nextWeanedBatchCode(tx, cfg.prefix);
      const sexLabel = weanedMales != null && weanedFemales != null ? ` (${weanedMales}M / ${weanedFemales}H)` : "";
      const [batch] = await tx
        .insert(broilerBatches)
        .values({
          code,
          species: species as any,
          purpose: (body.weanPurpose || "engorde_carne") as any,
          breed: species === "cuy" ? "Cuy Mejorado" : "F1 Híbrido",
          startDate: body.eventDate,
          initialQuantity: weanedTotal!,
          currentQuantity: weanedTotal!,
          targetWeeks: cfg.targetWeeks,
          targetDays: cfg.targetWeeks * 7,
          targetWeightKg: cfg.targetWeightKg,
          locationId: String(effectiveLocationId),
          notes: `Destete de madre ${damCode}${sexLabel} · Parto #${parityNumber}`,
        })
        .returning();
      weanedBatchId = batch.id;
      weanedBatchCode = batch.code;
      await tx.insert(animalLocationMovements).values({
        batchId: batch.id,
        fromLocationId: null,
        toLocationId: String(effectiveLocationId),
        quantity: weanedTotal!,
        date: body.eventDate,
        reason: "Destete reproductivo",
        notes: `Madre ${damCode}${sexLabel}`,
      });
    }

    const status = eventType === "palpacion" && body.palpationResult === "negativa"
      ? "vacia"
      : eventType === "destete"
        ? "destetada"
        : eventType === "parto"
          ? "lactancia"
          : String(body.status || "activo");

    const [inserted] = await tx
      .insert(reproductionEvents)
      .values({
        species,
        eventType,
        eventDate: body.eventDate,
        damCode,
        sireCode,
        damMotherCode: damMotherCode || null,
        damFatherCode: damFatherCode || null,
        sireMotherCode: sireMotherCode || null,
        sireFatherCode: sireFatherCode || null,
        batchId: body.batchId || null,
        locationId: effectiveLocationId,
        parentEventId: body.parentEventId || null,
        parityNumber,
        expectedPalpationDate,
        expectedNestboxDate,
        expectedBirthDate,
        palpationResult: body.palpationResult || null,
        bornAlive,
        bornDead,
        litterBirthWeightG: litterBirthWeightG != null ? String(litterBirthWeightG) : null,
        weanedTotal,
        weanedMales,
        weanedFemales,
        litterWeanWeightG: litterWeanWeightG != null ? String(litterWeanWeightG) : null,
        litterDailyGainG,
        weanedBatchId,
        status,
        notes: body.notes || null,
      })
      .returning();

    if (parentEvent) {
      const nextParentStatus = eventType === "palpacion" && body.palpationResult === "negativa"
        ? "vacia"
        : eventType === "parto"
          ? "parida"
          : eventType === "destete"
            ? "destetada"
            : parentEvent.status;
      if (nextParentStatus !== parentEvent.status) {
        await tx
          .update(reproductionEvents)
          .set({ status: nextParentStatus, updatedAt: new Date() })
          .where(eq(reproductionEvents.id, parentEvent.id));
      }
    }

    const gainNum = inserted.litterDailyGainG != null ? Number(inserted.litterDailyGainG) : null;
    return {
      ...inserted,
      weanedBatchCode,
      cullRecommended: inserted.parityNumber >= cfg.maxRecommendedParities,
      isEliteDam: gainNum != null && gainNum >= ELITE_DAM_GAIN_G_DAY,
    };
  });

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object" || !body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }
  const [updated] = await db
    .update(reproductionEvents)
    .set({
      palpationResult: body.palpationResult !== undefined ? body.palpationResult : undefined,
      bornAlive: body.bornAlive !== undefined ? Number(body.bornAlive) : undefined,
      bornDead: body.bornDead !== undefined ? Number(body.bornDead) : undefined,
      status: body.status !== undefined ? String(body.status) : undefined,
      notes: body.notes !== undefined ? body.notes : undefined,
      updatedAt: new Date(),
    })
    .where(eq(reproductionEvents.id, String(body.id)))
    .returning();
  if (!updated) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  const [deleted] = await db.delete(reproductionEvents).where(eq(reproductionEvents.id, id)).returning({ id: reproductionEvents.id });
  if (!deleted) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  return NextResponse.json({ ok: true });
});

import { db } from "@/db";
import { incubation, hens, roosters, broilerBatches } from "@/db/schema";
import { eq, desc, sql, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import { assignMales, requiredRoosters } from "@/lib/flock";
import { getFlockRules, getIncubationDays } from "@/lib/settings";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const data = await db
    .select({
      id: incubation.id,
      henId: incubation.henId,
      henCode: hens.code,
      startDate: incubation.startDate,
      expectedHatchDate: incubation.expectedHatchDate,
      eggsSet: incubation.eggsSet,
      eggsHatched: incubation.eggsHatched,
      malesHatched: incubation.malesHatched,
      femalesHatched: incubation.femalesHatched,
      isComplete: incubation.isComplete,
      notes: incubation.notes,
      createdAt: incubation.createdAt,
    })
    .from(incubation)
    .leftJoin(hens, eq(incubation.henId, hens.id))
    .orderBy(desc(incubation.createdAt));
  return NextResponse.json(data);
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const eggsSet = Number(body.eggsSet);
  if (!Number.isInteger(eggsSet) || eggsSet < 1) {
    return NextResponse.json({ error: "La cantidad de huevos debe ser un entero mayor que cero" }, { status: 400 });
  }
  const startDate = new Date(body.startDate);
  if (isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Fecha de inicio inválida" }, { status: 400 });
  }
  const incubationDays = await getIncubationDays();
  const expectedHatch = new Date(startDate);
  expectedHatch.setDate(expectedHatch.getDate() + incubationDays);

  const created = await db.transaction(async (tx) => {
    if (body.henId) {
      const [hen] = await tx.select({ id: hens.id, status: hens.status }).from(hens).where(eq(hens.id, body.henId)).for("update");
      if (!hen) throw new Error("Gallina no encontrada");
      if (hen.status !== "activa") throw new Error("La gallina no está disponible para incubar");
      const [openIncubation] = await tx.select({ id: incubation.id }).from(incubation)
        .where(and(eq(incubation.henId, body.henId), eq(incubation.isComplete, false))).limit(1);
      if (openIncubation) throw new Error("La gallina ya tiene una incubación activa");
    }

    const [row] = await tx.insert(incubation).values({
      henId: body.henId || null,
      startDate: body.startDate,
      expectedHatchDate: expectedHatch.toISOString().split("T")[0],
      eggsSet,
      notes: body.notes || null,
    }).returning();

    // Update hen status to broody
    if (body.henId) {
      await tx.update(hens).set({ status: "empollando", isBroody: true, updatedAt: new Date() }).where(eq(hens.id, body.henId));
    }

    return row;
  });

  return NextResponse.json(created, { status: 201 });
});

/** Siguiente código secuencial con formato prefijo-### — debe llamarse DENTRO de una transacción */
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

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (typeof body.isComplete !== "boolean") return NextResponse.json({ error: "Estado de eclosión inválido" }, { status: 400 });

  const flockRules = await getFlockRules();

  const result = await db.transaction(async (tx) => {
    // Read existing record to detect idempotency (avoid re-creating birds on re-submit)
    const [before] = await tx.select().from(incubation).where(eq(incubation.id, body.id)).for("update");
    if (!before) throw new Error("No encontrado");
    const wasAlreadyComplete = !!before.isComplete;

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
      body.isComplete === false ||
      eggsHatched !== Number(before.eggsHatched || 0) ||
      malesHatched !== (before.malesHatched == null ? null : Number(before.malesHatched)) ||
      femalesHatched !== (before.femalesHatched == null ? null : Number(before.femalesHatched))
    )) {
      throw new Error("No se puede reabrir ni cambiar los conteos de una incubación ya completada");
    }

    // Serialize code generation across manual, acquisition, and incubation flows.
    // Lock before writing to these tables to avoid lock-upgrade deadlocks.
    if (body.isComplete && !wasAlreadyComplete) {
      if (before.henId || Number(femalesHatched) > 0) {
        await tx.execute(sql`LOCK TABLE ${hens} IN EXCLUSIVE MODE`);
      }
      if (Number(malesHatched) > 0) {
        await tx.execute(sql`LOCK TABLE ${roosters} IN EXCLUSIVE MODE`);
        await tx.execute(sql`LOCK TABLE ${broilerBatches} IN EXCLUSIVE MODE`);
      }
    }

    const [updated] = await tx.update(incubation).set({
      eggsHatched,
      malesHatched,
      femalesHatched,
      isComplete: body.isComplete ?? before.isComplete,
      notes: body.notes,
    }).where(eq(incubation.id, body.id)).returning();

    if (!updated) throw new Error("No encontrado");

    // If complete, update hen status back (only on first completion)
    if (body.isComplete && !wasAlreadyComplete && updated.henId) {
      await tx.update(hens).set({ status: "activa", isBroody: false, updatedAt: new Date() }).where(eq(hens.id, updated.henId));
    }

    // ─── Asignación automática de pollitos nacidos (solo en la primera completion) ───
    const assignment = { hensCreated: 0, roostersCreated: 0, batchCode: null as string | null };
    if (body.isComplete && !wasAlreadyComplete) {
      const females = femalesHatched || 0;
      const males = malesHatched || 0;

      // Raza base: heredada de la madre, o "Criolla" si no hay gallina asignada
      let breed = "Criolla";
      if (updated.henId) {
        const [mother] = await tx.select({ breed: hens.breed }).from(hens).where(eq(hens.id, updated.henId));
        if (mother) breed = mother.breed;
      }

      const today = new Date().toISOString().split("T")[0];

      if (females > 0) {
        const codes = await nextCodesInTx(tx, hens, "G", females);
        await tx.insert(hens).values(
          codes.map((code) => ({ code, breed, birthDate: today, status: "activa" as const, isBroody: false }))
        );
        assignment.hensCreated = females;
      }

      if (males > 0) {
        // Regla de parvada: 1 gallo por cada 10 gallinas del gallinero
        const [henRows, roosterRows] = await Promise.all([
          tx.select({ status: hens.status }).from(hens),
          tx.select({ id: roosters.id }).from(roosters).where(eq(roosters.status, "activo")),
        ]);
        const hensInCoop = henRows.filter((h) => isAvailableForExit(h.status)).length;
        const { toRoosters, toSlaughter } = assignMales(
          males,
          roosterRows.length,
          requiredRoosters(hensInCoop, flockRules.hensPerRooster),
        );

        if (toRoosters > 0) {
          const codes = await nextCodesInTx(tx, roosters, "GA", toRoosters);
          await tx.insert(roosters).values(
            codes.map((code) => ({ code, breed, birthDate: today, status: "activo" as const }))
          );
          assignment.roostersCreated = toRoosters;
        }

        if (toSlaughter > 0) {
          const existingCodes = await tx.select({ code: broilerBatches.code }).from(broilerBatches);
          let max = 0;
          for (const row of existingCodes) {
            const match = String(row.code).match(/^L-(\d+)$/);
            if (match) max = Math.max(max, Number(match[1]));
          }
          const nextNum = max + 1;
          const code = `L-${String(nextNum).padStart(3, "0")}`;
          const [batch] = await tx.insert(broilerBatches).values({
            code,
            breed: "Pollo de engorde",
            startDate: today,
            initialQuantity: toSlaughter,
            currentQuantity: toSlaughter,
            targetWeeks: flockRules.defaultTargetWeeks,
            targetWeightKg: String(flockRules.defaultTargetWeightKg),
            notes: `Machos de eclosión (${updated.eggsHatched ?? 0} nacidos)`,
          }).returning();
          assignment.batchCode = batch.code;
        }
      }
    }

    return { ...updated, assignment };
  });

  return NextResponse.json(result);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    // Get record to restore hen status if needed
    const [record] = await tx.select().from(incubation).where(eq(incubation.id, id)).for("update");
    if (!record) throw new Error("No encontrado");
    if (record.isComplete) throw new Error("No se puede eliminar una incubación completada porque originó registros de aves");
    if (record.henId) {
      const [hen] = await tx.select({ id: hens.id, status: hens.status }).from(hens).where(eq(hens.id, record.henId)).for("update");
      if (hen?.status === "empollando") {
        await tx.update(hens).set({ status: "activa", isBroody: false, updatedAt: new Date() }).where(eq(hens.id, record.henId));
      }
    }

    await tx.delete(incubation).where(eq(incubation.id, id));
  });
  return NextResponse.json({ ok: true });
});

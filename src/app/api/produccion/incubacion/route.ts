import { db } from "@/db";
import { incubation, hens, roosters, broilerBatches } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import { assignMales, requiredRoosters, FLOCK_RULES } from "@/lib/flock";
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
  const startDate = new Date(body.startDate);
  if (isNaN(startDate.getTime())) {
    return NextResponse.json({ error: "Fecha de inicio inválida" }, { status: 400 });
  }
  const expectedHatch = new Date(startDate);
  expectedHatch.setDate(expectedHatch.getDate() + 21); // 21 days incubation

  const created = await db.transaction(async (tx) => {
    const [row] = await tx.insert(incubation).values({
      henId: body.henId || null,
      startDate: body.startDate,
      expectedHatchDate: expectedHatch.toISOString().split("T")[0],
      eggsSet: body.eggsSet,
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

  const result = await db.transaction(async (tx) => {
    // Read existing record to detect idempotency (avoid re-creating birds on re-submit)
    const [before] = await tx.select().from(incubation).where(eq(incubation.id, body.id));
    if (!before) throw new Error("No encontrado");
    const wasAlreadyComplete = !!before.isComplete;

    const [updated] = await tx.update(incubation).set({
      eggsHatched: body.eggsHatched,
      malesHatched: body.malesHatched ?? null,
      femalesHatched: body.femalesHatched ?? null,
      isComplete: body.isComplete,
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
      const females = Number(body.femalesHatched) || 0;
      const males = Number(body.malesHatched) || 0;

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
        const { toRoosters, toSlaughter } = assignMales(males, roosterRows.length, requiredRoosters(hensInCoop));

        if (toRoosters > 0) {
          const codes = await nextCodesInTx(tx, roosters, "GA", toRoosters);
          await tx.insert(roosters).values(
            codes.map((code) => ({ code, breed, birthDate: today, status: "activo" as const }))
          );
          assignment.roostersCreated = toRoosters;
        }

        if (toSlaughter > 0) {
          // Lock to prevent concurrent batch code generation
          await tx.execute(sql`LOCK TABLE ${broilerBatches} IN EXCLUSIVE MODE`);
          const [maxRow] = await tx.select({ maxCode: sql<string>`max(${broilerBatches.code})` }).from(broilerBatches);
          const nextNum = maxRow?.maxCode ? parseInt(maxRow.maxCode.split("-")[1], 10) + 1 : 1;
          const code = `L-${String(nextNum).padStart(3, "0")}`;
          const [batch] = await tx.insert(broilerBatches).values({
            code,
            breed: "Pollo de engorde",
            startDate: today,
            initialQuantity: toSlaughter,
            currentQuantity: toSlaughter,
            targetWeeks: FLOCK_RULES.defaultTargetWeeks,
            targetWeightKg: String(FLOCK_RULES.defaultTargetWeightKg),
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
    const [record] = await tx.select().from(incubation).where(eq(incubation.id, id));
    if (record?.henId && !record.isComplete) {
      await tx.update(hens).set({ status: "activa", isBroody: false, updatedAt: new Date() }).where(eq(hens.id, record.henId));
    }

    await tx.delete(incubation).where(eq(incubation.id, id));
  });
  return NextResponse.json({ ok: true });
});

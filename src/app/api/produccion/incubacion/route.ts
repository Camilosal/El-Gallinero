import { db } from "@/db";
import { incubation, hens, roosters, broilerBatches } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isAvailableForExit } from "@/lib/lifecycle";
import { assignMales, requiredRoosters, FLOCK_RULES } from "@/lib/flock";

export const dynamic = "force-dynamic";

export async function GET() {
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
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const startDate = new Date(body.startDate);
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
}

/** Siguiente código secuencial con formato prefijo-### a partir de códigos existentes */
function nextCodes(existingCodes: string[], prefix: string, count: number): string[] {
  let max = 0;
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  for (const code of existingCodes) {
    const m = code.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return Array.from({ length: count }, (_, i) => `${prefix}-${String(max + i + 1).padStart(3, "0")}`);
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  let result;
  try {
    result = await db.transaction(async (tx) => {
    const [updated] = await tx.update(incubation).set({
      eggsHatched: body.eggsHatched,
      malesHatched: body.malesHatched ?? null,
      femalesHatched: body.femalesHatched ?? null,
      isComplete: body.isComplete,
      notes: body.notes,
    }).where(eq(incubation.id, body.id)).returning();

    if (!updated) throw new Error("No encontrado");

    // If complete, update hen status back
    if (body.isComplete && updated.henId) {
      await tx.update(hens).set({ status: "activa", isBroody: false, updatedAt: new Date() }).where(eq(hens.id, updated.henId));
    }

    // ─── Asignación automática de pollitos nacidos ───
    const assignment = { hensCreated: 0, roostersCreated: 0, batchCode: null as string | null };
    if (body.isComplete) {
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
        const existingCodes = (await tx.select({ code: hens.code }).from(hens)).map((h) => h.code);
        const codes = nextCodes(existingCodes, "G", females);
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
          const existingCodes = (await tx.select({ code: roosters.code }).from(roosters)).map((r) => r.code);
          const codes = nextCodes(existingCodes, "GA", toRoosters);
          await tx.insert(roosters).values(
            codes.map((code) => ({ code, breed, birthDate: today, status: "activo" as const }))
          );
          assignment.roostersCreated = toRoosters;
        }

        if (toSlaughter > 0) {
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
  } catch (e: any) {
    if (e.message === "No encontrado") {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
    throw e;
  }

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
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
}

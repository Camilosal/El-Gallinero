import { db } from "@/db";
import { eggProduction, eggProductionDetails, catalogos, hens } from "@/db/schema";
import { eq, desc, inArray, and, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Calculate expected daily egg production based on active hens and their growth stages.
 * Returns the total expected eggs per day.
 */
async function getExpectedDailyProduction(): Promise<number> {
  const today = new Date();

  const stages = await db
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)));

  let totalExpected = 0;

  for (const stage of stages) {
    const eggsPerHen = Number(stage.expectedEggsPerHen || 0);
    if (eggsPerHen <= 0) continue;

    const minWeeks = stage.minWeeks ?? 0;
    const maxWeeks = stage.maxWeeks;
    const minDate = new Date(today);
    minDate.setDate(minDate.getDate() - minWeeks * 7);

    let countResult;
    if (maxWeeks === null) {
      countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hens)
        .where(
          and(
            sql`${hens.birthDate}::date <= ${minDate.toISOString().split("T")[0]}::date`,
            or(eq(hens.status, "activa"), eq(hens.status, "empollando"))
          )
        );
    } else {
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() - maxWeeks * 7);
      countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(hens)
        .where(
          and(
            sql`${hens.birthDate}::date <= ${minDate.toISOString().split("T")[0]}::date`,
            sql`${hens.birthDate}::date > ${maxDate.toISOString().split("T")[0]}::date`,
            or(eq(hens.status, "activa"), eq(hens.status, "empollando"))
          )
        );
    }

    const henCount = countResult?.[0]?.count ?? 0;
    totalExpected += eggsPerHen * henCount;
  }

  return Math.round(totalExpected * 10) / 10;
}

// Threshold: actual production cannot exceed 150% of expected without explicit override
const VALIDATION_THRESHOLD = 1.5;

export async function GET() {
  const records = await db.select().from(eggProduction).orderBy(desc(eggProduction.date)).limit(100);
  const ids = records.map((r) => r.id);
  const details = ids.length
    ? await db.select().from(eggProductionDetails).where(inArray(eggProductionDetails.productionId, ids))
    : [];
  const byProd = new Map<string, { size: string; quantity: number }[]>();
  for (const d of details) {
    const arr = byProd.get(d.productionId) || [];
    arr.push({ size: d.size, quantity: d.quantity });
    byProd.set(d.productionId, arr);
  }
  return NextResponse.json(records.map((r) => ({ ...r, details: byProd.get(r.id) || [] })));
}

const toDetails = (sizes: unknown): { size: string; quantity: number }[] =>
  (Array.isArray(sizes) ? sizes : [])
    .map((x: { size?: string; quantity?: number }) => ({
      size: String(x.size ?? ""),
      quantity: Number(x.quantity) || 0,
    }))
    .filter((x) => x.size.length > 0);

async function handleSave(req: NextRequest, isUpdate: boolean) {
  const body = await req.json();
  const sizes = toDetails(body.sizes);
  const broken = Number(body.broken) || 0;
  const forIncubation = Number(body.forIncubation) || 0;
  const totalCollected = sizes.reduce((s, x) => s + x.quantity, 0) + broken + forIncubation;

  // Validate against expected production (unless override is set)
  if (totalCollected > 0 && !body.overrideValidation) {
    const expected = await getExpectedDailyProduction();
    if (expected > 0) {
      const limit = Math.ceil(expected * VALIDATION_THRESHOLD);
      if (totalCollected > limit) {
        return NextResponse.json(
          {
            warning: true,
            expected,
            actual: totalCollected,
            limit,
            error: `La producción registrada (${totalCollected}) supera el 50% de la producción esperada (${expected} huevos/día). Límite: ${limit}. Si es correcto, confirme para guardar.`,
          },
          { status: 409 }
        );
      }
    }
  }

  if (isUpdate) {
    const [updated] = await db.update(eggProduction).set({
      date: body.date,
      totalCollected,
      broken,
      forIncubation,
      notes: body.notes || null,
    }).where(eq(eggProduction.id, body.id)).returning();

    await db.delete(eggProductionDetails).where(eq(eggProductionDetails.productionId, body.id));
    if (sizes.length) {
      await db.insert(eggProductionDetails).values(
        sizes.map((x) => ({ productionId: updated.id, size: x.size, quantity: x.quantity }))
      );
    }
    return NextResponse.json(updated);
  }

  const [created] = await db.insert(eggProduction).values({
    date: body.date,
    totalCollected,
    broken,
    forIncubation,
    notes: body.notes || null,
  }).returning();

  if (sizes.length) {
    await db.insert(eggProductionDetails).values(
      sizes.map((x) => ({ productionId: created.id, size: x.size, quantity: x.quantity }))
    );
  }

  return NextResponse.json(created, { status: 201 });
}

export async function POST(req: NextRequest) {
  return handleSave(req, false);
}

export async function PUT(req: NextRequest) {
  return handleSave(req, true);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.delete(eggProduction).where(eq(eggProduction.id, id));
  return NextResponse.json({ ok: true });
}

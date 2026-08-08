import { db } from "@/db";
import { hens, catalogos, incubation, chickenSales, slaughter, mortalityRecords } from "@/db/schema";
import { eq, desc, and, sql, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { evaluateLifecycle, isAutoManaged, type StageRange } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";

/** Etapas de crecimiento activas (catálogo) */
async function getStages(): Promise<StageRange[]> {
  return db
    .select()
    .from(catalogos)
    .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
    .orderBy(sql`${catalogos.sortOrder}`);
}

export async function GET() {
  const [data, stages] = await Promise.all([
    db.select().from(hens).orderBy(desc(hens.createdAt)),
    getStages(),
  ]);

  // ─── Sincronización automática del ciclo de vida ───
  // Solo aplica a estados automáticos (activa / recomendada_sacrificio).
  const toRecommend: string[] = [];
  const toActivate: string[] = [];
  const enriched = data.map((hen) => {
    const lc = evaluateLifecycle(hen, stages);
    if (isAutoManaged(hen.status) && lc.status !== hen.status) {
      if (lc.status === "recomendada_sacrificio") toRecommend.push(hen.id);
      else toActivate.push(hen.id);
      hen = { ...hen, status: lc.status as typeof hen.status };
    }
    return { ...hen, stage: lc.stage, ageWeeks: lc.ageWeeks, lifecycleReasons: lc.reasons };
  });

  // Persistir transiciones (batch por estado destino)
  if (toRecommend.length > 0) {
    await db.update(hens).set({ status: "recomendada_sacrificio", updatedAt: new Date() }).where(inArray(hens.id, toRecommend));
  }
  if (toActivate.length > 0) {
    await db.update(hens).set({ status: "activa", updatedAt: new Date() }).where(inArray(hens.id, toActivate));
  }

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const stages = await getStages();

  // Resolver estado automático a partir del estado inicial registrado
  let status = body.status || "activa";
  if (isAutoManaged(status)) {
    status = evaluateLifecycle({ birthDate: body.birthDate, weight: body.weight || null, status }, stages).status;
  }

  const [created] = await db.insert(hens).values({
    code: body.code,
    breed: body.breed,
    birthDate: body.birthDate,
    status,
    weight: body.weight || null,
    notes: body.notes || null,
    isBroody: body.isBroody || false,
    clutchSize: body.clutchSize || 0,
  }).returning();

  const lc = evaluateLifecycle(created, stages);
  return NextResponse.json({ ...created, stage: lc.stage, ageWeeks: lc.ageWeeks, lifecycleReasons: lc.reasons }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const stages = await getStages();

  // Si el estado enviado es automático, resolverlo según edad/peso
  let status = body.status;
  if (status && isAutoManaged(status)) {
    status = evaluateLifecycle({ birthDate: body.birthDate, weight: body.weight || null, status }, stages).status;
  }

  const [updated] = await db.update(hens).set({
    code: body.code,
    breed: body.breed,
    birthDate: body.birthDate,
    status,
    weight: body.weight,
    notes: body.notes,
    isBroody: body.isBroody,
    clutchSize: body.clutchSize,
    updatedAt: new Date(),
  }).where(eq(hens.id, body.id)).returning();

  const lc = evaluateLifecycle(updated, stages);
  return NextResponse.json({ ...updated, stage: lc.stage, ageWeeks: lc.ageWeeks, lifecycleReasons: lc.reasons });
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.transaction(async (tx) => {
    await tx.delete(incubation).where(eq(incubation.henId, id));
    await tx.delete(chickenSales).where(eq(chickenSales.henId, id));
    await tx.delete(slaughter).where(eq(slaughter.henId, id));
    await tx.delete(mortalityRecords).where(eq(mortalityRecords.henId, id));
    await tx.delete(hens).where(eq(hens.id, id));
  });
  return NextResponse.json({ ok: true });
}

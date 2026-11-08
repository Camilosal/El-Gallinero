import { db } from "@/db";
import {
  flockPlans,
  flockPlanMilestones,
  eggProduction,
  hens,
  roosters,
  broilerBatches,
  catalogos,
} from "@/db/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getFlockRules, getLifecycleRules } from "@/lib/settings";
import { isBatchPresent } from "@/lib/animal-status";
import {
  addDays,
  buildFlockPlanLive,
  buildFlockPlanProjection,
  buildFlockPlanSummary,
  parseISODate,
  startOfWeek,
  toISODate,
  type FlockPlanStage,
} from "@/lib/flock-plan";

export const dynamic = "force-dynamic";

/**
 * GET /api/produccion/plan-parvada
 *
 * Devuelve:
 * - `live`: diagnóstico de la parvada real (gallinas, postura, alimento, reemplazo).
 * - `projection`: 17 semanas (4 pasadas + actual + 12 futuras) calculadas con
 *   la edad real de cada gallina y los estándares del catálogo.
 * - `plans`: planes con su avance frente a la meta.
 */
export const GET = withApiHandler(async () => {
  const today = new Date();
  const currentWeekStart = startOfWeek(today);
  const fromDate = toISODate(addDays(currentWeekStart, -28));
  const sixDaysAgo = toISODate(addDays(today, -6));
  const sevenDaysAgo = toISODate(addDays(today, -7));
  const thirteenDaysAgo = toISODate(addDays(today, -13));

  const [henRows, roosterRows, batchRows, stageRows, eggRows, plans, lifecycleRules, flockRules] =
    await Promise.all([
      db.select({ code: hens.code, birthDate: hens.birthDate, status: hens.status }).from(hens),
      db.select({ status: roosters.status }).from(roosters),
      db.select({ status: broilerBatches.status, quantity: broilerBatches.currentQuantity }).from(broilerBatches),
      db
        .select()
        .from(catalogos)
        .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
        .orderBy(catalogos.sortOrder),
      db
        .select({ date: eggProduction.date, total: eggProduction.totalCollected })
        .from(eggProduction)
        .where(and(eq(eggProduction.species, "gallina"), gte(eggProduction.date, fromDate)))
        .orderBy(eggProduction.date),
      db.select().from(flockPlans).orderBy(desc(flockPlans.createdAt)),
      getLifecycleRules(),
      getFlockRules(),
    ]);

  const stages: FlockPlanStage[] = stageRows.map((stage) => ({
    id: stage.id,
    value: stage.value,
    minWeeks: stage.minWeeks ?? 0,
    maxWeeks: stage.maxWeeks,
    expectedEggsPerHen: stage.expectedEggsPerHen,
    dailyFeedG: stage.dailyFeedG,
  }));

  const weeklyEggMap = new Map<string, number>();
  let last7Eggs = 0;
  let previous7Eggs = 0;

  for (const row of eggRows) {
    const date = parseISODate(row.date);
    const weekStart = toISODate(startOfWeek(date));
    weeklyEggMap.set(weekStart, (weeklyEggMap.get(weekStart) || 0) + Number(row.total));

    if (row.date >= sixDaysAgo) {
      last7Eggs += Number(row.total);
    } else if (row.date >= thirteenDaysAgo && row.date <= sevenDaysAgo) {
      previous7Eggs += Number(row.total);
    }
  }

  const presentBatches = batchRows.filter((batch) => isBatchPresent(batch.status, batch.quantity));
  const input = {
    today,
    hens: henRows,
    roosterStatuses: roosterRows.map((row) => row.status),
    batchCount: presentBatches.length,
    batchQuantity: presentBatches.reduce((sum, batch) => sum + Number(batch.quantity), 0),
    stages,
    finPosturaWeeks: lifecycleRules.finPosturaWeeks,
    hensPerRooster: flockRules.hensPerRooster,
    last7Eggs,
    previous7Eggs,
    eggWeeks: Array.from(weeklyEggMap.entries()).map(([weekStart, totalEggs]) => ({
      weekStart,
      totalEggs,
    })),
  };

  const live = buildFlockPlanLive(input);
  const projection = buildFlockPlanProjection(input);

  const plansWithSummary = plans.map((plan) => ({
    ...plan,
    summary: buildFlockPlanSummary(
      {
        startDate: plan.startDate,
        targetHenCount: plan.targetHenCount,
        targetRoosterCount: plan.targetRoosterCount,
        replacementDate: plan.replacementDate,
      },
      live,
      today,
    ),
  }));

  return NextResponse.json({
    today: toISODate(today),
    finPosturaWeeks: lifecycleRules.finPosturaWeeks,
    live,
    projection,
    plans: plansWithSummary,
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { name, startDate, targetHenCount, targetRoosterCount, replacementDate, notes } = body;

  if (!name || !startDate || !targetHenCount) {
    return NextResponse.json(
      { error: "Nombre, fecha inicio y cantidad de gallinas son requeridos" },
      { status: 400 },
    );
  }

  const [plan] = await db
    .insert(flockPlans)
    .values({
      name,
      startDate,
      targetHenCount,
      targetRoosterCount: targetRoosterCount || null,
      replacementDate: replacementDate || null,
      currentPhase: "en_curso",
      status: "activo",
      notes: notes || null,
    })
    .returning();

  return NextResponse.json(plan, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const [existing] = await db.select().from(flockPlans).where(eq(flockPlans.id, body.id));
  if (!existing) {
    return NextResponse.json({ error: "Plan no encontrado" }, { status: 404 });
  }

  const [updated] = await db
    .update(flockPlans)
    .set({
      name: body.name ?? existing.name,
      startDate: body.startDate ?? existing.startDate,
      targetHenCount: body.targetHenCount ?? existing.targetHenCount,
      targetRoosterCount:
        body.targetRoosterCount !== undefined ? body.targetRoosterCount : existing.targetRoosterCount,
      replacementDate:
        body.replacementDate !== undefined ? body.replacementDate : existing.replacementDate,
      currentPhase: body.currentPhase ?? existing.currentPhase,
      status: body.status ?? existing.status,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      updatedAt: new Date(),
    })
    .where(eq(flockPlans.id, body.id))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.delete(flockPlanMilestones).where(eq(flockPlanMilestones.planId, id));
    await tx.delete(flockPlans).where(eq(flockPlans.id, id));
  });
  return NextResponse.json({ ok: true });
});

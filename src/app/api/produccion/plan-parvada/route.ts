import { db } from "@/db";
import { flockPlans, flockPlanMilestones, eggProduction } from "@/db/schema";
import { eq, desc, sql, gte, lte, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const plans = await db
    .select()
    .from(flockPlans)
    .orderBy(desc(flockPlans.createdAt));

  const result = await Promise.all(
    plans.map(async (plan) => {
      const milestones = await db
        .select()
        .from(flockPlanMilestones)
        .where(eq(flockPlanMilestones.planId, plan.id))
        .orderBy(flockPlanMilestones.weekNumber);

      // Enrich milestones with actual egg production data
      const enrichedMilestones = await Promise.all(
        milestones.map(async (m) => {
          // Calculate the date range for this week
          const startDate = new Date(plan.startDate + "T12:00:00");
          startDate.setDate(startDate.getDate() + (m.weekNumber - 1) * 7);
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + 6);
          const startStr = startDate.toISOString().split("T")[0];
          const endStr = endDate.toISOString().split("T")[0];

          const [actualEggs] = await db
            .select({ total: sql<number>`coalesce(sum(${eggProduction.totalCollected}), 0)::int` })
            .from(eggProduction)
            .where(and(gte(eggProduction.date, startStr), lte(eggProduction.date, endStr)));

          return {
            ...m,
            actualEggsPerWeek: m.actualEggsPerWeek ?? actualEggs?.total ?? null,
          };
        })
      );

      return { ...plan, milestones: enrichedMilestones };
    })
  );

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, startDate, targetHenCount, targetRoosterCount, replacementDate, notes } = body;

  if (!name || !startDate || !targetHenCount) {
    return NextResponse.json({ error: "Nombre, fecha inicio y cantidad de gallinas son requeridos" }, { status: 400 });
  }

  const result = await db.transaction(async (tx) => {
    const [plan] = await tx
      .insert(flockPlans)
      .values({
        name,
        startDate,
        targetHenCount,
        targetRoosterCount: targetRoosterCount || null,
        replacementDate: replacementDate || null,
        currentPhase: "inicio",
        status: "activo",
        notes: notes || null,
      })
      .returning();

    // Auto-generate 80 weekly milestones
    const milestones = [];
    for (let week = 1; week <= 80; week++) {
      // Expected production curve: ramp up weeks 1-20, peak 20-40, decline after
      let expectedEggsPerWeek: number;
      const hens = targetHenCount;

      if (week <= 5) {
        // Growing phase, no eggs
        expectedEggsPerWeek = 0;
      } else if (week <= 20) {
        // Ramp up: 0 to peak
        const rampPct = (week - 5) / 15;
        const eggsPerHenPerDay = rampPct * 0.85;
        expectedEggsPerWeek = Math.round(hens * eggsPerHenPerDay * 7);
      } else if (week <= 40) {
        // Peak production
        const eggsPerHenPerDay = 0.85 - ((week - 20) * 0.002);
        expectedEggsPerWeek = Math.round(hens * eggsPerHenPerDay * 7);
      } else if (week <= 60) {
        // Gradual decline
        const eggsPerHenPerDay = 0.81 - ((week - 40) * 0.005);
        expectedEggsPerWeek = Math.round(hens * Math.max(0.3, eggsPerHenPerDay) * 7);
      } else {
        // Late decline
        const eggsPerHenPerDay = 0.71 - ((week - 60) * 0.008);
        expectedEggsPerWeek = Math.round(hens * Math.max(0.1, eggsPerHenPerDay) * 7);
      }

      // Expected feed: ~110g/hen/day for laying, ~80g for growing
      const feedPerHen = week <= 20 ? 0.08 : 0.11;
      const expectedFeedKg = parseFloat((hens * feedPerHen * 7).toFixed(2));

      // Expected hens with mortality (~2% cumulative)
      const mortalityRate = Math.min(0.15, week * 0.001);
      const expectedHens = Math.round(hens * (1 - mortalityRate));

      const [milestone] = await tx
        .insert(flockPlanMilestones)
        .values({
          planId: plan.id,
          weekNumber: week,
          expectedHens,
          expectedEggsPerWeek,
          expectedFeedKgPerWeek: String(expectedFeedKg),
        })
        .returning();

      milestones.push(milestone);
    }

    return { ...plan, milestones };
  });

  return NextResponse.json(result, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
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
      targetRoosterCount: body.targetRoosterCount !== undefined ? body.targetRoosterCount : existing.targetRoosterCount,
      replacementDate: body.replacementDate !== undefined ? body.replacementDate : existing.replacementDate,
      currentPhase: body.currentPhase ?? existing.currentPhase,
      status: body.status ?? existing.status,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      updatedAt: new Date(),
    })
    .where(eq(flockPlans.id, body.id))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    await tx.delete(flockPlanMilestones).where(eq(flockPlanMilestones.planId, id));
    await tx.delete(flockPlans).where(eq(flockPlans.id, id));
  });
  return NextResponse.json({ ok: true });
}

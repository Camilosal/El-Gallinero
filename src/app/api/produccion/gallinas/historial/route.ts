import { db } from "@/db";
import { hens, chickenSales, slaughter, healthControl, mortalityRecords, incubation } from "@/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { evaluateLifecycle } from "@/lib/lifecycle";
import { getLifecycleRules } from "@/lib/settings";
import { catalogos } from "@/db/schema";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

/** GET /api/produccion/gallinas/historial?henId=UUID */
export const GET = withApiHandler(async (req: NextRequest) => {
  const henId = new URL(req.url).searchParams.get("henId");
  if (!henId) return NextResponse.json({ error: "henId requerido" }, { status: 400 });

  const [henData] = await db.select().from(hens).where(eq(hens.id, henId));
  if (!henData) return NextResponse.json({ error: "Gallina no encontrada" }, { status: 404 });

  // Get lifecycle info
  const [stages, lifecycleRules] = await Promise.all([
    db
      .select()
      .from(catalogos)
      .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.isActive, true)))
      .orderBy(sql`${catalogos.sortOrder}`),
    getLifecycleRules(),
  ]);

  const lc = evaluateLifecycle(henData, stages, lifecycleRules);
  const enrichedHen = { ...henData, stage: lc.stage, ageWeeks: lc.ageWeeks, lifecycleReasons: lc.reasons };

  // Fetch related events in parallel
  const [sales, slaughterRecords, healthRecords, mortalityRecs, incubationRecords] = await Promise.all([
    db.select().from(chickenSales).where(eq(chickenSales.henId, henId)).orderBy(desc(chickenSales.date)),
    db.select().from(slaughter).where(eq(slaughter.henId, henId)).orderBy(desc(slaughter.date)),
    db
      .select()
      .from(healthControl)
      .where(sql`${healthControl.affectedHens} LIKE ${"%" + henId + "%"} OR ${healthControl.affectedHens} = 'todas'`)
      .orderBy(desc(healthControl.date)),
    db.select().from(mortalityRecords).where(eq(mortalityRecords.henId, henId)).orderBy(desc(mortalityRecords.date)),
    db.select().from(incubation).where(eq(incubation.henId, henId)).orderBy(desc(incubation.startDate)),
  ]);

  // Build unified timeline
  type HistoryEvent = { id: string; date: string; type: string; icon: string; title: string; detail: string; color: string };
  const timeline: HistoryEvent[] = [];

  for (const s of sales) {
    timeline.push({
      id: s.id,
      date: s.date,
      type: "venta",
      icon: "money",
      title: "Venta de ave",
      detail: `Comprador: ${s.buyer || "N/A"} — $${Number(s.totalAmount).toLocaleString()}`,
      color: "green",
    });
  }
  for (const sl of slaughterRecords) {
    timeline.push({
      id: sl.id,
      date: sl.date,
      type: "sacrificio",
      icon: "slaughter",
      title: "Sacrificio / Faena",
      detail: `Peso: ${sl.weightKg} kg — Destino: ${sl.destination}`,
      color: "blue",
    });
  }
  for (const h of healthRecords) {
    timeline.push({
      id: h.id,
      date: h.date,
      type: "sanidad",
      icon: "pill",
      title: h.type,
      detail: h.description + (h.product ? ` — ${h.product}` : ""),
      color: "purple",
    });
  }
  for (const m of mortalityRecs) {
    timeline.push({
      id: m.id,
      date: m.date,
      type: "mortalidad",
      icon: "mortality",
      title: `Muerte — ${m.cause}`,
      detail: m.description || "",
      color: "red",
    });
  }
  for (const inc of incubationRecords) {
    timeline.push({
      id: inc.id,
      date: inc.startDate,
      type: "incubacion",
      icon: "incubator",
      title: "Incubación",
      detail: `${inc.eggsSet} huevos → ${inc.eggsHatched} nacidos`,
      color: "yellow",
    });
  }

  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ hen: enrichedHen, timeline });
});

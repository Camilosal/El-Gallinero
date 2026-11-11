import { db } from "@/db";
import { catalogos, sanitaryCalendar, healthControl, supplyInventory, hens, appSettings } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { ageInWeeks, stageForAge, isAvailableForExit, type StageRange } from "@/lib/lifecycle";
import { SANITARY_CALENDAR_REVIEW_KEY } from "@/lib/onboarding";

export const dynamic = "force-dynamic";

// ─── Stage Health Protocols ───
// Defines what health actions should happen at each growth stage.
// This is the proactive core — like feeding programs for alimentación.
interface ProtocolAction {
  weekOffset: number;       // weeks from stage start to first occurrence
  type: string;             // vacunación, desparasitacion, vitaminas, inspeccion
  name: string;
  description: string;
  frequencyDays: number | null; // null = one-time, number = recurring
  withdrawalDays: number;
  supplyCategory: string | null; // expected supply category for resources
}

const STAGE_PROTOCOLS: Record<string, ProtocolAction[]> = {
  "Pollito": [
    { weekOffset: 0, type: "vacunacion", name: "Vacuna Marek", description: "Vacuna Marek día 1 (en criadero)", frequencyDays: null, withdrawalDays: 0, supplyCategory: "medicamento" },
    { weekOffset: 1, type: "vacunacion", name: "Newcastle + Bronquitis", description: "Newcastle B1 + IB H120, spray", frequencyDays: null, withdrawalDays: 0, supplyCategory: "medicamento" },
    { weekOffset: 3, type: "vacunacion", name: "Gumboro", description: "IBD intermediaria, agua", frequencyDays: null, withdrawalDays: 0, supplyCategory: "medicamento" },
    { weekOffset: 2, type: "vitaminas", name: "Vitaminas estrés", description: "Complejo vitamínico post-transporte", frequencyDays: null, withdrawalDays: 0, supplyCategory: "vitamina" },
    { weekOffset: 1, type: "inspeccion", name: "Revisión pollitos", description: "Control de adaptación, peso y uniformidad", frequencyDays: 7, withdrawalDays: 0, supplyCategory: null },
  ],
  "Juvenil": [
    { weekOffset: 0, type: "vacunacion", name: "Newcastle refuerzo", description: "ND LaSota + IB H120, agua", frequencyDays: null, withdrawalDays: 0, supplyCategory: "medicamento" },
    { weekOffset: 1, type: "desparasitacion", name: "Desparasitación interna", description: "Levamisol o Piperazina en agua", frequencyDays: null, withdrawalDays: 14, supplyCategory: "antiparasitario" },
    { weekOffset: 2, type: "vacunacion", name: "Viruela aviar (POX)", description: "Viruela aviar, ala", frequencyDays: null, withdrawalDays: 0, supplyCategory: "medicamento" },
    { weekOffset: 3, type: "inspeccion", name: "Control peso y uniformidad", description: "Pesaje muestral, evaluar desarrollo", frequencyDays: 14, withdrawalDays: 0, supplyCategory: null },
    { weekOffset: 0, type: "vitaminas", name: "Vitaminas crecimiento", description: "Complejo B + D3 en agua", frequencyDays: 14, withdrawalDays: 0, supplyCategory: "vitamina" },
  ],
  "Pre-postura": [
    { weekOffset: 0, type: "vacunacion", name: "Pre-postura completa", description: "ND+IB+EDS inactivada", frequencyDays: null, withdrawalDays: 0, supplyCategory: "medicamento" },
    { weekOffset: 2, type: "desparasitacion", name: "Desparasitación pre-postura", description: "Ivermectina o Levamisol", frequencyDays: null, withdrawalDays: 14, supplyCategory: "antiparasitario" },
    { weekOffset: 1, type: "inspeccion", name: "Evaluación pre-postura", description: "Control de peso, uniformidad y madurez", frequencyDays: 7, withdrawalDays: 0, supplyCategory: null },
    { weekOffset: 0, type: "vitaminas", name: "Vitaminas pre-postura", description: "Vitamina E + Selenio, agua", frequencyDays: 7, withdrawalDays: 0, supplyCategory: "vitamina" },
  ],
  "Postura": [
    { weekOffset: 0, type: "vacunacion", name: "Newcastle refuerzo", description: "ND LaSota, agua (cada 8-10 sem)", frequencyDays: 63, withdrawalDays: 0, supplyCategory: "medicamento" },
    { weekOffset: 4, type: "desparasitacion", name: "Desparasitación periódica", description: "Levamisal cada 3-6 meses", frequencyDays: 180, withdrawalDays: 14, supplyCategory: "antiparasitario" },
    { weekOffset: 0, type: "vitaminas", name: "Vitaminas postura", description: "Complejo vitamínico mensual + Calcio", frequencyDays: 30, withdrawalDays: 0, supplyCategory: "vitamina" },
    { weekOffset: 2, type: "inspeccion", name: "Inspección sanitaria", description: "Revisión general de la parvada", frequencyDays: 14, withdrawalDays: 0, supplyCategory: null },
    { weekOffset: 0, type: "tratamiento", name: "Fumigación gallinero", description: "Control de ácaros y piojos", frequencyDays: 90, withdrawalDays: 7, supplyCategory: "insumo_limpieza" },
  ],
};

// ─── GET: Complete plan sanitario data ───
export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const daysAhead = Number(searchParams.get("days") || "30");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const futureDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const futureStr = futureDate.toISOString().split("T")[0];

  // Load all data in parallel
  const [stages, calendarEvents, healthRecords, supplies, allHens] = await Promise.all([
    // Stages with hen counts
    db.select({
      id: catalogos.id,
      value: catalogos.value,
      minWeeks: catalogos.minWeeks,
      maxWeeks: catalogos.maxWeeks,
      sortOrder: catalogos.sortOrder,
    }).from(catalogos)
      .where(eq(catalogos.category, "etapa_crecimiento"))
      .orderBy(catalogos.sortOrder),

    // Active calendar events
    db.select().from(sanitaryCalendar)
      .where(eq(sanitaryCalendar.isActive, true))
      .orderBy(sanitaryCalendar.nextDueDate),

    // Recent health control records (last 90 days)
    db.select().from(healthControl)
      .orderBy(desc(healthControl.date))
      .limit(100),

    // Supply inventory (sanitary-related)
    db.select().from(supplyInventory),

    // All hens for stage counting
    db.select({ id: hens.id, birthDate: hens.birthDate, status: hens.status }).from(hens),
  ]);

  // Calculate hen counts per stage using lifecycle helpers
  const stageRanges: StageRange[] = stages.map((s) => ({
    id: s.id,
    value: s.value,
    minWeeks: s.minWeeks,
    maxWeeks: s.maxWeeks,
  }));
  const henCountMap: Record<string, number> = {};
  for (const hen of allHens) {
    if (!isAvailableForExit(hen.status)) continue;
    const weeks = ageInWeeks(hen.birthDate, today);
    const stage = stageForAge(stageRanges, weeks);
    if (stage) henCountMap[stage.value] = (henCountMap[stage.value] || 0) + 1;
  }

  const stagesData = stages.map((s) => ({
    ...s,
    henCount: henCountMap[s.value] || 0,
    protocol: STAGE_PROTOCOLS[s.value] || [],
  }));

  // Enrich calendar events with overdue/due-soon info
  const enrichedEvents = calendarEvents.map((e) => {
    const dueDate = new Date(e.nextDueDate + "T12:00:00");
    const diffMs = dueDate.getTime() - today.getTime();
    const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const isOverdue = e.nextDueDate < todayStr;
    const isDueSoon = !isOverdue && e.nextDueDate <= new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Find matching supply info
    const supplyCategory = findSupplyCategory(e.type);
    const matchingSupplies = supplyCategory
      ? supplies.filter((s) => s.category === supplyCategory && Number(s.currentStock) > 0)
      : [];

    return {
      ...e,
      isOverdue,
      isDueSoon,
      daysUntilDue,
      supplyCategory,
      availableSupplies: matchingSupplies.map((s) => ({
        id: s.id,
        name: s.name,
        currentStock: Number(s.currentStock),
        unit: s.unit,
        minStock: Number(s.minStock),
      })),
    };
  });

  // Upcoming actions (next N days)
  const upcomingActions = enrichedEvents.filter(
    (e) => !e.isOverdue && e.nextDueDate <= futureStr
  );

  // Overdue actions
  const overdueActions = enrichedEvents.filter((e) => e.isOverdue);

  // Supply status summary
  const supplyStatus = supplies.map((s) => {
    const currentStock = Number(s.currentStock);
    const minStock = Number(s.minStock);
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      unit: s.unit,
      currentStock,
      minStock,
      costPerUnit: Number(s.costPerUnit),
      isLow: currentStock <= minStock,
      isCritical: currentStock <= minStock * 0.5,
    };
  });

  // Execution history summary
  const last30d = healthRecords.filter((r) => {
    const d = new Date(r.date);
    return d >= new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  });

  const totalCost30d = last30d.reduce((sum, r) => sum + Number(r.cost || 0), 0);

  // Protocol compliance: compare what was planned vs what was executed
  const compliance = computeCompliance(enrichedEvents, healthRecords);

  return NextResponse.json({
    stages: stagesData,
    protocols: STAGE_PROTOCOLS,
    calendarEvents: enrichedEvents,
    upcomingActions,
    overdueActions,
    supplyStatus,
    recentExecutions: healthRecords.slice(0, 20),
    summary: {
      totalActiveEvents: calendarEvents.length,
      overdueCount: overdueActions.length,
      upcomingCount: upcomingActions.length,
      executedLast30d: last30d.length,
      costLast30d: totalCost30d,
      lowSupplyCount: supplyStatus.filter((s) => s.isLow).length,
      compliancePercent: compliance,
    },
  });
});

// ─── POST: Seed protocol events for a stage ───
// Creates sanitary calendar events from the stage protocol definition
export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  const { stageName, startDate, targetBirds } = body;

  if (!stageName || !startDate) {
    return NextResponse.json({ error: "stageName y startDate son requeridos" }, { status: 400 });
  }

  const protocol = STAGE_PROTOCOLS[stageName];
  if (!protocol) {
    return NextResponse.json({ error: `No hay protocolo definido para la etapa ${stageName}` }, { status: 400 });
  }

  const start = new Date(startDate + "T12:00:00");
  const events = protocol.map((action) => {
    const eventDate = new Date(start);
    eventDate.setDate(eventDate.getDate() + action.weekOffset * 7);
    return {
      type: action.type,
      name: action.name,
      description: action.description,
      targetBirds: targetBirds || "todas",
      frequencyDays: action.frequencyDays,
      nextDueDate: eventDate.toISOString().split("T")[0],
      withdrawalDays: action.withdrawalDays,
      isActive: true,
    };
  });

  const inserted = await db.insert(sanitaryCalendar).values(events).returning();
  await db.delete(appSettings).where(eq(appSettings.key, SANITARY_CALENDAR_REVIEW_KEY));
  return NextResponse.json({ created: inserted.length, events: inserted });
});

// ─── Helper functions ───

function findSupplyCategory(eventType: string): string | null {
  const map: Record<string, string> = {
    vacunacion: "medicamento",
    desparasitacion: "antiparasitario",
    tratamiento: "medicamento",
    vitaminas: "vitamina",
    fumigacion: "insumo_limpieza",
  };
  return map[eventType] || null;
}

function computeCompliance(
  events: { type: string; nextDueDate: string; isOverdue: boolean; lastHealthControlId: string | null }[],
  records: { id: string; date: string; type: string }[]
): number {
  // Simple compliance: % of non-overdue events
  if (events.length === 0) return 100;
  const onTime = events.filter((e) => !e.isOverdue).length;
  return Math.round((onTime / events.length) * 100);
}

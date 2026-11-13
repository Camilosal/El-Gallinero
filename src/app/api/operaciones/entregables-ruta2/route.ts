import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { DEFAULT_FARM_ID, getCurrentFarmId } from "@/db/tenant-context";
import {
  biosecurityLogs,
  broilerBatches,
  compostingPiles,
  costAllocations,
  dailyClosures,
  farmLocations,
  farms,
  farmSubscriptions,
  feedInventory,
  healthControl,
  hens,
  roosters,
  users,
} from "@/db/schema";
import { withApiHandler } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import {
  canPerformAction,
  forbiddenResponse,
  getPermissionsForRole,
  normalizeRole,
  PERMISSION_LABELS,
  ROLE_LABELS,
} from "@/lib/rbac";
import { addDaysIso, startOfColombiaYearIso, todayColombiaIso } from "@/lib/date-validation";
import { computeAnimalInventory } from "@/lib/animal-inventory";
import { computeAnalyticalAccounting } from "@/lib/analytics/contabilidad-analitica";
import { getProgressiveOnboardingState } from "@/lib/onboarding-server";
import {
  buildBarnQuickGuidePdf,
  buildCompostingPoePdf,
  buildWeek4HandoverActPdf,
  buildZonificationMapPdf,
  type BarnQuickGuidePdfData,
  type CompostingPoePdfData,
  type Ruta2DeliverableType,
  type Week4HandoverActPdfData,
  type WeekStatusItem,
  type ZonificationMapPdfData,
} from "@/lib/export/turnkey-pdf";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set<Ruta2DeliverableType>([
  "zonificacion",
  "guia-galpon",
  "compostaje-poe",
  "acta-entrega",
]);

const AVIAN_SPECIES = new Set(["gallina", "pollo", "codorniz", "pato"]);
const MAMMAL_SPECIES = new Set(["conejo", "cuy"]);
const SANITARY_EMPTY_DAYS_REQUIRED = 21;

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const rawType = (searchParams.get("tipo") || "acta-entrega").trim().toLowerCase();
  const format = (searchParams.get("format") || "pdf").trim().toLowerCase();

  if (!VALID_TYPES.has(rawType as Ruta2DeliverableType)) {
    return NextResponse.json(
      { error: "Tipo de entregable inválido. Usa: zonificacion, guia-galpon, compostaje-poe o acta-entrega." },
      { status: 400 },
    );
  }
  const tipo = rawType as Ruta2DeliverableType;

  const sessionUser = await getSessionUser();
  const normalizedRole = normalizeRole(sessionUser?.role);
  if (
    tipo === "acta-entrega" &&
    !canPerformAction(normalizedRole, "config:write") &&
    normalizedRole !== "veterinario"
  ) {
    return forbiddenResponse(
      "Solo propietario, gerente o veterinario pueden generar el Acta de Entrega Semana 4.",
    );
  }

  const today = todayColombiaIso();
  const periodFrom = startOfColombiaYearIso();
  const thirtyDaysAgo = addDaysIso(today, -30);
  const farmId = (sessionUser as { farmId?: string | null } | null)?.farmId || getCurrentFarmId() || DEFAULT_FARM_ID;

  const [
    onboardingState,
    farmRows,
    subRows,
    locRows,
    activeBatchRows,
    withdrawalRows,
    pilesRows,
    bioLogCountRows,
    farmUserRows,
    animalInventory,
    lastClosureRows,
    analytics,
    feedCountRows,
    hensCountRows,
    roostersCountRows,
    allocCountRows,
  ] = await Promise.all([
    getProgressiveOnboardingState({ evaluateTriggers: false }),
    db.select().from(farms).where(eq(farms.id, farmId)).limit(1),
    db
      .select()
      .from(farmSubscriptions)
      .where(eq(farmSubscriptions.farmId, farmId))
      .orderBy(desc(farmSubscriptions.updatedAt))
      .limit(1),
    db
      .select()
      .from(farmLocations)
      .where(eq(farmLocations.status, "activa"))
      .orderBy(asc(farmLocations.zoneType), asc(farmLocations.code)),
    db
      .select({
        id: broilerBatches.id,
        code: broilerBatches.code,
        species: broilerBatches.species,
      })
      .from(broilerBatches)
      .where(inArray(broilerBatches.status, ["activo", "listo_sacrificio"])),
    db
      .select({
        date: healthControl.date,
        type: healthControl.type,
        product: healthControl.product,
        species: healthControl.species,
        locationId: healthControl.locationId,
        batchId: healthControl.batchId,
        withdrawalUntilDate: healthControl.withdrawalUntilDate,
      })
      .from(healthControl)
      .where(and(isNotNull(healthControl.withdrawalUntilDate), gte(healthControl.withdrawalUntilDate, today)))
      .orderBy(desc(healthControl.withdrawalUntilDate)),
    db.select().from(compostingPiles).orderBy(desc(compostingPiles.startDate)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(biosecurityLogs)
      .where(gte(biosecurityLogs.date, thirtyDaysAgo)),
    db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        role: users.role,
      })
      .from(users)
      .where(eq(users.farmId, farmId))
      .orderBy(asc(users.name)),
    computeAnimalInventory(),
    db.select().from(dailyClosures).orderBy(desc(dailyClosures.closureDate)).limit(1),
    computeAnalyticalAccounting({ from: periodFrom, to: today, includeProrated: true }),
    db.select({ total: sql<number>`count(*)::int` }).from(feedInventory),
    db.select({ total: sql<number>`count(*)::int` }).from(hens).where(eq(hens.status, "activa")),
    db.select({ total: sql<number>`count(*)::int` }).from(roosters).where(eq(roosters.status, "activo")),
    db.select({ total: sql<number>`count(*)::int` }).from(costAllocations),
  ]);

  const farmRow = farmRows[0];
  const subRow = subRows[0];
  const farmName = onboardingState.farmProfile.name || farmRow?.name || "Granja Iwagé";
  const municipality = onboardingState.farmProfile.city || "Sin municipio";
  const altitudeMeters = onboardingState.farmProfile.altitudeMeters || "";
  const planCode = subRow?.planCode || farmRow?.planCode || "FREEMIUM_SEMILLA";

  const locMap = new Map(locRows.map((l) => [l.id, l]));
  const batchMap = new Map(activeBatchRows.map((b) => [b.id, b]));
  const userMap = new Map(farmUserRows.map((u) => [u.id, u.name]));

  // Evaluación biosegura de zonificación y aislamiento aves/mamíferos
  const mixedLocations: string[] = [];
  let hasQuarantineZone = false;
  let hasCompostZone = false;
  let pendingSanitaryLocations = 0;

  for (const loc of locRows) {
    const allowed = Array.isArray(loc.allowedSpecies) ? loc.allowedSpecies : [];
    const hasAvian = allowed.some((s) => AVIAN_SPECIES.has(s));
    const hasMammal = allowed.some((s) => MAMMAL_SPECIES.has(s));
    if (hasAvian && hasMammal) {
      mixedLocations.push(`${loc.name} (${loc.code})`);
    }
    if (loc.isQuarantine || loc.zoneType === "cuarentena" || loc.type === "cuarentena") {
      hasQuarantineZone = true;
    }
    if (loc.type === "compostaje" || loc.zoneType === "sucia") {
      hasCompostZone = true;
    }
    if (loc.sanitaryStatus === "pendiente_revision" || loc.sanitaryStatus === "no_cumple") {
      pendingSanitaryLocations++;
    }
  }

  const correctiveActions: string[] = [];
  if (locRows.length === 0) {
    correctiveActions.push("Registrar los galpones, corrales, jaulas y bodegas del predio en Lugares.");
  }
  if (mixedLocations.length > 0) {
    correctiveActions.push(
      `Separar físicamente aves y mamíferos en: ${mixedLocations.join(", ")} (Res. MADR 205/2022 e ICA 3650-3652).`,
    );
  }
  if (!hasQuarantineZone) {
    correctiveActions.push(
      "Designar al menos 1 área de Cuarentena / Aislamiento para aves nuevas o convalecientes.",
    );
  }
  if (!hasCompostZone) {
    correctiveActions.push(
      "Definir la Zona Sucia / Compostaje alejada de los galpones de postura (Res. ICA 30292/2017).",
    );
  }
  if (pendingSanitaryLocations > 0) {
    correctiveActions.push(
      `Completar revisión sanitaria en ${pendingSanitaryLocations} ubicación(es) pendientes o en no conformidad.`,
    );
  }

  const zonificationData: ZonificationMapPdfData = {
    farmName,
    municipality,
    altitudeMeters,
    generatedAt: today,
    locations: locRows.map((l) => ({
      code: l.code,
      name: l.name,
      type: l.type,
      zoneType: l.zoneType,
      allowedSpecies: Array.isArray(l.allowedSpecies) ? l.allowedSpecies : [],
      capacity: l.capacity ?? null,
      sanitaryStatus: l.sanitaryStatus,
      sanitaryEmptyUntil: l.sanitaryEmptyUntil ?? null,
      isQuarantine: Boolean(l.isQuarantine),
    })),
    hasMixedSpeciesConflict: mixedLocations.length > 0,
    mixedLocations,
    hasQuarantineZone,
    hasCompostZone,
    correctiveActions,
  };

  const barnQuickGuideData: BarnQuickGuidePdfData = {
    farmName,
    municipality,
    generatedAt: today,
    activeWithdrawals: withdrawalRows.map((w) => ({
      date: w.date,
      type: w.type,
      product: w.product || w.type,
      species: w.species || null,
      locationName: w.locationId ? locMap.get(w.locationId)?.name || null : null,
      batchCode: w.batchId ? batchMap.get(w.batchId)?.code || null : null,
      withdrawalUntilDate: String(w.withdrawalUntilDate),
    })),
  };

  const compostingPoeData: CompostingPoePdfData = {
    farmName,
    municipality,
    generatedAt: today,
    piles: pilesRows.map((p) => ({
      code: p.code,
      name: p.name,
      formulaRatio: p.formulaRatio,
      startDate: p.startDate,
      currentTempC: p.currentTempC ?? null,
      moisturePct: p.moisturePct ?? null,
      turnCount: p.turnCount,
      nextTurnDueDate: p.nextTurnDueDate ?? null,
      expectedHarvestDate: p.expectedHarvestDate ?? null,
      status: p.status,
      locationName: p.locationId ? locMap.get(p.locationId)?.name || null : null,
    })),
    recentBiosecurityCount30d: Number(bioLogCountRows[0]?.total || 0),
    sanitaryEmptyDaysRequired: SANITARY_EMPTY_DAYS_REQUIRED,
  };

  const feedCount = Number(feedCountRows[0]?.total || 0);
  const hensCount = Number(hensCountRows[0]?.total || 0);
  const roostersCount = Number(roostersCountRows[0]?.total || 0);
  const allocCount = Number(allocCountRows[0]?.total || 0);
  const lastClosureRow = lastClosureRows[0] || null;
  const bioLogs30d = Number(bioLogCountRows[0]?.total || 0);

  // Estado automático de las 4 Semanas Ruta 2
  const w1Status: WeekStatusItem["status"] =
    locRows.length >= 2 && mixedLocations.length === 0 && (hasQuarantineZone || hasCompostZone)
      ? "completado"
      : locRows.length >= 1
        ? "en_progreso"
        : "pendiente";

  const w2Status: WeekStatusItem["status"] =
    locRows.length > 0 && (activeBatchRows.length > 0 || hensCount > 0 || roostersCount > 0)
      ? "completado"
      : locRows.length > 0 || animalInventory.summary.totalAnimals > 0
        ? "en_progreso"
        : "pendiente";

  const w3ReadyForProrrateo =
    onboardingState.metrics.especiesActivas <= 1 || allocCount > 0;
  const w3Status: WeekStatusItem["status"] =
    feedCount > 0 && (pilesRows.length > 0 || bioLogs30d > 0) && w3ReadyForProrrateo
      ? "completado"
      : feedCount > 0 || pilesRows.length > 0 || onboardingState.config.scale === "MEDIANO"
        ? "en_progreso"
        : "pendiente";

  const w4Status: WeekStatusItem["status"] =
    farmUserRows.length >= 2 && Boolean(lastClosureRow)
      ? "completado"
      : farmUserRows.length >= 2 || Boolean(lastClosureRow)
        ? "en_progreso"
        : "pendiente";

  const roadmap: WeekStatusItem[] = [
    {
      week: 1,
      title: "Diagnóstico y Zonificación Biosegura",
      status: w1Status,
      evidence: `${locRows.length} lugar(es) · ${hasQuarantineZone ? "con cuarentena" : "sin cuarentena"} · ${mixedLocations.length === 0 ? "aislamiento OK" : `${mixedLocations.length} cruce(s) aves/mamíferos`}`,
    },
    {
      week: 2,
      title: "Identificación QR en Lote y Genealogía",
      status: w2Status,
      evidence: `${locRows.length + activeBatchRows.length} placas base (lugares+lotes) · ${hensCount + roostersCount} reproductores activos`,
    },
    {
      week: 3,
      title: "Analítica, Bodega 40 kg y Normativa ICA/NTC",
      status: w3Status,
      evidence: `${feedCount} insumo(s) · ${pilesRows.length} pila(s) compostaje · ${allocCount} regla(s) prorrateo · ${bioLogs30d} reg. POE 30d`,
    },
    {
      week: 4,
      title: "Roles RBAC y Marcha Blanca Auditada",
      status: w4Status,
      evidence: `${farmUserRows.length} usuario(s) · ${lastClosureRow ? `último cierre ${lastClosureRow.closureDate} (${lastClosureRow.status})` : "sin cierre diario aún"}`,
    },
  ];

  const snap = (lastClosureRow?.summarySnapshot || {}) as Record<string, unknown>;
  const handoverActData: Week4HandoverActPdfData = {
    farmName,
    municipality,
    altitudeMeters,
    scale: onboardingState.config.scale,
    planCode,
    generatedAt: today,
    periodFrom,
    periodTo: today,
    roadmap,
    team: farmUserRows.map((u) => {
      const role = normalizeRole(u.role);
      const perms = getPermissionsForRole(role);
      const permShort =
        role === "propietario" || role === "admin"
          ? "Control total + reapertura de cierres"
          : perms.map((p) => PERMISSION_LABELS[p].split(" ")[0]).slice(0, 4).join(", ");
      return {
        name: u.name,
        username: u.username,
        role,
        roleLabel: ROLE_LABELS[role] || u.role,
        keyPermissions: permShort,
      };
    }),
    census: animalInventory.species
      .filter((s) => s.count > 0)
      .map((s) => ({ species: s.species, label: s.label, count: s.count })),
    totalLiveAnimals: animalInventory.summary.totalAnimals,
    lastClosure: lastClosureRow
      ? {
          closureDate: lastClosureRow.closureDate,
          status: lastClosureRow.status,
          closedByName: lastClosureRow.closedBy ? userMap.get(lastClosureRow.closedBy) || null : null,
          eggsCollected: Number(snap.eggsCollected || 0),
          mortalityCount: Number(snap.mortalityUnits ?? snap.mortalityCount ?? 0),
          dayIncome: Number(snap.incomeCop ?? snap.dayIncome ?? 0),
          dayExpense: Number(snap.expenseCop ?? snap.dayExpense ?? 0),
        }
      : null,
    unitEconomics: {
      directRevenue: analytics.totals.directRevenue,
      directCost: analytics.totals.directCost,
      proratedCost: analytics.totals.proratedCost,
      totalCost: analytics.totals.totalCost,
      netProfit: analytics.totals.netProfit,
      realCostPerEgg: analytics.unitEconomics.eggs.realCostPerEgg,
      realCostPerTray30: analytics.unitEconomics.eggs.realCostPerTray30,
      avgSalePricePerEgg: analytics.unitEconomics.eggs.avgSalePricePerEgg,
      eggBreakevenAlert: analytics.unitEconomics.eggs.breakevenAlert,
      realCostPerLiveKg: analytics.unitEconomics.meat.realCostPerLiveKg,
      realCostPerCarcassKg: analytics.unitEconomics.meat.realCostPerCarcassKg,
      avgMeatSalePricePerKg: analytics.unitEconomics.meat.avgSalePricePerKg,
      meatBreakevenAlert: analytics.unitEconomics.meat.breakevenAlert,
    },
  };

  if (format === "json") {
    return NextResponse.json({
      generatedAt: today,
      tipo,
      farm: {
        farmId,
        farmName,
        municipality,
        altitudeMeters,
        scale: onboardingState.config.scale,
        planCode,
      },
      roadmap,
      zonification: zonificationData,
      barnQuickGuide: barnQuickGuideData,
      compostingPoe: compostingPoeData,
      handoverAct: handoverActData,
    });
  }

  let pdfBuffer: Buffer;
  if (tipo === "zonificacion") {
    pdfBuffer = buildZonificationMapPdf(zonificationData);
  } else if (tipo === "guia-galpon") {
    pdfBuffer = buildBarnQuickGuidePdf(barnQuickGuideData);
  } else if (tipo === "compostaje-poe") {
    pdfBuffer = buildCompostingPoePdf(compostingPoeData);
  } else {
    pdfBuffer = buildWeek4HandoverActPdf(handoverActData);
  }

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="iwage-${tipo}-${today}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});


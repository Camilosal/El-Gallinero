import { db } from "@/db";
import {
  biosecurityLogs,
  farmLocations,
  healthControl,
  animalLocationMovements,
  birdAcquisitions,
  dailyClosures,
} from "@/db/schema";
import { desc, eq, gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { isDateOnly, todayColombiaIso } from "@/lib/date-validation";
import { requirePermission } from "@/lib/rbac-server";
import { getSessionUser } from "@/lib/auth";
import { assertDateNotClosed } from "@/lib/sanitary-locks";
import { buildXlsxBytes, rowsToCsv, type CellValue } from "@/lib/export/xlsx";

export const dynamic = "force-dynamic";

const VALID_LOG_TYPES = new Set([
  "poe_gab",
  "bienestar_animal",
  "capacitacion",
  "ingreso_visitante",
  "desinfeccion",
]);

const VALID_WELFARE_SCORES = new Set([0, 20, 55, 100]);
const VALID_STATUSES = new Set(["cumple", "parcial", "no_cumple"]);

function addYearsIso(dateIso: string, years: number): string {
  const [y, m, d] = dateIso.split("-").map(Number);
  const dt = new Date(Date.UTC(y + years, (m || 1) - 1, d || 1, 12, 0, 0));
  return dt.toISOString().split("T")[0];
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00Z`).getTime();
  const b = new Date(`${toIso}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function inferCompliance(logType: string, welfareScore: number | null, checklist: Record<string, boolean | number | string>, provided?: unknown): string {
  if (typeof provided === "string" && VALID_STATUSES.has(provided)) return provided;
  if (logType === "bienestar_animal" && welfareScore !== null) {
    if (welfareScore >= 55) return "cumple";
    if (welfareScore >= 20) return "parcial";
    return "no_cumple";
  }
  const boolValues = Object.values(checklist).filter((v): v is boolean => typeof v === "boolean");
  if (boolValues.length > 0) {
    const passed = boolValues.filter(Boolean).length;
    const ratio = passed / boolValues.length;
    if (ratio >= 0.85) return "cumple";
    if (ratio >= 0.5) return "parcial";
    return "no_cumple";
  }
  return "cumple";
}

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const logTypeFilter = searchParams.get("logType");
  const exportMode = (searchParams.get("export") || "").toLowerCase();
  const today = todayColombiaIso();

  const [logs, locations] = await Promise.all([
    logTypeFilter && VALID_LOG_TYPES.has(logTypeFilter)
      ? db.select().from(biosecurityLogs).where(eq(biosecurityLogs.logType, logTypeFilter)).orderBy(desc(biosecurityLogs.date), desc(biosecurityLogs.createdAt)).limit(250)
      : db.select().from(biosecurityLogs).orderBy(desc(biosecurityLogs.date), desc(biosecurityLogs.createdAt)).limit(250),
    db.select().from(farmLocations),
  ]);

  const locationMap = new Map(locations.map((l) => [l.id, l]));
  const enriched = logs.map((l) => {
    const certUntil = l.trainingCertificateUntil;
    const certDaysLeft = certUntil ? daysBetweenIso(today, certUntil) : null;
    const certificateStatus = certUntil
      ? certDaysLeft !== null && certDaysLeft < 0
        ? "vencido"
        : certDaysLeft !== null && certDaysLeft <= 90
          ? "por_vencer"
          : "vigente"
      : null;

    return {
      ...l,
      locationName: l.locationId ? locationMap.get(l.locationId)?.name || null : null,
      certificateDaysLeft: certDaysLeft,
      certificateStatus,
    };
  });

  // Indicadores consolidados
  const welfareLogs = enriched.filter((l) => l.logType === "bienestar_animal" && l.welfareScore != null);
  const poeLogs = enriched.filter((l) => l.logType === "poe_gab");
  const poePassCount = poeLogs.filter((l) => l.complianceStatus === "cumple").length;
  const poeCompliancePct = poeLogs.length > 0 ? Math.round((poePassCount / poeLogs.length) * 100) : null;

  // Puntaje bioseguridad granja mixta (POE GAB + aislamiento multiespecie + bienestar)
  const activeLocs = locations.filter((l) => l.status === "activa");
  const isolatedLocs = activeLocs.filter((l) => l.allowedSpecies && l.allowedSpecies.length > 0).length;
  const isolationPct = activeLocs.length > 0 ? Math.round((isolatedLocs / activeLocs.length) * 100) : 100;
  const latestWelfare = welfareLogs[0]?.welfareScore ?? null;
  const mixedFarmScore = Math.round(
    (poeCompliancePct ?? 100) * 0.45 +
    isolationPct * 0.25 +
    (latestWelfare ?? 100) * 0.3,
  );

  const certAlerts = enriched
    .filter((l) => l.logType === "capacitacion" && l.trainingCertificateUntil && (l.certificateStatus === "vencido" || l.certificateStatus === "por_vencer"))
    .map((l) => ({
      id: l.id,
      staffName: l.staffName || "Personal sin nombre",
      trainingTopic: l.trainingTopic || "Capacitación bioseguridad",
      validUntil: l.trainingCertificateUntil,
      daysLeft: l.certificateDaysLeft,
      status: l.certificateStatus,
    }));

  if (exportMode === "json" || exportMode === "csv" || exportMode === "xlsx") {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().split("T")[0];
    const [healthRows, moveRows, acqRows, closureRows] = await Promise.all([
      db.select().from(healthControl).where(gte(healthControl.date, ninetyDaysAgo)).orderBy(desc(healthControl.date)),
      db.select().from(animalLocationMovements).where(gte(animalLocationMovements.date, ninetyDaysAgo)).orderBy(desc(animalLocationMovements.date)),
      db.select().from(birdAcquisitions).where(gte(birdAcquisitions.date, ninetyDaysAgo)).orderBy(desc(birdAcquisitions.date)),
      db.select().from(dailyClosures).where(gte(dailyClosures.closureDate, ninetyDaysAgo)).orderBy(desc(dailyClosures.closureDate)),
    ]);

    if (exportMode === "json") {
      return NextResponse.json(
        {
          generatedAt: new Date().toISOString(),
          authorityStandard: "ICA 3651/3652 · Res. 8452/2025 · INVIMA · GSMI",
          summary: {
            totalLogs: enriched.length,
            poeCompliancePct,
            latestWelfareScore: latestWelfare,
            mixedFarmBiosecurityScore: mixedFarmScore,
            certificateAlertsCount: certAlerts.length,
          },
          biosecurityLogs: enriched,
          healthTraceability: healthRows,
          gsmiMovements: moveRows,
          acquisitionsGsmi: acqRows.map((a) => ({
            id: a.id,
            date: a.date,
            species: a.species,
            quantity: a.quantity,
            originFarm: a.originFarm,
            originLocation: a.originLocation,
            healthEvidenceReference: a.healthEvidenceReference,
          })),
          locations,
          dailyClosures: closureRows,
        },
        {
          headers: {
            "Content-Disposition": `attachment; filename="auditoria-ica-invima-${today}.json"`,
          },
        },
      );
    }

    const bioHeaders = [
      "Fecha",
      "Tipo",
      "Lugar",
      "Especie",
      "Puntaje Bienestar Res 8452",
      "Cumplimiento",
      "Inspector / Personal",
      "Certificado Hasta (5 años)",
      "Desinfectante / Tema",
      "Notas",
    ];
    const bioRows: CellValue[][] = enriched.map((l) => [
      l.date,
      l.logType,
      l.locationName || "General granja",
      l.species || "todas",
      l.welfareScore ?? "",
      l.complianceStatus,
      l.inspectorName || l.staffName || "",
      l.trainingCertificateUntil || "",
      l.disinfectantUsed || l.trainingTopic || "",
      l.notes || "",
    ]);

    if (exportMode === "csv") {
      const csv = rowsToCsv(bioHeaders, bioRows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="auditoria-ica-invima-${today}.csv"`,
        },
      });
    }

    const healthHeaders = ["Fecha", "Especie", "Tipo", "Descripción", "Producto", "Lote Vacuna", "Lab", "Vencimiento", "Temp (°C)", "Vía", "Fin Retiro"];
    const healthCsvRows: CellValue[][] = healthRows.map((h) => [
      h.date,
      h.species || "gallina",
      h.type,
      h.description,
      h.product || "",
      h.vaccineLot || "",
      h.vaccineLab || "",
      h.vaccineExpiryDate || "",
      h.coldChainTempC || "",
      h.administrationRoute || "",
      h.withdrawalUntilDate || "",
    ]);

    const gsmiHeaders = ["Fecha", "Tipo", "Especie", "Cantidad", "Origen / Desde", "Destino / Hacia", "Motivo / Ref. GSMI", "Notas"];
    const gsmiRows: CellValue[][] = [
      ...moveRows.map((m) => [
        m.date,
        "Traslado interno",
        "",
        m.quantity,
        m.fromLocationId ? locationMap.get(m.fromLocationId)?.name || m.fromLocationId : "Externo",
        locationMap.get(m.toLocationId)?.name || m.toLocationId,
        m.reason || "",
        m.notes || "",
      ]),
      ...acqRows.map((a) => [
        a.date,
        "Ingreso / Adquisición GSMI",
        a.species || "",
        a.quantity,
        [a.originFarm, a.originLocation].filter(Boolean).join(" - ") || "Proveedor externo",
        a.destinationLocationId ? locationMap.get(a.destinationLocationId)?.name || a.destinationLocationId : "Sin asignar",
        a.healthEvidenceReference || "",
        a.notes || "",
      ]),
    ];

    const bytes = buildXlsxBytes([
      { name: "Bioseguridad POE", rows: [bioHeaders, ...bioRows] },
      { name: "Sanidad y Retiros", rows: [healthHeaders, ...healthCsvRows] },
      { name: "Movilizaciones GSMI", rows: [gsmiHeaders, ...gsmiRows] },
    ]);

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="auditoria-ica-invima-${today}.xlsx"`,
      },
    });
  }

  return NextResponse.json({
    logs: enriched,
    summary: {
      totalLogs: enriched.length,
      poeCompliancePct,
      latestWelfareScore: latestWelfare,
      mixedFarmBiosecurityScore: mixedFarmScore,
      isolationPct,
      certificateAlerts: certAlerts,
    },
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("biosecurity:write");
  if (denied) return denied;

  const user = await getSessionUser();
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  if (!isDateOnly(body.date)) {
    return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  }
  const logType = String(body.logType || "").trim();
  if (!VALID_LOG_TYPES.has(logType)) {
    return NextResponse.json({ error: "Tipo de bitácora no válido" }, { status: 400 });
  }

  const rawWelfare = body.welfareScore !== undefined && body.welfareScore !== null && body.welfareScore !== ""
    ? Number(body.welfareScore)
    : null;
  if (rawWelfare !== null && !VALID_WELFARE_SCORES.has(rawWelfare)) {
    return NextResponse.json({ error: "El puntaje Res. 8452/2025 debe ser 0, 20, 55 o 100" }, { status: 400 });
  }

  const checklist: Record<string, boolean | number | string> =
    body.checklistItems && typeof body.checklistItems === "object" && !Array.isArray(body.checklistItems)
      ? body.checklistItems
      : {};
  const complianceStatus = inferCompliance(logType, rawWelfare, checklist, body.complianceStatus);

  const trainingCertificateUntil = logType === "capacitacion"
    ? (isDateOnly(body.trainingCertificateUntil) ? String(body.trainingCertificateUntil) : addYearsIso(String(body.date), 5))
    : (isDateOnly(body.trainingCertificateUntil) ? String(body.trainingCertificateUntil) : null);

  const created = await db.transaction(async (tx) => {
    await assertDateNotClosed(tx, { date: String(body.date) });
    const [row] = await tx.insert(biosecurityLogs).values({
      date: String(body.date),
      logType,
      locationId: typeof body.locationId === "string" && body.locationId ? body.locationId : null,
      species: typeof body.species === "string" && body.species ? body.species : null,
      checklistItems: checklist,
      welfareScore: rawWelfare,
      complianceStatus,
      inspectorName: typeof body.inspectorName === "string" && body.inspectorName.trim() ? body.inspectorName.trim() : null,
      staffName: typeof body.staffName === "string" && body.staffName.trim() ? body.staffName.trim() : null,
      trainingTopic: typeof body.trainingTopic === "string" && body.trainingTopic.trim() ? body.trainingTopic.trim() : null,
      trainingCertificateUntil,
      disinfectantUsed: typeof body.disinfectantUsed === "string" && body.disinfectantUsed.trim() ? body.disinfectantUsed.trim() : null,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      createdBy: user?.id && user.id !== "test-user" ? user.id : null,
    }).returning();
    return row;
  });

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("biosecurity:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body?.id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
  const logType = String(body.logType || "").trim();
  if (!VALID_LOG_TYPES.has(logType)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });

  const rawWelfare = body.welfareScore !== undefined && body.welfareScore !== null && body.welfareScore !== ""
    ? Number(body.welfareScore)
    : null;
  if (rawWelfare !== null && !VALID_WELFARE_SCORES.has(rawWelfare)) {
    return NextResponse.json({ error: "El puntaje Res. 8452/2025 debe ser 0, 20, 55 o 100" }, { status: 400 });
  }
  const checklist: Record<string, boolean | number | string> =
    body.checklistItems && typeof body.checklistItems === "object" && !Array.isArray(body.checklistItems)
      ? body.checklistItems
      : {};
  const complianceStatus = inferCompliance(logType, rawWelfare, checklist, body.complianceStatus);
  const trainingCertificateUntil = logType === "capacitacion"
    ? (isDateOnly(body.trainingCertificateUntil) ? String(body.trainingCertificateUntil) : addYearsIso(String(body.date), 5))
    : (isDateOnly(body.trainingCertificateUntil) ? String(body.trainingCertificateUntil) : null);

  const updated = await db.transaction(async (tx) => {
    await assertDateNotClosed(tx, { date: String(body.date) });
    const [row] = await tx.update(biosecurityLogs).set({
      date: String(body.date),
      logType,
      locationId: typeof body.locationId === "string" && body.locationId ? body.locationId : null,
      species: typeof body.species === "string" && body.species ? body.species : null,
      checklistItems: checklist,
      welfareScore: rawWelfare,
      complianceStatus,
      inspectorName: typeof body.inspectorName === "string" && body.inspectorName.trim() ? body.inspectorName.trim() : null,
      staffName: typeof body.staffName === "string" && body.staffName.trim() ? body.staffName.trim() : null,
      trainingTopic: typeof body.trainingTopic === "string" && body.trainingTopic.trim() ? body.trainingTopic.trim() : null,
      trainingCertificateUntil,
      disinfectantUsed: typeof body.disinfectantUsed === "string" && body.disinfectantUsed.trim() ? body.disinfectantUsed.trim() : null,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    }).where(eq(biosecurityLogs.id, body.id)).returning();
    if (!row) throw new Error("No encontrado");
    return row;
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("sanitary:write");
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    const [existing] = await tx.select().from(biosecurityLogs).where(eq(biosecurityLogs.id, id)).limit(1);
    if (!existing) throw new Error("No encontrado");
    await assertDateNotClosed(tx, { date: existing.date });
    await tx.delete(biosecurityLogs).where(eq(biosecurityLogs.id, id));
  });

  return NextResponse.json({ ok: true });
});

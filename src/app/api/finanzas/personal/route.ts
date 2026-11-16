import { and, desc, eq, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payrollEntries, staffProfiles } from "@/db/schema";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { todayColombiaIso } from "@/lib/date-validation";
import { normalizeFeedingSpecies } from "@/lib/species";
import { requirePermission } from "@/lib/rbac-server";
import { getTaxAndPayrollConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

const VALID_WORKER_KINDS = new Set(["productor", "apoyo"]);
const VALID_CONTRACT_TYPES = new Set(["propio", "jornal", "salario_fijo", "prestacion_servicios"]);
const VALID_PAY_PERIODS = new Set(["hora", "dia", "semana", "quincena", "mes"]);

export const GET = withApiHandler(async () => {
  const monthStart = `${todayColombiaIso().slice(0, 7)}-01`;

  const [profiles, monthEntries, taxConfig] = await Promise.all([
    db.select().from(staffProfiles).orderBy(desc(staffProfiles.isActive), staffProfiles.fullName),
    db.select().from(payrollEntries).where(gte(payrollEntries.date, monthStart)),
    getTaxAndPayrollConfig(),
  ]);

  let ownerImputedMonthCop = 0;
  let ownerCashMonthCop = 0;
  let supportCashMonthCop = 0;
  let pendingPayablesMonthCop = 0;

  for (const e of monthEntries) {
    const cost = Number(e.totalEmployerCostCop || 0);
    if (e.accountingMode === "imputed_economic") {
      ownerImputedMonthCop += cost;
    } else if (profiles.find((p) => p.id === e.staffId)?.workerKind === "productor") {
      ownerCashMonthCop += cost;
    } else {
      supportCashMonthCop += cost;
    }
    if (e.paymentStatus === "pendiente") {
      pendingPayablesMonthCop += Number(e.netPayableCop || 0);
    }
  }

  return NextResponse.json({
    profiles,
    taxConfig,
    monthSummary: {
      monthStart,
      ownerImputedMonthCop: Math.round(ownerImputedMonthCop * 100) / 100,
      ownerCashMonthCop: Math.round(ownerCashMonthCop * 100) / 100,
      supportCashMonthCop: Math.round(supportCashMonthCop * 100) / 100,
      pendingPayablesMonthCop: Math.round(pendingPayablesMonthCop * 100) / 100,
    },
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const fullName = String(body.fullName || "").trim();
  if (fullName.length < 2) {
    return NextResponse.json({ error: "El nombre completo es requerido" }, { status: 400 });
  }

  const workerKind = VALID_WORKER_KINDS.has(String(body.workerKind)) ? String(body.workerKind) : "apoyo";
  const contractType = VALID_CONTRACT_TYPES.has(String(body.contractType))
    ? String(body.contractType)
    : workerKind === "productor"
      ? "propio"
      : "jornal";
  const payPeriod = VALID_PAY_PERIODS.has(String(body.payPeriod)) ? String(body.payPeriod) : "dia";
  const baseRateCop = Number(body.baseRateCop);
  if (!Number.isFinite(baseRateCop) || baseRateCop <= 0) {
    return NextResponse.json({ error: "La tarifa base debe ser mayor a 0" }, { status: 400 });
  }

  const rawSpecies = typeof body.defaultSpecies === "string" && body.defaultSpecies.trim() ? body.defaultSpecies.trim() : null;
  const defaultSpecies = rawSpecies ? normalizeFeedingSpecies(rawSpecies) : null;
  if (rawSpecies && !defaultSpecies) {
    return NextResponse.json({ error: "Especie no válida" }, { status: 400 });
  }

  const applySocialSecurity = Boolean(body.applySocialSecurity);
  const employerBurdenPct = applySocialSecurity
    ? Math.max(0, Math.min(100, Number(body.employerBurdenPct ?? 0)))
    : 0;
  const workerDeductionPct = applySocialSecurity
    ? Math.max(0, Math.min(50, Number(body.workerDeductionPct ?? 0)))
    : 0;
  const arlRiskRatePct = Math.max(0, Math.min(10, Number(body.arlRiskRatePct ?? 0.522)));

  const [created] = await db
    .insert(staffProfiles)
    .values({
      fullName,
      documentId: typeof body.documentId === "string" && body.documentId.trim() ? body.documentId.trim() : null,
      workerKind,
      contractType,
      payPeriod,
      baseRateCop: baseRateCop.toFixed(2),
      roleLabel: typeof body.roleLabel === "string" && body.roleLabel.trim() ? body.roleLabel.trim() : null,
      defaultSpecies,
      defaultLocationId: typeof body.defaultLocationId === "string" && body.defaultLocationId ? body.defaultLocationId : null,
      applySocialSecurity,
      employerBurdenPct: employerBurdenPct.toFixed(2),
      workerDeductionPct: workerDeductionPct.toFixed(2),
      arlRiskRatePct: arlRiskRatePct.toFixed(3),
      isActive: body.isActive !== false,
      notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object" || !body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const [existing] = await db.select().from(staffProfiles).where(eq(staffProfiles.id, String(body.id)));
  if (!existing) {
    return NextResponse.json({ error: "Perfil de personal no encontrado" }, { status: 404 });
  }

  const baseRateCop = body.baseRateCop !== undefined ? Number(body.baseRateCop) : Number(existing.baseRateCop);
  if (!Number.isFinite(baseRateCop) || baseRateCop <= 0) {
    return NextResponse.json({ error: "La tarifa base debe ser mayor a 0" }, { status: 400 });
  }

  const applySocialSecurity =
    body.applySocialSecurity !== undefined ? Boolean(body.applySocialSecurity) : existing.applySocialSecurity;

  const rawSpecies = body.defaultSpecies !== undefined
    ? (typeof body.defaultSpecies === "string" && body.defaultSpecies.trim() ? body.defaultSpecies.trim() : null)
    : existing.defaultSpecies;
  const defaultSpecies = rawSpecies ? normalizeFeedingSpecies(rawSpecies) : null;
  if (rawSpecies && !defaultSpecies) {
    return NextResponse.json({ error: "Especie no válida" }, { status: 400 });
  }

  const [updated] = await db
    .update(staffProfiles)
    .set({
      fullName: body.fullName ? String(body.fullName).trim() : existing.fullName,
      documentId: body.documentId !== undefined ? (String(body.documentId || "").trim() || null) : existing.documentId,
      workerKind: body.workerKind && VALID_WORKER_KINDS.has(String(body.workerKind)) ? String(body.workerKind) : existing.workerKind,
      contractType: body.contractType && VALID_CONTRACT_TYPES.has(String(body.contractType)) ? String(body.contractType) : existing.contractType,
      payPeriod: body.payPeriod && VALID_PAY_PERIODS.has(String(body.payPeriod)) ? String(body.payPeriod) : existing.payPeriod,
      baseRateCop: baseRateCop.toFixed(2),
      roleLabel: body.roleLabel !== undefined ? (String(body.roleLabel || "").trim() || null) : existing.roleLabel,
      defaultSpecies,
      defaultLocationId: body.defaultLocationId !== undefined ? (body.defaultLocationId || null) : existing.defaultLocationId,
      applySocialSecurity,
      employerBurdenPct: applySocialSecurity
        ? Math.max(0, Math.min(100, Number(body.employerBurdenPct ?? existing.employerBurdenPct))).toFixed(2)
        : "0.00",
      workerDeductionPct: applySocialSecurity
        ? Math.max(0, Math.min(50, Number(body.workerDeductionPct ?? existing.workerDeductionPct))).toFixed(2)
        : "0.00",
      arlRiskRatePct: Math.max(0, Math.min(10, Number(body.arlRiskRatePct ?? existing.arlRiskRatePct))).toFixed(3),
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : existing.isActive,
      notes: body.notes !== undefined ? (String(body.notes || "").trim() || null) : existing.notes,
      updatedAt: new Date(),
    })
    .where(eq(staffProfiles.id, existing.id))
    .returning();

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  const [{ cnt }] = await db
    .select({ cnt: sql<number>`count(*)::int` })
    .from(payrollEntries)
    .where(eq(payrollEntries.staffId, id));

  if (cnt > 0) {
    const [archived] = await db
      .update(staffProfiles)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(staffProfiles.id, id)))
      .returning();
    if (!archived) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
    return NextResponse.json({ archived: true, profile: archived });
  }

  const [deleted] = await db.delete(staffProfiles).where(eq(staffProfiles.id, id)).returning();
  if (!deleted) return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 });
  return NextResponse.json({ deleted: true });
});

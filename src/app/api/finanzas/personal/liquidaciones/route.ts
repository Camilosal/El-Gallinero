import { and, desc, eq, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import {
  accountsPayable,
  costAllocations,
  farmLocations,
  payrollEntries,
  staffProfiles,
  transactions,
} from "@/db/schema";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { isDateOnly, todayColombiaIso } from "@/lib/date-validation";
import { normalizeFeedingSpecies } from "@/lib/species";
import { requirePermission } from "@/lib/rbac-server";
import { calculateTransportAllowanceCop, computePayrollLiquidation } from "@/lib/analytics/payroll-tax-supplies";
import {
  computeSuggestedProrationWeights,
  distributeAmountByWeights,
  formatProrationSpeciesLabel,
  VALID_PRORATION_BASES,
} from "@/lib/analytics/proration";
import { deleteTransactionsAndUnpaidAccounts } from "@/lib/financial-records";
import { getTaxAndPayrollConfig } from "@/lib/settings";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;
  const { searchParams } = new URL(req.url);
  const today = todayColombiaIso();
  const from = searchParams.get("from") || `${today.slice(0, 4)}-01-01`;
  const to = searchParams.get("to") || today;
  if (!isDateOnly(from) || !isDateOnly(to) || from > to) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const [rows, locations] = await Promise.all([
    db
      .select({
        entry: payrollEntries,
        staffName: staffProfiles.fullName,
        workerKind: staffProfiles.workerKind,
        contractType: staffProfiles.contractType,
        payPeriod: staffProfiles.payPeriod,
        roleLabel: staffProfiles.roleLabel,
      })
      .from(payrollEntries)
      .innerJoin(staffProfiles, eq(payrollEntries.staffId, staffProfiles.id))
      .where(and(gte(payrollEntries.date, from), lte(payrollEntries.date, to)))
      .orderBy(desc(payrollEntries.date), desc(payrollEntries.createdAt)),
    db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations),
  ]);

  const locNames = new Map(locations.map((l) => [l.id, l.name]));

  return NextResponse.json({
    from,
    to,
    entries: rows.map((r) => ({
      ...r.entry,
      staffName: r.staffName,
      workerKind: r.workerKind,
      contractType: r.contractType,
      payPeriod: r.payPeriod,
      roleLabel: r.roleLabel,
      locationName: r.entry.locationId ? locNames.get(r.entry.locationId) || null : null,
    })),
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const staffId = String(body.staffId || "");
  if (!staffId) return NextResponse.json({ error: "Selecciona una persona registrada" }, { status: 400 });
  if (!isDateOnly(body.date)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  const unitsWorked = Number(body.unitsWorked ?? 1);
  if (!Number.isFinite(unitsWorked) || unitsWorked <= 0) {
    return NextResponse.json({ error: "Los días/horas trabajados deben ser mayores a 0" }, { status: 400 });
  }

  const bonusesCop = Number(body.bonusesCop ?? 0);
  if (!Number.isFinite(bonusesCop) || bonusesCop < 0) {
    return NextResponse.json({ error: "Bonificaciones o extras inválidos" }, { status: 400 });
  }

  const accountingMode =
    body.accountingMode === "imputed_economic" ? "imputed_economic" : "cash_expense";
  const isCredit = accountingMode === "cash_expense" && Boolean(body.isCredit);
  const isOwnerLaborEstimate = body.ownerLaborEstimate === true;
  if (isCredit && body.dueDate && !isDateOnly(body.dueDate)) {
    return NextResponse.json({ error: "Fecha de vencimiento inválida" }, { status: 400 });
  }

  const rawSpecies = typeof body.species === "string" && body.species.trim() ? body.species.trim() : null;
  const species = rawSpecies ? normalizeFeedingSpecies(rawSpecies) : null;
  if (rawSpecies && !species) {
    return NextResponse.json({ error: "Especie no válida" }, { status: 400 });
  }
  const locationId = typeof body.locationId === "string" && body.locationId ? body.locationId : null;
  const prorationBasis =
    !species && !locationId && typeof body.prorationBasis === "string" && VALID_PRORATION_BASES.has(body.prorationBasis)
      ? body.prorationBasis
      : null;

  const [staff] = await db.select().from(staffProfiles).where(eq(staffProfiles.id, staffId));
  if (!staff) return NextResponse.json({ error: "Perfil de personal no encontrado" }, { status: 404 });
  if (isOwnerLaborEstimate && (accountingMode !== "imputed_economic" || staff.workerKind !== "productor")) {
    return NextResponse.json({ error: "La estimación solo aplica al trabajo propio como costo económico" }, { status: 400 });
  }
  if (isOwnerLaborEstimate && bonusesCop > 0) {
    return NextResponse.json({ error: "La estimación de trabajo propio no admite bonificaciones" }, { status: 400 });
  }

  const taxConfig = await getTaxAndPayrollConfig();
  const unitRateCop = Number(staff.baseRateCop);
  if (!Number.isFinite(unitRateCop) || unitRateCop < 0) {
    return NextResponse.json({ error: "Tarifa inválida" }, { status: 400 });
  }

  const ownerReferenceRateIncludesEmployerLoad =
    staff.workerKind === "productor" && staff.contractType === "propio" && staff.payPeriod === "hora";
  const applySocialSecurity = isOwnerLaborEstimate || ownerReferenceRateIncludesEmployerLoad
    ? false
    : Boolean(staff.applySocialSecurity);
  const employerBurdenPct = applySocialSecurity ? taxConfig.employerBurdenPct : 0;
  const workerDeductionPct = applySocialSecurity ? taxConfig.workerDeductionPct : 0;
  const reteFuenteRatePct = staff.contractType === "prestacion_servicios" ? taxConfig.reteServiciosPct : 0;
  const reteFuenteFixedCop = null;
  const transportAllowanceCop = calculateTransportAllowanceCop({
    eligible: !isOwnerLaborEstimate && staff.includeTransportAllowance,
    workerKind: staff.workerKind,
    contractType: staff.contractType,
    payPeriod: staff.payPeriod,
    unitsWorked,
    unitRateCop,
    smlmvCop: taxConfig.smlmvCop,
    allowanceMonthlyCop: taxConfig.transportAllowanceCop,
    maximumMonthlySmlmv: taxConfig.transportAllowanceMaxSmlmv,
    daysPerMonth: taxConfig.daysPerMonth,
    hoursPerDay: taxConfig.hoursPerDay,
    weeksPerMonth: taxConfig.weeksPerMonth,
    quincenasPerMonth: taxConfig.quincenasPerMonth,
  });
  if (!Number.isFinite(employerBurdenPct) || employerBurdenPct < 0 || employerBurdenPct > 100) {
    return NextResponse.json({ error: "El aporte del empleador debe estar entre 0% y 100%" }, { status: 400 });
  }
  if (!Number.isFinite(workerDeductionPct) || workerDeductionPct < 0 || workerDeductionPct > 50) {
    return NextResponse.json({ error: "La deducción del trabajador debe estar entre 0% y 50%" }, { status: 400 });
  }
  if (!Number.isFinite(reteFuenteRatePct) || reteFuenteRatePct < 0 || reteFuenteRatePct > 100) {
    return NextResponse.json({ error: "La retención debe estar entre 0% y 100%" }, { status: 400 });
  }
  if (reteFuenteFixedCop !== null && (!Number.isFinite(reteFuenteFixedCop) || reteFuenteFixedCop < 0)) {
    return NextResponse.json({ error: "El valor de retención es inválido" }, { status: 400 });
  }

  const liq = computePayrollLiquidation({
    unitsWorked,
    unitRateCop,
    bonusesCop,
    transportAllowanceCop,
    applySocialSecurity,
    employerBurdenPct,
    workerDeductionPct,
    reteFuenteRatePct,
    reteFuenteFixedCop,
  });

  if (liq.workerDeductionsCop + liq.reteFuenteCop > liq.grossPayCop) {
    return NextResponse.json({ error: "Las deducciones no pueden superar el valor bruto de la liquidación" }, { status: 400 });
  }

  if (liq.totalEmployerCostCop <= 0) {
    return NextResponse.json({ error: "El total de la liquidación debe ser mayor a 0" }, { status: 400 });
  }

  let ownerLaborAllocations: ReturnType<typeof distributeAmountByWeights> = [];
  if (body.ownerLaborAllocations !== undefined) {
    if (accountingMode !== "imputed_economic" || staff.workerKind !== "productor") {
      return NextResponse.json({ error: "El prorrateo por especie solo aplica al trabajo propio imputado" }, { status: 400 });
    }
    if (!Array.isArray(body.ownerLaborAllocations) || body.ownerLaborAllocations.length === 0) {
      return NextResponse.json({ error: "Incluye al menos una especie para prorratear el trabajo propio" }, { status: 400 });
    }
    if (species || locationId) {
      return NextResponse.json({ error: "Elige prorrateo por especies o asignación directa a un lugar, no ambos" }, { status: 400 });
    }

    const weightBySpecies = new Map<string, number>();
    for (const item of body.ownerLaborAllocations) {
      const normalizedSpecies = normalizeFeedingSpecies(String(item?.species || ""));
      const percentage = Number(item?.percentage);
      if (!normalizedSpecies || !Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
        return NextResponse.json({ error: "La distribución contiene una especie o porcentaje inválido" }, { status: 400 });
      }
      weightBySpecies.set(normalizedSpecies, (weightBySpecies.get(normalizedSpecies) || 0) + percentage);
    }

    const percentageSum = Array.from(weightBySpecies.values()).reduce((sum, value) => sum + value, 0);
    if (Math.abs(percentageSum - 100) > 0.1) {
      return NextResponse.json({ error: `Los porcentajes de trabajo propio deben sumar 100% (actual: ${percentageSum.toFixed(2)}%)` }, { status: 400 });
    }

    ownerLaborAllocations = distributeAmountByWeights(
      liq.totalEmployerCostCop,
      Array.from(weightBySpecies.entries()).map(([allocatedSpecies, weight]) => ({
        species: allocatedSpecies,
        locationId: null,
        batchId: null,
        label: formatProrationSpeciesLabel(allocatedSpecies),
        weight,
      })),
    );
  }

  const effectiveSpecies = isOwnerLaborEstimate ? null : species ?? staff.defaultSpecies ?? null;
  const effectiveLocationId = isOwnerLaborEstimate ? null : locationId ?? staff.defaultLocationId ?? null;

  const created = await db.transaction(async (tx) => {
    let linkedTransactionId: string | null = null;
    let linkedAllocationId: string | null = null;

    if (accountingMode === "cash_expense") {
      const [createdTx] = await tx
        .insert(transactions)
        .values({
          date: body.date,
          type: "egreso",
          category: "Mano de obra",
          description: `${staff.workerKind === "productor" ? "Pago trabajo propio" : "Nómina / jornal"}: ${staff.fullName} (${unitsWorked} ${staff.payPeriod})`,
          counterparty: staff.fullName,
          amount: liq.totalEmployerCostCop.toFixed(2),
          subtotalAmount: liq.grossPayCop.toFixed(2),
          reteFuenteAmount: liq.reteFuenteCop.toFixed(2),
          otherDeductionsAmount: liq.workerDeductionsCop.toFixed(2),
          netSettlementAmount: liq.netPayableCop.toFixed(2),
          taxNotes: applySocialSecurity || transportAllowanceCop > 0
            ? `${transportAllowanceCop > 0 ? `Auxilio de transporte: $${transportAllowanceCop.toLocaleString("es-CO")} · ` : ""}${applySocialSecurity ? `Aportes empleador: $${liq.employerBurdenCop.toLocaleString("es-CO")} · Deducciones trabajador: $${liq.workerDeductionsCop.toLocaleString("es-CO")}` : ""}`
            : null,
          quantity: unitsWorked.toFixed(2),
          unitPrice: unitRateCop.toFixed(2),
          unit: staff.payPeriod,
          sourceType: "payroll",
          species: effectiveSpecies,
          locationId: effectiveLocationId,
          isCredit,
          notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        })
        .returning();

      linkedTransactionId = createdTx.id;

      if (isCredit && liq.netPayableCop > 0) {
        await tx.insert(accountsPayable).values({
          transactionId: createdTx.id,
          supplier: staff.fullName,
          totalAmount: liq.netPayableCop.toFixed(2),
          paidAmount: "0",
          pendingAmount: liq.netPayableCop.toFixed(2),
          dueDate: body.dueDate || null,
          status: "pendiente",
        });
      }

      if (prorationBasis && prorationBasis !== "manual") {
        const buckets = await computeSuggestedProrationWeights(
          prorationBasis,
          isDateOnly(body.periodFrom) ? body.periodFrom : undefined,
          isDateOnly(body.periodTo) ? body.periodTo : undefined,
        );
        if (buckets.length > 0) {
          const allocations = distributeAmountByWeights(liq.totalEmployerCostCop, buckets);
          const [alloc] = await tx
            .insert(costAllocations)
            .values({
              date: body.date,
              title: `Prorrateo nómina: ${staff.fullName}`,
              sourceTransactionId: createdTx.id,
              expenseCategory: "Mano de obra",
              totalAmount: liq.totalEmployerCostCop.toFixed(2),
              basis: prorationBasis,
              allocations,
              periodFrom: isDateOnly(body.periodFrom) ? body.periodFrom : null,
              periodTo: isDateOnly(body.periodTo) ? body.periodTo : null,
              notes: "Generado automáticamente desde liquidación de personal",
            })
            .returning();
          linkedAllocationId = alloc.id;
        }
      }
    }

    if (accountingMode === "imputed_economic" && ownerLaborAllocations.length > 0) {
      const [allocation] = await tx
        .insert(costAllocations)
        .values({
          date: body.date,
          title: `Prorrateo de trabajo propio: ${staff.fullName}`,
          sourceTransactionId: null,
          expenseCategory: "Mano de obra propia",
          totalAmount: liq.totalEmployerCostCop.toFixed(2),
          basis: "manual",
          allocations: ownerLaborAllocations,
          periodFrom: isDateOnly(body.periodFrom) ? body.periodFrom : null,
          periodTo: isDateOnly(body.periodTo) ? body.periodTo : null,
          notes: "Distribución calculada a partir de las horas estimadas por especie y confirmada por el productor.",
        })
        .returning();
      linkedAllocationId = allocation.id;
    }

    const [entry] = await tx
      .insert(payrollEntries)
      .values({
        staffId: staff.id,
        date: body.date,
        periodFrom: isDateOnly(body.periodFrom) ? body.periodFrom : null,
        periodTo: isDateOnly(body.periodTo) ? body.periodTo : null,
        unitsWorked: unitsWorked.toFixed(2),
        unitRateCop: unitRateCop.toFixed(2),
        grossPayCop: liq.grossPayCop.toFixed(2),
        bonusesCop: liq.bonusesCop.toFixed(2),
        transportAllowanceCop: liq.transportAllowanceCop.toFixed(2),
        employerBurdenCop: liq.employerBurdenCop.toFixed(2),
        employerBurdenPct: employerBurdenPct.toFixed(2),
        workerDeductionsCop: liq.workerDeductionsCop.toFixed(2),
        workerDeductionPct: workerDeductionPct.toFixed(2),
        reteFuenteCop: liq.reteFuenteCop.toFixed(2),
        reteFuenteRatePct: reteFuenteRatePct.toFixed(2),
        netPayableCop: liq.netPayableCop.toFixed(2),
        totalEmployerCostCop: liq.totalEmployerCostCop.toFixed(2),
        accountingMode,
        paymentStatus:
          accountingMode === "imputed_economic" ? "calculado" : isCredit ? "pendiente" : "pagado",
        dueDate: body.dueDate || null,
        species: effectiveSpecies,
        locationId: effectiveLocationId,
        prorationBasis,
        linkedTransactionId,
        linkedAllocationId,
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
      })
      .returning();

    return entry;
  });

  return NextResponse.json(created, { status: 201 });
});

export const PATCH = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object" || !body.id) {
    return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  }

  const updated = await db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.id, String(body.id)))
      .for("update");
    if (!entry) throw new Error("Registro de nómina no encontrado");

    if (entry.accountingMode !== "imputed_economic") {
      throw new Error("Solo los registros calculados de trabajo propio pueden convertirse a pago real de caja");
    }

    const [staff] = await tx.select().from(staffProfiles).where(eq(staffProfiles.id, entry.staffId));
    const txDate = isDateOnly(body.date) ? body.date : entry.date;
    const isCredit = Boolean(body.isCredit);
    const totalCost = Number(entry.totalEmployerCostCop);
    const netPay = Number(entry.netPayableCop);

    const [createdTx] = await tx
      .insert(transactions)
      .values({
        date: txDate,
        type: "egreso",
        category: "Mano de obra",
        description: `Retiro / pago trabajo propio: ${staff?.fullName || "Productor"} (${entry.unitsWorked} ${staff?.payPeriod || "und"})`,
        counterparty: staff?.fullName || null,
        amount: totalCost.toFixed(2),
        subtotalAmount: entry.grossPayCop,
        reteFuenteAmount: entry.reteFuenteCop,
        otherDeductionsAmount: entry.workerDeductionsCop,
        netSettlementAmount: entry.netPayableCop,
        quantity: entry.unitsWorked,
        unitPrice: entry.unitRateCop,
        unit: staff?.payPeriod || "dia",
        sourceType: "payroll",
        species: entry.species,
        locationId: entry.locationId,
        isCredit,
        notes: entry.notes,
      })
      .returning();

    if (isCredit && netPay > 0) {
      await tx.insert(accountsPayable).values({
        transactionId: createdTx.id,
        supplier: staff?.fullName || "Productor",
        totalAmount: netPay.toFixed(2),
        paidAmount: "0",
        pendingAmount: netPay.toFixed(2),
        dueDate: isDateOnly(body.dueDate) ? body.dueDate : null,
        status: "pendiente",
      });
    }

    if (entry.linkedAllocationId) {
      await tx
        .update(costAllocations)
        .set({ sourceTransactionId: createdTx.id, date: txDate })
        .where(eq(costAllocations.id, entry.linkedAllocationId));
    }

    const [nextEntry] = await tx
      .update(payrollEntries)
      .set({
        accountingMode: "cash_expense",
        paymentStatus: isCredit ? "pendiente" : "pagado",
        linkedTransactionId: createdTx.id,
        dueDate: isDateOnly(body.dueDate) ? body.dueDate : entry.dueDate,
      })
      .where(eq(payrollEntries.id, entry.id))
      .returning();

    return nextEntry;
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("finance:write");
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

  await db.transaction(async (tx) => {
    const [entry] = await tx
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.id, id))
      .for("update");
    if (!entry) throw new Error("Registro de nómina no encontrado");

    if (entry.linkedAllocationId) {
      await tx.delete(costAllocations).where(eq(costAllocations.id, entry.linkedAllocationId));
    }
    if (entry.linkedTransactionId) {
      await deleteTransactionsAndUnpaidAccounts(tx, eq(transactions.id, entry.linkedTransactionId));
    }
    await tx.delete(payrollEntries).where(eq(payrollEntries.id, entry.id));
  });

  return NextResponse.json({ deleted: true });
});

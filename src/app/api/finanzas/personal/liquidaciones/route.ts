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
import { computePayrollLiquidation } from "@/lib/analytics/payroll-tax-supplies";
import {
  computeSuggestedProrationWeights,
  distributeAmountByWeights,
  VALID_PRORATION_BASES,
} from "@/lib/analytics/proration";
import { deleteTransactionsAndUnpaidAccounts } from "@/lib/financial-records";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
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

  const unitRateCop = body.unitRateCop !== undefined && body.unitRateCop !== ""
    ? Number(body.unitRateCop)
    : Number(staff.baseRateCop);
  if (!Number.isFinite(unitRateCop) || unitRateCop < 0) {
    return NextResponse.json({ error: "Tarifa inválida" }, { status: 400 });
  }

  const applySocialSecurity =
    body.applySocialSecurity !== undefined ? Boolean(body.applySocialSecurity) : staff.applySocialSecurity;
  const employerBurdenPct =
    body.employerBurdenPct !== undefined ? Number(body.employerBurdenPct) : Number(staff.employerBurdenPct);
  const workerDeductionPct =
    body.workerDeductionPct !== undefined ? Number(body.workerDeductionPct) : Number(staff.workerDeductionPct);

  const liq = computePayrollLiquidation({
    unitsWorked,
    unitRateCop,
    bonusesCop,
    applySocialSecurity,
    employerBurdenPct,
    workerDeductionPct,
    reteFuenteRatePct: body.reteFuenteRatePct !== undefined ? Number(body.reteFuenteRatePct) : 0,
    reteFuenteFixedCop: body.reteFuenteCop !== undefined && body.reteFuenteCop !== "" ? Number(body.reteFuenteCop) : null,
  });

  if (liq.totalEmployerCostCop <= 0) {
    return NextResponse.json({ error: "El total de la liquidación debe ser mayor a 0" }, { status: 400 });
  }

  const effectiveSpecies = species ?? staff.defaultSpecies ?? null;
  const effectiveLocationId = locationId ?? staff.defaultLocationId ?? null;

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
          taxNotes: applySocialSecurity
            ? `Aportes empleador: $${liq.employerBurdenCop.toLocaleString("es-CO")} · Deducciones trabajador: $${liq.workerDeductionsCop.toLocaleString("es-CO")}`
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
        employerBurdenCop: liq.employerBurdenCop.toFixed(2),
        workerDeductionsCop: liq.workerDeductionsCop.toFixed(2),
        reteFuenteCop: liq.reteFuenteCop.toFixed(2),
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

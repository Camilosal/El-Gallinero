import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { billingPayments, farmSubscriptionEvents, farms } from "@/db/schema";
import { withApiHandler } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { forbiddenResponse } from "@/lib/rbac";
import { buildBillingReconciliationFindings } from "@/lib/billing-reconciliation";
import { canManagePlatformTenants } from "@/lib/superadmin-tenants";

export const dynamic = "force-dynamic";

const SCAN_LIMIT = 5_000;
const PAYMENT_EVENT_TYPES = [
  "subscription_activated",
  "subscription_renewed",
  "subscription_reactivated",
] as const;
const PAYMENT_EVENT_SOURCES = ["reservas_delivery", "wompi_webhook"] as const;

export const GET = withApiHandler(async () => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!canManagePlatformTenants(user)) {
    return forbiddenResponse("Acceso exclusivo para Super-Administración de la plataforma Iwagé.");
  }

  const eventFilter = and(
    inArray(farmSubscriptionEvents.eventType, [...PAYMENT_EVENT_TYPES]),
    inArray(farmSubscriptionEvents.source, [...PAYMENT_EVENT_SOURCES]),
  );
  const [paymentCountRows, eventCountRows, paymentRows, eventRows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` })
      .from(billingPayments)
      .where(eq(billingPayments.provider, "wompi")),
    db.select({ count: sql<number>`count(*)::int` })
      .from(farmSubscriptionEvents)
      .where(eventFilter),
    db.select({
      id: billingPayments.id,
      farmId: billingPayments.farmId,
      farmName: farms.name,
      provider: billingPayments.provider,
      externalReference: billingPayments.externalReference,
      providerTxId: billingPayments.providerTxId,
      amountCop: billingPayments.amountCop,
      planCode: billingPayments.planCode,
      status: billingPayments.status,
      createdAt: billingPayments.createdAt,
    })
      .from(billingPayments)
      .innerJoin(farms, eq(billingPayments.farmId, farms.id))
      .where(eq(billingPayments.provider, "wompi"))
      .orderBy(desc(billingPayments.createdAt), desc(billingPayments.id))
      .limit(SCAN_LIMIT + 1),
    db.select({
      id: farmSubscriptionEvents.id,
      farmId: farmSubscriptionEvents.farmId,
      farmName: farms.name,
      paymentId: farmSubscriptionEvents.paymentId,
      externalReference: farmSubscriptionEvents.externalReference,
      eventType: farmSubscriptionEvents.eventType,
      source: farmSubscriptionEvents.source,
      resultStatus: farmSubscriptionEvents.resultStatus,
      occurredAt: farmSubscriptionEvents.occurredAt,
    })
      .from(farmSubscriptionEvents)
      .leftJoin(farms, eq(farmSubscriptionEvents.farmId, farms.id))
      .where(eventFilter)
      .orderBy(desc(farmSubscriptionEvents.occurredAt), desc(farmSubscriptionEvents.id))
      .limit(SCAN_LIMIT + 1),
  ]);

  const totalPayments = Number(paymentCountRows[0]?.count ?? 0);
  const totalEvents = Number(eventCountRows[0]?.count ?? 0);
  const payments = paymentRows.slice(0, SCAN_LIMIT).map((payment) => ({
    ...payment,
    amountCop: Number(payment.amountCop),
    createdAt: payment.createdAt.toISOString(),
  }));
  const events = eventRows.slice(0, SCAN_LIMIT).map((event) => ({
    ...event,
    farmName: event.farmName ?? "Granja no encontrada",
    occurredAt: event.occurredAt.toISOString(),
  }));
  const completeScan = totalPayments <= SCAN_LIMIT && totalEvents <= SCAN_LIMIT;
  const findings = buildBillingReconciliationFindings(payments, events, { completeScan });

  return NextResponse.json({
    scope: "iwagranja_local",
    generatedAt: new Date().toISOString(),
    completeScan,
    sources: {
      payments: { scanned: payments.length, total: totalPayments },
      subscriptionEvents: { scanned: events.length, total: totalEvents },
      comparedSystems: ["IwaGranja"],
    },
    limitations: [
      "Este reporte compara el registro local de IwaGranja con su bitácora de suscripción.",
      "No consulta Reservas ni Wompi; la conciliación entre esos sistemas sigue pendiente.",
      ...(completeScan ? [] : ["El volumen supera el límite de lectura y no se concluyen huérfanos del conjunto incompleto."]),
    ],
    summary: findings.reduce<Record<string, number>>((counts, finding) => {
      counts[finding.code] = (counts[finding.code] ?? 0) + 1;
      return counts;
    }, {}),
    findings,
  }, { headers: { "Cache-Control": "no-store, max-age=0" } });
});

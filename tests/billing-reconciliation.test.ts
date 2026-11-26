import { describe, expect, it } from "vitest";
import {
  buildBillingReconciliationFindings,
  type ReconciliationPayment,
  type ReconciliationSubscriptionEvent,
} from "@/lib/billing-reconciliation";

const payment = (overrides: Partial<ReconciliationPayment> = {}): ReconciliationPayment => ({
  id: "payment-1",
  farmId: "farm-1",
  farmName: "Granja de prueba",
  provider: "wompi",
  externalReference: "IWG-intent-1",
  providerTxId: "wompi-tx-1",
  amountCop: 19_900,
  planCode: "PRODUCTOR",
  status: "approved",
  createdAt: "2026-11-20T10:00:00.000Z",
  ...overrides,
});

const event = (overrides: Partial<ReconciliationSubscriptionEvent> = {}): ReconciliationSubscriptionEvent => ({
  id: "event-1",
  farmId: "farm-1",
  farmName: "Granja de prueba",
  paymentId: "payment-1",
  externalReference: "IWG-intent-1",
  eventType: "subscription_activated",
  source: "reservas_delivery",
  resultStatus: "applied",
  occurredAt: "2026-11-20T10:01:00.000Z",
  ...overrides,
});

describe("reporte de conciliación local de pagos", () => {
  it("no detecta una inconsistencia cuando pago aprobado y activación coinciden", () => {
    expect(buildBillingReconciliationFindings([payment()], [event()], { completeScan: true })).toEqual([]);
  });

  it("identifica un pago aprobado sin evento de ciclo", () => {
    const findings = buildBillingReconciliationFindings([payment()], [], { completeScan: true });
    expect(findings.map((finding) => finding.code)).toEqual(["approved_without_lifecycle_event"]);
  });

  it("usa la referencia como vínculo secundario y detecta una referencia discrepante", () => {
    const linkedByReference = event({ paymentId: null });
    expect(buildBillingReconciliationFindings([payment()], [linkedByReference], { completeScan: true })).toEqual([]);

    const mismatch = event({ externalReference: "IWG-different" });
    expect(buildBillingReconciliationFindings([payment()], [mismatch], { completeScan: true })
      .map((finding) => finding.code)).toContain("lifecycle_event_reference_mismatch");
  });

  it("detecta más de un evento aplicado para el mismo pago", () => {
    const secondEvent = event({ id: "event-2", eventType: "subscription_renewed" });
    expect(buildBillingReconciliationFindings([payment()], [event(), secondEvent], { completeScan: true })
      .map((finding) => finding.code)).toContain("duplicate_lifecycle_events");
  });

  it("identifica un evento sin pago y uno asociado a un pago no aprobado", () => {
    const missingPaymentEvent = event({ paymentId: "missing", externalReference: "IWG-missing" });
    const pendingPayment = payment({ status: "pending" });
    const findings = buildBillingReconciliationFindings(
      [pendingPayment],
      [missingPaymentEvent, event()],
      { completeScan: true },
    );
    expect(findings.map((finding) => finding.code).sort()).toEqual([
      "lifecycle_event_payment_not_approved",
      "lifecycle_event_without_payment",
    ]);
  });

  it("detecta eventos ligados a otra granja o a otra referencia", () => {
    const wrongFarm = event({ farmId: "farm-2" });
    const wrongReference = event({ externalReference: "IWG-other" });
    expect(buildBillingReconciliationFindings([payment()], [wrongFarm, wrongReference], { completeScan: true })
      .map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "lifecycle_event_farm_mismatch",
      "lifecycle_event_reference_mismatch",
    ]));
  });

  it("detecta resultados en revisión, aprobación sin ID y transacciones duplicadas", () => {
    const findings = buildBillingReconciliationFindings([
      payment({ id: "review-payment", status: "review" }),
      payment({ id: "no-tx-payment", providerTxId: null }),
      payment({ id: "duplicate-payment" }),
    ], [event({ paymentId: "duplicate-payment" })], { completeScan: true });
    expect(findings.map((finding) => finding.code)).toEqual(expect.arrayContaining([
      "payment_requires_review",
      "approved_without_transaction_id",
      "duplicate_wompi_transaction_id",
    ]));
  });

  it("muestra en revisión los eventos firmados que no cambiaron el estado del pago", () => {
    const reviewEvent = event({
      id: "review-event",
      eventType: "payment_review_required",
      resultStatus: "review_required",
      occurredAt: "2026-11-20T10:02:00.000Z",
    });
    const findings = buildBillingReconciliationFindings([payment()], [event(), reviewEvent], { completeScan: true });
    expect(findings).toMatchObject([{
      code: "payment_requires_review",
      severity: "review",
      paymentId: "payment-1",
      eventId: "review-event",
      paymentStatus: "approved",
      eventType: "payment_review_required",
    }]);
  });

  it("conserva las revisiones conocidas aunque el escaneo general esté truncado", () => {
    const reviewEvent = event({
      id: "review-event",
      eventType: "payment_review_required",
      resultStatus: "review_required",
      occurredAt: "2026-11-20T10:02:00.000Z",
    });
    const findings = buildBillingReconciliationFindings(
      [payment({ status: "pending" })],
      [reviewEvent],
      { completeScan: false },
    );
    expect(findings).toMatchObject([{
      code: "payment_requires_review",
      severity: "review",
      paymentStatus: "pending",
      eventType: "payment_review_required",
    }]);
  });

  it("muestra el ID Wompi del evento aunque aún no se haya vinculado al pago", () => {
    const reviewEvent = event({
      id: "review-event-unlinked",
      paymentId: null,
      externalReference: "IWG-not-linked",
      providerTxId: "wompi-tx-unlinked",
      eventType: "payment_review_required",
      resultStatus: "review_required",
    });
    const findings = buildBillingReconciliationFindings([], [reviewEvent], { completeScan: true });

    expect(findings).toMatchObject([{
      code: "payment_requires_review",
      paymentId: null,
      externalReference: "IWG-not-linked",
      providerTxId: "wompi-tx-unlinked",
    }]);
  });

  it("no concluye relaciones huérfanas cuando la lectura está truncada", () => {
    const findings = buildBillingReconciliationFindings([payment()], [], { completeScan: false });
    expect(findings).toEqual([]);
  });

  it("omite pagos manuales al revisar IDs de transacción Wompi", () => {
    const manual = payment({ provider: "manual_superadmin", status: "review", providerTxId: null });
    expect(buildBillingReconciliationFindings([manual], [], { completeScan: true })).toEqual([]);
  });
});

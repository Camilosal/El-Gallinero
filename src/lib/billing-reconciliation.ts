export interface ReconciliationPayment {
  id: string;
  farmId: string;
  farmName: string;
  provider: string;
  externalReference: string;
  providerTxId: string | null;
  amountCop: number;
  planCode: string;
  status: string;
  createdAt: string;
}

export interface ReconciliationSubscriptionEvent {
  id: string;
  farmId: string;
  farmName: string;
  paymentId: string | null;
  externalReference: string | null;
  eventType: string;
  source: string;
  resultStatus: string;
  occurredAt: string;
  providerTxId?: string | null;
}

export type ReconciliationFindingCode =
  | "payment_requires_review"
  | "approved_without_transaction_id"
  | "duplicate_wompi_transaction_id"
  | "approved_without_lifecycle_event"
  | "duplicate_lifecycle_events"
  | "lifecycle_event_without_payment"
  | "lifecycle_event_payment_not_approved"
  | "lifecycle_event_farm_mismatch"
  | "lifecycle_event_reference_mismatch";

export interface ReconciliationFinding {
  code: ReconciliationFindingCode;
  severity: "attention" | "review";
  summary: string;
  farmId: string;
  farmName: string;
  paymentId: string | null;
  eventId: string | null;
  externalReference: string | null;
  providerTxId: string | null;
  amountCop: number | null;
  planCode: string | null;
  paymentStatus: string | null;
  eventType: string | null;
  observedAt: string;
}

const APPLIED_PAYMENT_EVENT_TYPES = new Set([
  "subscription_activated",
  "subscription_renewed",
  "subscription_reactivated",
]);
const PAYMENT_EVENT_SOURCES = new Set(["reservas_delivery", "wompi_webhook"]);

function paymentFinding(
  code: ReconciliationFindingCode,
  summary: string,
  payment: ReconciliationPayment,
  event?: ReconciliationSubscriptionEvent,
): ReconciliationFinding {
  return {
    code,
    severity: code === "payment_requires_review" ? "review" : "attention",
    summary,
    farmId: payment.farmId,
    farmName: payment.farmName,
    paymentId: payment.id,
    eventId: event?.id ?? null,
    externalReference: payment.externalReference,
    providerTxId: payment.providerTxId,
    amountCop: payment.amountCop,
    planCode: payment.planCode,
    paymentStatus: payment.status,
    eventType: event?.eventType ?? null,
    observedAt: event?.occurredAt ?? payment.createdAt,
  };
}

function eventFinding(
  code: ReconciliationFindingCode,
  summary: string,
  event: ReconciliationSubscriptionEvent,
  payment?: ReconciliationPayment,
): ReconciliationFinding {
  return {
    code,
    severity: code === "payment_requires_review" ? "review" : "attention",
    summary,
    farmId: event.farmId,
    farmName: event.farmName,
    paymentId: payment?.id ?? event.paymentId,
    eventId: event.id,
    externalReference: event.externalReference ?? payment?.externalReference ?? null,
    providerTxId: payment?.providerTxId ?? event.providerTxId ?? null,
    amountCop: payment?.amountCop ?? null,
    planCode: payment?.planCode ?? null,
    paymentStatus: payment?.status ?? null,
    eventType: event.eventType,
    observedAt: event.occurredAt,
  };
}

/**
 * Compares IwaGranja's local Wompi payment records with its append-only
 * subscription events. It deliberately does not claim to reconcile Reservas
 * or Wompi; that requires a read-only source endpoint and credentials there.
 */
export function buildBillingReconciliationFindings(
  payments: ReconciliationPayment[],
  events: ReconciliationSubscriptionEvent[],
  options: { completeScan: boolean },
): ReconciliationFinding[] {
  const findings: ReconciliationFinding[] = [];
  const wompiPayments = payments.filter((payment) => payment.provider === "wompi");
  const byId = new Map(wompiPayments.map((payment) => [payment.id, payment]));
  const byReference = new Map(wompiPayments.map((payment) => [payment.externalReference, payment]));
  const reviewEvents = events.filter((event) =>
    event.eventType === "payment_review_required" &&
    event.resultStatus === "review_required" &&
    PAYMENT_EVENT_SOURCES.has(event.source)
  );

  for (const payment of wompiPayments) {
    if (payment.status === "review") {
      const reviewEvent = reviewEvents.find((event) =>
        event.paymentId === payment.id ||
        (!event.paymentId && event.externalReference === payment.externalReference)
      );
      findings.push(paymentFinding(
        "payment_requires_review",
        "El resultado del pago requiere revisión manual.",
        payment,
        reviewEvent,
      ));
    }
    if (payment.status === "approved" && !payment.providerTxId) {
      findings.push(paymentFinding(
        "approved_without_transaction_id",
        "El pago figura aprobado, pero no tiene un ID de transacción Wompi asociado.",
        payment,
      ));
    }
  }

  for (const reviewEvent of reviewEvents) {
    const payment = reviewEvent.paymentId
      ? byId.get(reviewEvent.paymentId)
      : reviewEvent.externalReference
        ? byReference.get(reviewEvent.externalReference)
        : undefined;
    if (payment?.status === "review") continue;
    findings.push(eventFinding(
      "payment_requires_review",
      "Un resultado firmado del procesador requiere revisión; el plan no se modifica por este evento.",
      reviewEvent,
      payment,
    ));
  }

  if (!options.completeScan) {
    return findings.sort((left, right) => right.observedAt.localeCompare(left.observedAt));
  }

  const appliedEvents = events.filter((event) =>
    APPLIED_PAYMENT_EVENT_TYPES.has(event.eventType) &&
    PAYMENT_EVENT_SOURCES.has(event.source) &&
    event.resultStatus === "applied"
  );

  const transactionGroups = new Map<string, ReconciliationPayment[]>();
  for (const payment of wompiPayments) {
    if (!payment.providerTxId) continue;
    const group = transactionGroups.get(payment.providerTxId) ?? [];
    group.push(payment);
    transactionGroups.set(payment.providerTxId, group);
  }
  for (const [providerTxId, group] of transactionGroups) {
    if (group.length < 2) continue;
    for (const payment of group) {
      findings.push(paymentFinding(
        "duplicate_wompi_transaction_id",
        `El ID de transacción Wompi ${providerTxId} aparece asociado a más de un pago.`,
        payment,
      ));
    }
  }

  for (const payment of wompiPayments) {
    if (payment.status !== "approved") continue;
    const linkedEvents = appliedEvents.filter((event) =>
      event.paymentId === payment.id ||
      (!event.paymentId && event.externalReference === payment.externalReference)
    );
    if (linkedEvents.length === 0) {
      findings.push(paymentFinding(
        "approved_without_lifecycle_event",
        "El pago aprobado no tiene un evento de activación o renovación asociado.",
        payment,
      ));
    } else if (linkedEvents.length > 1) {
      findings.push(paymentFinding(
        "duplicate_lifecycle_events",
        "El pago aprobado tiene más de un evento de activación o renovación.",
        payment,
        linkedEvents[1],
      ));
    }
  }

  for (const event of appliedEvents) {
    const payment = event.paymentId
      ? byId.get(event.paymentId)
      : event.externalReference
        ? byReference.get(event.externalReference)
        : undefined;

    if (!payment) {
      findings.push(eventFinding(
        "lifecycle_event_without_payment",
        "El evento de activación o renovación no apunta a un pago Wompi registrado.",
        event,
      ));
      continue;
    }
    if (payment.status !== "approved") {
      findings.push(eventFinding(
        "lifecycle_event_payment_not_approved",
        "El evento de activación está asociado a un pago que no figura aprobado.",
        event,
        payment,
      ));
      continue;
    }
    if (event.farmId !== payment.farmId) {
      findings.push(eventFinding(
        "lifecycle_event_farm_mismatch",
        "El evento de suscripción y el pago pertenecen a granjas distintas.",
        event,
        payment,
      ));
    }
    if (event.externalReference && event.externalReference !== payment.externalReference) {
      findings.push(eventFinding(
        "lifecycle_event_reference_mismatch",
        "La referencia del evento no coincide con la referencia del pago asociado.",
        event,
        payment,
      ));
    }
  }

  return findings.sort((left, right) => right.observedAt.localeCompare(left.observedAt));
}

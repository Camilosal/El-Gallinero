import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { billingPayments, farmSubscriptionEvents } from "@/db/schema";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_PAGE_SIZE = 100;
const MAX_QUERY_LENGTH = 120;
const MAX_CLOCK_SKEW_SECONDS = 300;
const PAYMENT_EVENT_TYPES = [
  "subscription_activated",
  "subscription_renewed",
  "subscription_reactivated",
  "payment_review_required",
] as const;
const PAYMENT_EVENT_SOURCES = ["reservas_delivery", "wompi_webhook"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z)?$/;

type CursorInput = { timestamp: string; id: string } | null;

function canonicalTarget(url: URL): string {
  const params = new URLSearchParams(url.searchParams);
  params.sort();
  const query = params.toString();
  return `${url.pathname}${query ? `?${query}` : ""}`;
}

function verifyRequestSignature(request: NextRequest, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const timestamp = request.headers.get("x-reservas-reconciliation-timestamp") || "";
  const signature = request.headers.get("x-reservas-reconciliation-signature") || "";
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/i.test(signature)) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(nowSeconds - timestampSeconds) > MAX_CLOCK_SKEW_SECONDS) {
    return false;
  }

  const message = `${timestamp}.GET.${canonicalTarget(request.nextUrl)}`;
  const expected = createHmac("sha256", secret).update(message).digest();
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parsePageSize(value: string | null): number | null {
  if (value === null) return 50;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_PAGE_SIZE ? parsed : null;
}

function parseCursor(params: URLSearchParams, timestampKey: string, idKey: string): CursorInput | false {
  const timestamp = params.get(timestampKey);
  const id = params.get(idKey);
  if (!timestamp && !id) return null;
  if (!timestamp || !id || !TIMESTAMP_PATTERN.test(timestamp) || !UUID_PATTERN.test(id)) return false;
  if (!Number.isFinite(Date.parse(`${timestamp.replace(" ", "T").replace(/Z$/, "")}Z`))) return false;
  return { timestamp, id };
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

function normalizeEnvironment(value: string | null | undefined): "test" | "prod" | null {
  if (value === "test" || value === "sandbox") return "test";
  if (value === "prod" || value === "production") return "prod";
  return null;
}

function unauthorized() {
  return NextResponse.json({ error: "No autorizado" }, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const secret = process.env.RESERVAS_RECONCILIATION_HMAC_SECRET?.trim() || "";
  if (Buffer.byteLength(secret, "utf8") < 32) {
    return NextResponse.json({ error: "La conciliación de pagos entre servicios no está configurada." }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!verifyRequestSignature(request, secret)) return unauthorized();

  const params = request.nextUrl.searchParams;
  const allowedParams = new Set([
    "pageSize",
    "environment",
    "q",
    "paymentsAfterCreatedAt",
    "paymentsAfterId",
    "eventsAfterOccurredAt",
    "eventsAfterId",
  ]);
  const seenParams = new Set<string>();
  for (const key of params.keys()) {
    if (!allowedParams.has(key) || seenParams.has(key)) {
      return NextResponse.json({ error: "Los filtros de conciliación no son válidos." }, {
        status: 400,
        headers: { "Cache-Control": "no-store" },
      });
    }
    seenParams.add(key);
  }
  const pageSize = parsePageSize(params.get("pageSize"));
  const environment = params.get("environment") || "";
  const queryText = params.get("q")?.trim() || "";
  const paymentCursor = parseCursor(params, "paymentsAfterCreatedAt", "paymentsAfterId");
  const eventCursor = parseCursor(params, "eventsAfterOccurredAt", "eventsAfterId");
  if (
    pageSize === null ||
    (environment !== "" && environment !== "test" && environment !== "prod") ||
    queryText.length > MAX_QUERY_LENGTH ||
    paymentCursor === false ||
    eventCursor === false
  ) {
    return NextResponse.json({ error: "Los filtros de conciliación no son válidos." }, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const paymentEnvironment = sql<string | null>`CASE COALESCE(
    ${billingPayments.rawPayload}->'pricingPurchase'->>'environment',
    ${billingPayments.rawPayload}->'latestWebhook'->>'environment'
  ) WHEN 'sandbox' THEN 'test' WHEN 'production' THEN 'prod' WHEN 'test' THEN 'test' WHEN 'prod' THEN 'prod' ELSE NULL END`;
  const eventEnvironment = sql<string | null>`CASE COALESCE(
    ${billingPayments.rawPayload}->'pricingPurchase'->>'environment',
    ${billingPayments.rawPayload}->'latestWebhook'->>'environment',
    ${farmSubscriptionEvents.afterSnapshot}->>'receivedEnvironment'
  ) WHEN 'sandbox' THEN 'test' WHEN 'production' THEN 'prod' WHEN 'test' THEN 'test' WHEN 'prod' THEN 'prod' ELSE NULL END`;
  const eventReference = sql<string | null>`COALESCE(${farmSubscriptionEvents.externalReference}, ${billingPayments.externalReference})`;
  const eventProviderTxId = sql<string | null>`COALESCE(${farmSubscriptionEvents.afterSnapshot}->>'providerTxId', ${billingPayments.providerTxId})`;
  const escapedQuery = queryText ? `%${escapeLikePattern(queryText)}%` : "";

  const paymentPredicates: SQL[] = [eq(billingPayments.provider, "wompi")];
  if (environment) paymentPredicates.push(eq(paymentEnvironment, environment));
  if (queryText) {
    paymentPredicates.push(or(
      ilike(billingPayments.externalReference, escapedQuery),
      ilike(billingPayments.providerTxId, escapedQuery),
    )!);
  }
  if (paymentCursor) {
    paymentPredicates.push(sql`(${billingPayments.createdAt}, ${billingPayments.id}) < (${paymentCursor.timestamp}::timestamp, ${paymentCursor.id}::uuid)`);
  }

  const eventPredicates: SQL[] = [
    inArray(farmSubscriptionEvents.eventType, [...PAYMENT_EVENT_TYPES]),
    inArray(farmSubscriptionEvents.source, [...PAYMENT_EVENT_SOURCES]),
  ];
  if (environment) eventPredicates.push(eq(eventEnvironment, environment));
  if (queryText) {
    eventPredicates.push(or(
      ilike(eventReference, escapedQuery),
      ilike(eventProviderTxId, escapedQuery),
    )!);
  }
  if (eventCursor) {
    eventPredicates.push(sql`(${farmSubscriptionEvents.occurredAt}, ${farmSubscriptionEvents.id}) < (${eventCursor.timestamp}::timestamp, ${eventCursor.id}::uuid)`);
  }

  const [paymentRows, eventRows] = await Promise.all([
    db.select({
      id: billingPayments.id,
      reference: billingPayments.externalReference,
      providerTransactionId: billingPayments.providerTxId,
      amountInCents: sql<number>`${billingPayments.amountCop} * 100`,
      currency: sql<string>`'COP'`,
      status: billingPayments.status,
      environment: paymentEnvironment,
      createdAt: sql<string>`${billingPayments.createdAt}::text`,
      paidAt: billingPayments.paidAt,
    })
      .from(billingPayments)
      .where(and(...paymentPredicates))
      .orderBy(desc(billingPayments.createdAt), desc(billingPayments.id))
      .limit(pageSize + 1),
    db.select({
      id: farmSubscriptionEvents.id,
      reference: eventReference,
      providerTransactionId: eventProviderTxId,
      environment: eventEnvironment,
      eventType: farmSubscriptionEvents.eventType,
      source: farmSubscriptionEvents.source,
      resultStatus: farmSubscriptionEvents.resultStatus,
      occurredAt: sql<string>`${farmSubscriptionEvents.occurredAt}::text`,
      paymentStatus: billingPayments.status,
      amountInCents: sql<number | null>`${billingPayments.amountCop} * 100`,
    })
      .from(farmSubscriptionEvents)
      .leftJoin(billingPayments, eq(farmSubscriptionEvents.paymentId, billingPayments.id))
      .where(and(...eventPredicates))
      .orderBy(desc(farmSubscriptionEvents.occurredAt), desc(farmSubscriptionEvents.id))
      .limit(pageSize + 1),
  ]);

  const hasMorePayments = paymentRows.length > pageSize;
  const hasMoreEvents = eventRows.length > pageSize;
  const payments = paymentRows.slice(0, pageSize);
  const subscriptionEvents = eventRows.slice(0, pageSize);
  const lastPayment = payments[payments.length - 1];
  const lastEvent = subscriptionEvents[subscriptionEvents.length - 1];

  return NextResponse.json({
    scope: "iwagranja/subscription",
    generatedAt: new Date().toISOString(),
    data: {
      payments: payments.map((payment) => ({
        reference: payment.reference,
        environment: normalizeEnvironment(payment.environment),
        amountInCents: Number(payment.amountInCents),
        currency: payment.currency,
        financialStatus: payment.status,
        providerTransactionId: payment.providerTransactionId,
        createdAt: payment.createdAt,
        paidAt: payment.paidAt?.toISOString() ?? null,
      })),
      subscriptionEvents: subscriptionEvents.map((event) => ({
        reference: event.reference,
        environment: normalizeEnvironment(event.environment),
        providerTransactionId: event.providerTransactionId,
        paymentStatus: event.paymentStatus,
        amountInCents: event.amountInCents === null ? null : Number(event.amountInCents),
        eventType: event.eventType,
        source: event.source,
        resultStatus: event.resultStatus,
        occurredAt: event.occurredAt,
      })),
    },
    nextCursor: {
      payments: hasMorePayments && lastPayment
        ? { afterCreatedAt: lastPayment.createdAt, afterId: lastPayment.id }
        : null,
      subscriptionEvents: hasMoreEvents && lastEvent
        ? { afterOccurredAt: lastEvent.occurredAt, afterId: lastEvent.id }
        : null,
    },
    complete: {
      payments: !hasMorePayments,
      subscriptionEvents: !hasMoreEvents,
    },
  }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

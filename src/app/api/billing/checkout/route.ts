import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { billingPayments } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { getFarmSubscriptionStatus } from "@/lib/subscription";
import { createPricingQuote, getPublicPricingOffer } from "@/lib/pricing/quote";
import { verifyProducerRenewalFarmId } from "@/lib/pricing/renewal-farm";
import { LEGAL_DOCS_VERSION } from "@/lib/legal";
import { getSessionUser } from "@/lib/auth";
import { isSafeReservationsCheckoutUrl, signReservationsServiceRequest } from "@/lib/reservas-payments";

export const dynamic = "force-dynamic";

/** Status endpoint retained for current and historical subscriptions. */
export const GET = withApiHandler(async (req: NextRequest) => {
  const reference = new URL(req.url).searchParams.get("reference")?.trim();
  if (reference) {
    if (!/^IWG-[0-9a-f-]{36}$/i.test(reference)) {
      return NextResponse.json({ error: "La referencia de pago no es válida." }, { status: 400 });
    }
    const [payment] = await db
      .select({
        externalReference: billingPayments.externalReference,
        status: billingPayments.status,
        amountCop: billingPayments.amountCop,
        paidAt: billingPayments.paidAt,
        createdAt: billingPayments.createdAt,
      })
      .from(billingPayments)
      .where(and(
        eq(billingPayments.externalReference, reference),
        eq(billingPayments.farmId, getCurrentFarmId()),
      ))
      .limit(1);
    if (!payment) return NextResponse.json({ error: "No encontramos ese pago en esta granja." }, { status: 404 });
    return NextResponse.json({ payment }, { headers: { "Cache-Control": "no-store" } });
  }
  const subscription = await getFarmSubscriptionStatus();
  return NextResponse.json({ subscription });
});

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function makeReturnUrl(appOrigin: string, reference: string, production: boolean): string | null {
  try {
    const base = new URL(appOrigin);
    if (base.username || base.password || (production && base.protocol !== "https:")) return null;
    if (!production && base.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(base.hostname)) return null;
    const destination = new URL("/configuracion/plan", base.origin);
    destination.searchParams.set("payment", "return");
    destination.searchParams.set("reference", reference);
    return destination.toString();
  } catch {
    return null;
  }
}

function isExpectedReturnUrl(value: unknown, expected: string): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const expectedUrl = new URL(expected);
    return url.origin === expectedUrl.origin &&
      url.pathname === "/configuracion/plan" &&
      url.searchParams.get("payment") === "return" &&
      url.searchParams.get("reference") === expectedUrl.searchParams.get("reference") &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

function canonicalizeQuoteValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeQuoteValue);
  if (!record(value)) return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, canonicalizeQuoteValue(value[key])]),
  );
}

function sameCommercialQuote(savedValue: unknown, currentValue: unknown): boolean {
  if (!record(savedValue) || !record(currentValue)) return false;
  const saved = { ...savedValue };
  const current = { ...currentValue };
  // The calculator creates a fresh quote ID and timestamp for each request.
  // Those fields identify the calculation, not a change to the accepted purchase.
  delete saved.quoteId;
  delete saved.generatedAt;
  delete current.quoteId;
  delete current.generatedAt;
  return JSON.stringify(canonicalizeQuoteValue(saved)) === JSON.stringify(canonicalizeQuoteValue(current));
}

/** Creates or recovers a central payment intent only after recalculating the offer in IwaGranja. */
export const POST = withApiHandler(async (req: NextRequest) => {
  const payload = await safeParseJson(req);
  if (!record(payload) || payload.segment !== "producer") {
    return NextResponse.json(
      {
        error: "El pago en línea está disponible para Productor. Organización requiere habilitar el control de beneficiarios.",
        code: "AGGREGATOR_CHECKOUT_UNAVAILABLE",
      },
      { status: 409 },
    );
  }

  const offer = getPublicPricingOffer();
  if (payload.acceptedTerms !== true || payload.acceptedPolicyVersion !== offer.policyVersion) {
    return NextResponse.json(
      { error: "Acepta los términos vigentes para continuar.", code: "TERMS_ACCEPTANCE_REQUIRED" },
      { status: 400 },
    );
  }

  const renewalRequested = payload.renewal === true;
  const renewalFarm = renewalRequested
    ? await verifyProducerRenewalFarmId(payload.farmId)
    : null;

  let quote;
  try {
    quote = createPricingQuote({
      segment: "producer",
      users: payload.users,
      months: payload.months,
      renewal: renewalRequested,
      locations: payload.locations,
      areasPerLocation: payload.areasPerLocation,
      extraPlates: 0,
      extraTrainingPackages: 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo recalcular el plan." },
      { status: 400 },
    );
  }

  // The selected tax policy must produce a server-calculated final total.
  if (
    !quote.taxes.calculated ||
    !quote.taxes.includedInTotal ||
    quote.taxes.applicable ||
    quote.taxes.amountCop !== 0
  ) {
    return NextResponse.json(
      {
        error: "El pago aún no se puede abrir: falta calcular el total final de la política tributaria vigente.",
        code: "CHECKOUT_TAX_POLICY_REQUIRED",
      },
      { status: 409 },
    );
  }

  const idempotencyKey = typeof payload.idempotencyKey === "string"
    ? payload.idempotencyKey.trim().toLowerCase()
    : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(idempotencyKey)) {
    return NextResponse.json(
      { error: "No pudimos identificar esta solicitud de pago. Vuelve a intentarlo." },
      { status: 400 },
    );
  }

  const environment = process.env.WOMPI_ENVIRONMENT?.trim().toLowerCase();
  const environmentMatchesApp = process.env.NODE_ENV === "production"
    ? environment === "production"
    : environment === "sandbox";
  const reservationsUrl = process.env.RESERVAS_PAYMENT_INTENTS_URL?.trim();
  const reservationsSecret = process.env.RESERVAS_PAYMENT_API_SECRET?.trim();
  if (!environmentMatchesApp || !reservationsUrl || !reservationsSecret) {
    return NextResponse.json(
      { error: "El pago en línea todavía no está habilitado para esta aplicación.", code: "CHECKOUT_PROVIDER_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let apiUrl: URL;
  try {
    apiUrl = new URL(reservationsUrl);
  } catch {
    return NextResponse.json(
      { error: "El servicio de pago no está disponible.", code: "CHECKOUT_PROVIDER_URL_INVALID" },
      { status: 503 },
    );
  }
  if (
    !["https:", ...(process.env.NODE_ENV === "production" ? [] : ["http:"])].includes(apiUrl.protocol) ||
    apiUrl.username || apiUrl.password ||
    (process.env.NODE_ENV === "production" && apiUrl.protocol !== "https:") ||
    (process.env.NODE_ENV !== "production" && apiUrl.protocol === "http:" && !["localhost", "127.0.0.1"].includes(apiUrl.hostname))
  ) {
    return NextResponse.json(
      { error: "El servicio de pago no está disponible.", code: "CHECKOUT_PROVIDER_URL_INVALID" },
      { status: 503 },
    );
  }

  const amountInCents = quote.totalBeforeLogisticsAndTaxCop * 100;
  if (!Number.isSafeInteger(amountInCents) || amountInCents <= 0) {
    return NextResponse.json(
      { error: "El total del plan no es válido para iniciar el pago.", code: "CHECKOUT_AMOUNT_INVALID" },
      { status: 400 },
    );
  }

  const reference = `IWG-${idempotencyKey}`;
  const currency = "COP";
  const farmId = renewalFarm?.id ?? getCurrentFarmId();
  const acceptedBy = await getSessionUser();
  if (!acceptedBy) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });

  let [existingPayment] = await db.select().from(billingPayments)
    .where(eq(billingPayments.externalReference, reference)).limit(1);
  const now = new Date();
  const production = process.env.NODE_ENV === "production";
  const returnOrigin = process.env.APP_URL?.trim() || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  const generatedReturnUrl = makeReturnUrl(returnOrigin, reference, production);
  if (!generatedReturnUrl) {
    return NextResponse.json({ error: "El regreso seguro después del pago no está configurado." }, { status: 503 });
  }
  let existingPayload = record(existingPayment?.rawPayload) ? existingPayment.rawPayload : {};
  const savedReturnUrl = existingPayload.reservasReturnUrl;
  let returnUrl = isExpectedReturnUrl(savedReturnUrl, generatedReturnUrl) ? savedReturnUrl : generatedReturnUrl;
  let expiresAt = typeof existingPayload.reservasIntentExpiresAt === "string"
    ? existingPayload.reservasIntentExpiresAt
    : new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();
  if (existingPayment?.status === "pending" && Date.parse(expiresAt) <= now.getTime()) {
    return NextResponse.json(
      { error: "Este enlace de pago venció. Confirma de nuevo tu selección para iniciar otro intento.", code: "CHECKOUT_ATTEMPT_EXPIRED" },
      { status: 409 },
    );
  }
  const savedPurchase = existingPayload.pricingPurchase;
  const acceptedAt = record(savedPurchase) && typeof savedPurchase.acceptedAt === "string"
    ? savedPurchase.acceptedAt
    : now.toISOString();

  const purchaseSnapshot = {
    schemaVersion: "iwagranja-plan-purchase-v1",
    policyVersion: quote.policyVersion,
    termsVersion: LEGAL_DOCS_VERSION,
    acceptedTerms: true,
    acceptedDocuments: ["terminos", "retracto"],
    acceptedByUserId: acceptedBy.id,
    acceptedAt,
    environment,
    renewalFarm,
    returnUrl,
    quote,
  };
  if (existingPayment) {
    const saved = existingPayload.pricingPurchase;
    if (
      existingPayment.farmId !== farmId ||
      existingPayment.amountCop !== quote.totalBeforeLogisticsAndTaxCop ||
      !saved || typeof saved !== "object" ||
      !sameCommercialQuote((saved as Record<string, unknown>).quote, quote)
    ) {
      return NextResponse.json({ error: "Esta solicitud ya se usó con otra selección. Actualiza la página e inténtalo de nuevo." }, { status: 409 });
    }
    if (existingPayment.status === "approved") {
      return NextResponse.json({ redirectUrl: returnUrl, reference, status: "approved" }, { headers: { "Cache-Control": "no-store" } });
    }
    if (existingPayment.status !== "pending") {
      return NextResponse.json(
        { error: "Este intento ya terminó. Confirma de nuevo tu selección para iniciar otro.", code: "CHECKOUT_ATTEMPT_FINISHED" },
        { status: 409 },
      );
    }
    if (!existingPayment.rawPayload || typeof existingPayment.rawPayload !== "object") {
      return NextResponse.json({ error: "No pudimos recuperar este intento. Inicia una nueva solicitud." }, { status: 409 });
    }
    const previous = (existingPayment.rawPayload as Record<string, unknown>).reservasCheckout;
    if (previous && typeof previous === "object") {
      const checkoutUrl = (previous as Record<string, unknown>).checkoutUrl;
      if (isSafeReservationsCheckoutUrl(checkoutUrl)) {
        return NextResponse.json({ redirectUrl: checkoutUrl, reference, status: "pending", recovered: true }, { headers: { "Cache-Control": "no-store" } });
      }
    }
  } else {
    const rawPayload = {
      pricingPurchase: purchaseSnapshot,
      reservasIntentExpiresAt: expiresAt,
      reservasReturnUrl: returnUrl,
    };
    const [inserted] = await db.insert(billingPayments).values({
      farmId,
      provider: "wompi",
      externalReference: reference,
      method: "checkout",
      amountCop: quote.totalBeforeLogisticsAndTaxCop,
      planCode: "PRODUCTOR",
      status: "pending",
      rawPayload,
    }).onConflictDoNothing({ target: billingPayments.externalReference }).returning();
    if (!inserted) {
      [existingPayment] = await db.select().from(billingPayments)
        .where(and(
          eq(billingPayments.externalReference, reference),
          eq(billingPayments.farmId, farmId),
        )).limit(1);
      if (!existingPayment) {
        return NextResponse.json({ error: "Ya estamos preparando este pago. Inténtalo de nuevo en unos segundos." }, { status: 503 });
      }
      const racedPayload = record(existingPayment.rawPayload) ? existingPayment.rawPayload : {};
      const racedPurchase = racedPayload.pricingPurchase;
      if (
        existingPayment.amountCop !== quote.totalBeforeLogisticsAndTaxCop ||
        !record(racedPurchase) || !sameCommercialQuote(racedPurchase.quote, quote)
      ) {
        return NextResponse.json({ error: "Esta solicitud ya se usó con otra selección. Actualiza la página e inténtalo de nuevo." }, { status: 409 });
      }
      existingPayload = racedPayload;
      if (isExpectedReturnUrl(racedPayload.reservasReturnUrl, generatedReturnUrl)) {
        returnUrl = racedPayload.reservasReturnUrl;
      }
      if (typeof racedPayload.reservasIntentExpiresAt === "string") {
        expiresAt = racedPayload.reservasIntentExpiresAt;
      }
    }
  }

  const apiPayload = {
    sourceApp: "iwagranja",
    purpose: "subscription",
    idempotencyKey,
    reference,
    amountInCents,
    currency,
    description: `Suscripción IwaGranja Productor · ${quote.users} usuarios · ${quote.periodMonths} meses`,
    expiresAt,
    returnUrl,
    customer: { fullName: acceptedBy.name },
  };
  const rawBody = JSON.stringify(apiPayload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  let centralResponse: Response;
  try {
    centralResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-iwagranja-timestamp": timestamp,
        "x-iwagranja-signature": signReservationsServiceRequest(rawBody, timestamp, reservationsSecret),
      },
      body: rawBody,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return NextResponse.json({ error: "No pudimos conectar con el servicio de pago. Vuelve a intentarlo." }, { status: 503 });
  }
  const centralResult = await centralResponse.json().catch(() => null) as Record<string, unknown> | null;
  if (!centralResponse.ok || !centralResult || centralResult.reference !== reference) {
    return NextResponse.json(
      { error: centralResponse.status === 409 ? "Este intento necesita revisión. Actualiza la página antes de volver a intentar." : "No pudimos preparar el pago. Vuelve a intentarlo." },
      { status: centralResponse.status === 409 ? 409 : 503 },
    );
  }

  const centralCheckoutUrl = centralResult.checkoutUrl;
  const alreadyApproved = centralResult.status === "approved" || centralResult.alreadyPaid === true;
  if (!alreadyApproved && !isSafeReservationsCheckoutUrl(centralCheckoutUrl)) {
    return NextResponse.json({ error: "El servicio de pago no devolvió un enlace seguro." }, { status: 502 });
  }

  const [latestPayment] = await db.select().from(billingPayments)
    .where(and(
      eq(billingPayments.externalReference, reference),
      eq(billingPayments.farmId, farmId),
      eq(billingPayments.status, "pending"),
    )).limit(1);
  if (latestPayment) {
    const previousPayload = latestPayment.rawPayload && typeof latestPayment.rawPayload === "object"
      ? latestPayment.rawPayload as Record<string, unknown>
      : {};
    await db.update(billingPayments).set({
      rawPayload: {
        ...previousPayload,
        reservasCheckout: {
          intentId: typeof centralResult.intentId === "string" ? centralResult.intentId : null,
          status: alreadyApproved ? "approved" : "pending",
          checkoutUrl: alreadyApproved ? null : centralCheckoutUrl,
          savedAt: new Date().toISOString(),
        },
      },
    }).where(eq(billingPayments.id, latestPayment.id));
  }

  return NextResponse.json(
    { redirectUrl: alreadyApproved ? returnUrl : centralCheckoutUrl, reference, status: alreadyApproved ? "approved" : "pending" },
    { headers: { "Cache-Control": "no-store" } },
  );
});

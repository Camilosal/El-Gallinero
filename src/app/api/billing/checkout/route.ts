import { createHash, randomUUID } from "node:crypto";
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

export const dynamic = "force-dynamic";

/** Status endpoint retained for current and historical subscriptions. */
export const GET = withApiHandler(async () => {
  const subscription = await getFarmSubscriptionStatus();
  return NextResponse.json({ subscription });
});

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Creates a provider redirect only after recalculating the current server-side offer. */
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

  const environment = process.env.WOMPI_ENVIRONMENT?.trim().toLowerCase();
  const environmentMatchesApp = process.env.NODE_ENV === "production"
    ? environment === "production"
    : environment === "sandbox";
  const publicKey = process.env.WOMPI_PUBLIC_KEY?.trim();
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
  const checkoutUrl = process.env.WOMPI_CHECKOUT_URL?.trim() || "https://checkout.wompi.co/p/";
  if (!environmentMatchesApp || !publicKey || !integritySecret) {
    return NextResponse.json(
      { error: "El medio de pago todavía no está configurado.", code: "CHECKOUT_PROVIDER_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  let providerUrl: URL;
  try {
    providerUrl = new URL(checkoutUrl);
  } catch {
    return NextResponse.json(
      { error: "La dirección de pago no está configurada correctamente.", code: "CHECKOUT_PROVIDER_URL_INVALID" },
      { status: 503 },
    );
  }
  if (providerUrl.protocol !== "https:" || providerUrl.hostname !== "checkout.wompi.co") {
    return NextResponse.json(
      { error: "La dirección de pago debe pertenecer al checkout seguro de Wompi.", code: "CHECKOUT_PROVIDER_URL_INVALID" },
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

  const reference = "IWG-" + randomUUID();
  const currency = "COP";
  const signature = createHash("sha256")
    .update(reference + amountInCents + currency + integritySecret)
    .digest("hex");
  providerUrl.searchParams.set("public-key", publicKey);
  providerUrl.searchParams.set("currency", currency);
  providerUrl.searchParams.set("amount-in-cents", String(amountInCents));
  providerUrl.searchParams.set("reference", reference);
  providerUrl.searchParams.set("signature:integrity", signature);
  if (process.env.WOMPI_REDIRECT_URL) {
    providerUrl.searchParams.set("redirect-url", process.env.WOMPI_REDIRECT_URL);
  }

  const acceptedAt = new Date().toISOString();
  const acceptedBy = await getSessionUser();
  await db.insert(billingPayments).values({
    farmId: renewalFarm?.id ?? getCurrentFarmId(),
    provider: "wompi",
    externalReference: reference,
    method: "checkout",
    amountCop: quote.totalBeforeLogisticsAndTaxCop,
    planCode: "PRODUCTOR",
    status: "pending",
    rawPayload: {
      pricingPurchase: {
        schemaVersion: "iwagranja-plan-purchase-v1",
        policyVersion: quote.policyVersion,
        termsVersion: LEGAL_DOCS_VERSION,
        acceptedTerms: true,
        acceptedDocuments: ["terminos", "retracto"],
        acceptedByUserId: acceptedBy?.id ?? null,
        acceptedAt,
        environment,
        renewalFarm,
        quote,
      },
    },
  });

  return NextResponse.json(
    { redirectUrl: providerUrl.toString(), reference },
    { headers: { "Cache-Control": "no-store" } },
  );
});

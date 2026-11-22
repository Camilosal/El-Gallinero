import { NextRequest, NextResponse } from "next/server";
import { ApiHttpError, safeParseJson, withErrorHandler } from "@/lib/api-handler";
import { isRequestRateLimited } from "@/lib/rate-limit";
import { PricingConfigurationError } from "@/lib/pricing/financial-policy";
import { createPricingQuote } from "@/lib/pricing/quote";
import { getSessionUser } from "@/lib/auth";
import { runWithFarmContext } from "@/db/tenant-context";
import { verifyRenewalFarmId, type RenewalPlanSegment } from "@/lib/pricing/renewal-farm";

export const dynamic = "force-dynamic";

function quoteResponse(payload: unknown): NextResponse {
  try {
    const quote = createPricingQuote(payload);
    return NextResponse.json(
      { quote },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ApiHttpError) {
      return NextResponse.json(
        { error: error.message, ...(error.details || {}) },
        { status: error.statusCode, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof PricingConfigurationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo calcular el costo del plan." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}

// The calculator is public and may be used before registration. It returns
// only the calculated plan cost; private pricing inputs remain server-side.
export const POST = withErrorHandler(async (req: NextRequest) => {
  if (
    isRequestRateLimited(req, {
      namespace: "public-pricing-quote",
      windowMs: 15 * 60 * 1000,
      maxAttempts: 120,
    })
  ) {
    return NextResponse.json(
      { error: "Se alcanzó el límite temporal de cálculos. Espera unos minutos e inténtalo de nuevo." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const payload = await safeParseJson(req);
  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: "La solicitud de cálculo no es válida." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (
    "segment" in payload &&
    (payload.segment === "producer" || payload.segment === "aggregator") &&
    "renewal" in payload &&
    payload.renewal === true
  ) {
    const segment = payload.segment as RenewalPlanSegment;
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json(
        { error: "Inicia sesión y comprueba el FarmID para calcular el beneficio de continuidad.", code: "RENEWAL_LOGIN_REQUIRED" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    return runWithFarmContext(user.farmId, async () => {
      try {
        await verifyRenewalFarmId("farmId" in payload ? payload.farmId : undefined, segment);
      } catch (error) {
        if (error instanceof ApiHttpError) {
          return NextResponse.json(
            { error: error.message, ...(error.details || {}) },
            { status: error.statusCode, headers: { "Cache-Control": "no-store" } },
          );
        }
        throw error;
      }
      return quoteResponse(payload);
    });
  }

  return quoteResponse(payload);
});

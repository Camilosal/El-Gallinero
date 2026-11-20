import { NextRequest, NextResponse } from "next/server";
import { isRequestRateLimited } from "@/lib/rate-limit";
import { PricingConfigurationError } from "@/lib/pricing/financial-policy";
import { getPublicPricingMatrix } from "@/lib/pricing/quote";
import type { PricingSegment } from "@/lib/pricing/types";

export const dynamic = "force-dynamic";

/** Returns only public subscription comparisons; internal cost inputs stay server-side. */
export async function GET(req: NextRequest) {
  if (isRequestRateLimited(req, {
    namespace: "public-pricing-matrix",
    windowMs: 15 * 60 * 1000,
    maxAttempts: 240,
  })) {
    return NextResponse.json(
      { error: "Se alcanzó el límite temporal de consultas. Espera unos minutos e inténtalo de nuevo." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const segment = req.nextUrl.searchParams.get("segment");
  if (segment !== "producer" && segment !== "aggregator") {
    return NextResponse.json(
      { error: "Selecciona Mi granja u Organización y proyectos." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const matrix = getPublicPricingMatrix(segment as PricingSegment);
    return NextResponse.json(
      { matrix },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const configurationError = error instanceof PricingConfigurationError;
    return NextResponse.json(
      {
        error: configurationError
          ? error.message
          : "No pudimos preparar la comparación. Inténtalo de nuevo más tarde.",
      },
      { status: configurationError ? 503 : 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

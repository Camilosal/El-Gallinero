import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-handler";
import { getPublicPricingOffer } from "@/lib/pricing/quote";

export const dynamic = "force-dynamic";

// The offer is public commercial information and the pricing page calls it
// before a user signs in. It must not go through the authenticated data wrapper.
export const GET = withErrorHandler(async () =>
  NextResponse.json(
    { offer: getPublicPricingOffer() },
    { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" } },
  ),
);

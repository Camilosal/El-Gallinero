import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getCurrentFarmId } from "@/db/tenant-context";
import { alignFarmFeedsToStandardCatalog } from "@/lib/feeding/catalog-alignment";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/produccion/alimentacion/alinear-catalogo
 * Normaliza categorías/tipos legados y alinea alimentos actuales de la finca con el catálogo base IG-001..IG-119.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const farmId = getCurrentFarmId();
  const body = await safeParseJson(req).catch(() => ({}));
  const seedStarterCalciumAndRoot = body?.seedStarterCalciumAndRoot !== false;
  const result = await alignFarmFeedsToStandardCatalog(farmId, db, {
    seedStarterCalciumAndRoot,
  });
  return NextResponse.json({
    ok: true,
    ...result,
  });
});

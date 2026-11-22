import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getCurrentFarmId } from "@/db/tenant-context";
import { alignFarmCapexCatalog } from "@/lib/finance/capex-catalog-alignment";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/operaciones/activos/alinear-catalogo
 * Enriquece idempotentemente los activos históricos en `farm_assets` y sincroniza
 * las familias productivas `categoria_capex` en `catalogos` según `Catalogo Capex - Inversiones.csv`
 * sin alterar costos de adquisición, valores residuales ni estados operativos.
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const farmId = getCurrentFarmId();
  const body = await safeParseJson(req).catch(() => ({}));
  const syncCatalogosList = body?.syncCatalogosList !== false;
  const result = await alignFarmCapexCatalog(farmId, db, { syncCatalogosList });
  return NextResponse.json({
    ok: true,
    ...result,
  });
});

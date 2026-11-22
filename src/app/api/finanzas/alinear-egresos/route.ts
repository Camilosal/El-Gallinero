import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getCurrentFarmId } from "@/db/tenant-context";
import { alignFarmExpenseCatalog } from "@/lib/finance/expense-catalog-alignment";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/finanzas/alinear-egresos
 * Alinea idempotentemente transacciones históricas, presupuestos, productos frecuentes,
 * prorrateos y lista maestra `categoria_egreso` al Catálogo de Egresos estándar (CST-001..CST-303).
 */
export const POST = withApiHandler(async (req: NextRequest) => {
  const farmId = getCurrentFarmId();
  const body = await safeParseJson(req).catch(() => ({}));
  const syncCatalogosList = body?.syncCatalogosList !== false;
  const result = await alignFarmExpenseCatalog(farmId, db, { syncCatalogosList });
  return NextResponse.json({
    ok: true,
    ...result,
  });
});

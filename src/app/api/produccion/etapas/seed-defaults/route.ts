import { NextResponse } from "next/server";
import { getCurrentFarmId } from "@/db/tenant-context";
import { withApiHandler } from "@/lib/api-handler";
import { seedStarterFeedsAndPrograms } from "@/lib/feeding/default-tenant-seed";
import { requirePermission } from "@/lib/rbac-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/produccion/etapas/seed-defaults
 * Inicializa de forma idempotente alimentos base (sin proveedor), etapas multi-especie
 * y planes de alimentación mixtos para granjas creadas antes de esta precarga.
 */
export const POST = withApiHandler(async () => {
  const forbidden = await requirePermission(
    "catalogs:write",
    "Tu rol no puede inicializar planes de alimentación",
  );
  if (forbidden) return forbidden;

  const summary = await seedStarterFeedsAndPrograms(getCurrentFarmId());
  return NextResponse.json({ ok: true, ...summary });
});

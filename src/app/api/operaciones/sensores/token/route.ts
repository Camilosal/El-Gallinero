import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farms } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { generateSensorIngestToken } from "@/lib/farm-code.server";
import { requirePermission } from "@/lib/rbac-server";

export const dynamic = "force-dynamic";

/** GET /api/operaciones/sensores/token — Estado y prefijo del token IoT de la granja activa. */
export const GET = withApiHandler(async () => {
  const denied = await requirePermission(["operations:manage", "settings:manage"]);
  if (denied) return denied;

  const farmId = getCurrentFarmId();
  const [farm] = await db
    .select({
      id: farms.id,
      code: farms.code,
      name: farms.name,
      sensorTokenPrefix: farms.sensorTokenPrefix,
      hasSensorToken: farms.sensorTokenHash,
    })
    .from(farms)
    .where(eq(farms.id, farmId))
    .limit(1);

  if (!farm) {
    return NextResponse.json({ error: "Granja no encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    farmId: farm.id,
    farmCode: farm.code,
    farmName: farm.name,
    configured: Boolean(farm.hasSensorToken),
    tokenPrefix: farm.sensorTokenPrefix || null,
  });
});

/** POST /api/operaciones/sensores/token — Emite o rota el token secreto IoT de la granja activa. */
export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission(["operations:manage", "settings:manage"]);
  if (denied) return denied;

  const body = await safeParseJson(req);
  const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : "rotate";
  const farmId = getCurrentFarmId();

  if (action === "revoke") {
    const [updated] = await db
      .update(farms)
      .set({
        sensorTokenHash: null,
        sensorTokenPrefix: null,
        updatedAt: new Date(),
      })
      .where(eq(farms.id, farmId))
      .returning({
        id: farms.id,
        code: farms.code,
        name: farms.name,
      });

    if (!updated) {
      return NextResponse.json({ error: "Granja no encontrada" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      revoked: true,
      configured: false,
      farmId: updated.id,
      farmCode: updated.code,
      farmName: updated.name,
      tokenPrefix: null,
      rawToken: null,
    });
  }

  const issued = generateSensorIngestToken();
  const [updated] = await db
    .update(farms)
    .set({
      sensorTokenHash: issued.tokenHash,
      sensorTokenPrefix: issued.tokenPrefix,
      updatedAt: new Date(),
    })
    .where(eq(farms.id, farmId))
    .returning({
      id: farms.id,
      code: farms.code,
      name: farms.name,
    });

  if (!updated) {
    return NextResponse.json({ error: "Granja no encontrada" }, { status: 404 });
  }

  return NextResponse.json(
    {
      ok: true,
      configured: true,
      farmId: updated.id,
      farmCode: updated.code,
      farmName: updated.name,
      tokenPrefix: issued.tokenPrefix,
      rawToken: issued.rawToken,
    },
    { status: 201 },
  );
});

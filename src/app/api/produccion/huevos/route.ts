import { db } from "@/db";
import { eggProduction, eggProductionDetails, autoconsumoLogs, farmLocations } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getEggStorageThresholds } from "@/lib/settings";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { lockEggInventory } from "@/lib/inventory-locks";
import { computeEggInventory, eggInventoryBookBalance } from "@/lib/inventory";
import { assertDateNotClosed } from "@/lib/sanitary-locks";
import { checkEggStorageTelemetry } from "@/lib/ntc1240";
import { registerEggProduction } from "@/lib/production/egg-production-service";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const speciesFilter = searchParams.get("species");

  const query = db.select().from(eggProduction);
  const records = speciesFilter && speciesFilter !== "all"
    ? await query.where(eq(eggProduction.species, speciesFilter as any)).orderBy(desc(eggProduction.date)).limit(100)
    : await query.orderBy(desc(eggProduction.date)).limit(100);

  const ids = records.map((r) => r.id);
  const details = ids.length
    ? await db.select().from(eggProductionDetails).where(inArray(eggProductionDetails.productionId, ids))
    : [];
  const byProd = new Map<string, { size: string; quantity: number }[]>();
  for (const d of details) {
    const arr = byProd.get(d.productionId) || [];
    arr.push({ size: d.size, quantity: d.quantity });
    byProd.set(d.productionId, arr);
  }
  const [locations, storageThresholds] = await Promise.all([
    db.select({ id: farmLocations.id, name: farmLocations.name }).from(farmLocations),
    getEggStorageThresholds(),
  ]);
  const locationNames = new Map(locations.map((item) => [item.id, item.name]));
  return NextResponse.json(
    records.map((r) => ({
      ...r,
      locationName: r.locationId ? locationNames.get(r.locationId) || null : null,
      storageWarnings: checkEggStorageTelemetry(r.storageTempC, r.storageHumidityPct, storageThresholds),
      details: byProd.get(r.id) || [],
    })),
  );
});

async function handleSave(req: NextRequest, isUpdate: boolean) {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }
  const sessionUser = await getSessionUser();
  const result = await registerEggProduction(body, {
    isUpdate,
    sessionRole: sessionUser?.role,
  });

  if (result.deduplicated) {
    return NextResponse.json(result.record, {
      status: 200,
      headers: { "X-Idempotent-Replay": "1" },
    });
  }

  return NextResponse.json(
    {
      ...result.record,
      storageWarnings: result.storageWarnings,
    },
    { status: isUpdate ? 200 : 201 },
  );
}

export const POST = withApiHandler(async (req: NextRequest) => {
  return handleSave(req, false);
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  return handleSave(req, true);
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });
  await db.transaction(async (tx) => {
    await lockEggInventory(tx);
    const inventoryBefore = await computeEggInventory(tx);
    const [production] = await tx.select({ id: eggProduction.id, date: eggProduction.date }).from(eggProduction).where(eq(eggProduction.id, id));
    if (!production) throw new Error("No encontrado");
    await assertDateNotClosed(tx, { date: production.date });
    await tx.delete(autoconsumoLogs).where(eq(autoconsumoLogs.eggProductionId, id));
    await tx.delete(eggProductionDetails).where(eq(eggProductionDetails.productionId, id));
    await tx.delete(eggProduction).where(eq(eggProduction.id, id));
    const inventoryAfter = await computeEggInventory(tx);
    if (eggInventoryBookBalance(inventoryAfter) < Math.min(0, eggInventoryBookBalance(inventoryBefore)) - 0.0001) {
      throw new Error("No se puede eliminar una producción con huevos ya vendidos o perdidos");
    }
  });
  return NextResponse.json({ ok: true });
});

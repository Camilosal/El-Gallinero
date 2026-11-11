import { NextResponse } from "next/server";
import { and, inArray, isNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { broilerBatches, hens, roosters } from "@/db/schema";
import { BATCH_PRESENT_STATUSES, HEN_PRESENT_STATUSES, ROOSTER_PRESENT_STATUSES } from "@/lib/animal-status";
import { withApiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const [henRows, roosterRows, batchRows] = await Promise.all([
    db.select({ id: hens.id, code: hens.code, status: hens.status }).from(hens)
      .where(and(isNull(hens.locationId), inArray(hens.status, HEN_PRESENT_STATUSES as (typeof hens.status.enumValues)[number][]))),
    db.select({ id: roosters.id, code: roosters.code, status: roosters.status }).from(roosters)
      .where(and(isNull(roosters.locationId), inArray(roosters.status, ROOSTER_PRESENT_STATUSES as (typeof roosters.status.enumValues)[number][]))),
    db.select({ id: broilerBatches.id, code: broilerBatches.code, species: broilerBatches.species,
      currentQuantity: broilerBatches.currentQuantity, status: broilerBatches.status }).from(broilerBatches)
      .where(and(isNull(broilerBatches.locationId), inArray(broilerBatches.status, BATCH_PRESENT_STATUSES as (typeof broilerBatches.status.enumValues)[number][]), gt(broilerBatches.currentQuantity, 0))),
  ]);

  return NextResponse.json([
    ...henRows.map((row) => ({ ...row, animalType: "gallina", species: "gallina", quantity: 1 })),
    ...roosterRows.map((row) => ({ ...row, animalType: "gallo", species: "gallo", quantity: 1 })),
    ...batchRows.map((row) => ({ ...row, animalType: "lote", quantity: row.currentQuantity })),
  ]);
});

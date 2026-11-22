import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farmLocations, feedInventory, feedMovements, supplyInventory, supplyMovements } from "@/db/schema";
import { parseIntegrationPagination, withIntegrationContext } from "@/lib/integrations/auth-guard";
import { formatInventoryMovementForProfile, type CanonicalInventoryMovement } from "@/lib/integrations/profiles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return await withIntegrationContext(req, ["read:inventory"], async (ctx) => {
      const { searchParams } = new URL(req.url);
      const pagingResult = parseIntegrationPagination(searchParams);
      if (!pagingResult.ok) {
        return NextResponse.json({ error: pagingResult.error }, { status: 400 });
      }
      const { limit, offset, updatedSince, from, to } = pagingResult.value;
      const sinceDate = updatedSince ? new Date(updatedSince) : null;

      const feedConds: SQL[] = [];
      const supplyConds: SQL[] = [];
      if (from) {
        feedConds.push(gte(feedMovements.date, from));
        supplyConds.push(gte(supplyMovements.date, from));
      }
      if (to) {
        feedConds.push(lte(feedMovements.date, to));
        supplyConds.push(lte(supplyMovements.date, to));
      }
      if (sinceDate) {
        feedConds.push(gte(feedMovements.createdAt, sinceDate));
        supplyConds.push(gte(supplyMovements.createdAt, sinceDate));
      }

      const [feedRows, supplyRows] = await Promise.all([
        db
          .select({
            id: feedMovements.id,
            itemId: feedMovements.feedId,
            itemName: feedInventory.name,
            unit: feedInventory.unit,
            fallbackCost: feedInventory.costPerUnit,
            unitCost: feedMovements.unitCost,
            quantity: feedMovements.quantity,
            isEntry: feedMovements.isEntry,
            movementType: feedMovements.movementType,
            species: feedMovements.species,
            locationCode: farmLocations.code,
            date: feedMovements.date,
            notes: feedMovements.notes,
            createdAt: feedMovements.createdAt,
          })
          .from(feedMovements)
          .innerJoin(feedInventory, eq(feedMovements.feedId, feedInventory.id))
          .leftJoin(farmLocations, eq(feedMovements.locationId, farmLocations.id))
          .where(feedConds.length ? and(...feedConds) : undefined),
        db
          .select({
            id: supplyMovements.id,
            itemId: supplyMovements.supplyId,
            itemName: supplyInventory.name,
            unit: supplyInventory.unit,
            fallbackCost: supplyInventory.costPerUnit,
            quantity: supplyMovements.quantity,
            isEntry: supplyMovements.isEntry,
            movementType: supplyMovements.movementType,
            date: supplyMovements.date,
            notes: supplyMovements.notes,
            createdAt: supplyMovements.createdAt,
          })
          .from(supplyMovements)
          .innerJoin(supplyInventory, eq(supplyMovements.supplyId, supplyInventory.id))
          .where(supplyConds.length ? and(...supplyConds) : undefined),
      ]);

      const canonical: CanonicalInventoryMovement[] = [
        ...feedRows.map((row) => {
          const qty = Number(row.quantity);
          const unitCost = row.unitCost !== null ? Number(row.unitCost) : Number(row.fallbackCost);
          return {
            id: row.id,
            itemId: row.itemId,
            sku: `FEED-${row.itemId.slice(0, 8).toUpperCase()}`,
            itemName: row.itemName,
            itemType: "alimento" as const,
            date: row.date,
            direction: row.isEntry ? ("entrada" as const) : ("salida" as const),
            movementType: row.movementType,
            quantity: qty,
            unit: row.unit,
            unitCost,
            totalCost: Math.round(qty * unitCost * 100) / 100,
            species: row.species ?? null,
            locationCode: row.locationCode ?? null,
            notes: row.notes ?? null,
            createdAt: row.createdAt.toISOString(),
          };
        }),
        ...supplyRows.map((row) => {
          const qty = Number(row.quantity);
          const unitCost = Number(row.fallbackCost);
          return {
            id: row.id,
            itemId: row.itemId,
            sku: `SUP-${row.itemId.slice(0, 8).toUpperCase()}`,
            itemName: row.itemName,
            itemType: "insumo" as const,
            date: row.date,
            direction: row.isEntry ? ("entrada" as const) : ("salida" as const),
            movementType: row.movementType,
            quantity: qty,
            unit: row.unit,
            unitCost,
            totalCost: Math.round(qty * unitCost * 100) / 100,
            species: null,
            locationCode: null,
            notes: row.notes ?? null,
            createdAt: row.createdAt.toISOString(),
          };
        }),
      ].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

      const total = canonical.length;
      const paged = canonical.slice(offset, offset + limit);
      const hasMore = offset + paged.length < total;
      const items = paged.map((mov) => formatInventoryMovementForProfile(mov, ctx.profile, ctx.mapping));

      return NextResponse.json(
        {
          object: "integration_list",
          resource: "inventory_movements",
          profile: ctx.profile,
          farmId: ctx.farmId,
          authVia: ctx.via,
          count: items.length,
          total,
          limit,
          cursor: String(offset),
          nextCursor: hasMore ? String(offset + paged.length) : null,
          hasMore,
          syncedAt: new Date().toISOString(),
          items,
        },
        { status: 200, headers: { "Cache-Control": "no-store" } },
      );
    });
  } catch (error) {
    console.error("Integrations inventory movements error:", error);
    return NextResponse.json(
      { error: "No se pudieron consultar los movimientos de inventario" },
      { status: 500 },
    );
  }
}

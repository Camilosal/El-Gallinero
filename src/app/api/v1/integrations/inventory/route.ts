import { gte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { feedInventory, supplyInventory } from "@/db/schema";
import { parseIntegrationPagination, withIntegrationContext } from "@/lib/integrations/auth-guard";
import { formatInventoryItemForProfile, type CanonicalInventoryItem } from "@/lib/integrations/profiles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return await withIntegrationContext(req, ["read:inventory"], async (ctx) => {
      const { searchParams } = new URL(req.url);
      const pagingResult = parseIntegrationPagination(searchParams);
      if (!pagingResult.ok) {
        return NextResponse.json({ error: pagingResult.error }, { status: 400 });
      }
      const { limit, offset, updatedSince } = pagingResult.value;
      const kind = (searchParams.get("kind") || "all").trim().toLowerCase();
      if (!["all", "alimento", "insumo", "feed", "supply"].includes(kind)) {
        return NextResponse.json(
          { error: "Parámetro kind inválido. Usa 'all', 'alimento' o 'insumo'." },
          { status: 400 },
        );
      }

      const includeFeeds = kind === "all" || kind === "alimento" || kind === "feed";
      const includeSupplies = kind === "all" || kind === "insumo" || kind === "supply";
      const sinceDate = updatedSince ? new Date(updatedSince) : null;

      const [feeds, supplies] = await Promise.all([
        includeFeeds
          ? db
              .select()
              .from(feedInventory)
              .where(sinceDate ? gte(feedInventory.updatedAt, sinceDate) : undefined)
          : Promise.resolve([]),
        includeSupplies
          ? db
              .select()
              .from(supplyInventory)
              .where(sinceDate ? gte(supplyInventory.updatedAt, sinceDate) : undefined)
          : Promise.resolve([]),
      ]);

      const canonical: CanonicalInventoryItem[] = [
        ...feeds.map((f) => {
          const stock = Number(f.currentStock);
          const cost = Number(f.costPerUnit);
          return {
            id: f.id,
            sku: `FEED-${f.id.slice(0, 8).toUpperCase()}`,
            itemType: "alimento" as const,
            name: f.name,
            category: f.category,
            subCategory: f.feedType,
            unit: f.unit,
            currentStock: stock,
            minStock: Number(f.minStock),
            costPerUnit: cost,
            inventoryValue: Math.round(stock * cost * 100) / 100,
            supplier: f.supplier ?? null,
            updatedAt: f.updatedAt.toISOString(),
          };
        }),
        ...supplies.map((s) => {
          const stock = Number(s.currentStock);
          const cost = Number(s.costPerUnit);
          return {
            id: s.id,
            sku: `SUP-${s.id.slice(0, 8).toUpperCase()}`,
            itemType: "insumo" as const,
            name: s.name,
            category: s.category,
            subCategory: null,
            unit: s.unit,
            currentStock: stock,
            minStock: Number(s.minStock),
            costPerUnit: cost,
            inventoryValue: Math.round(stock * cost * 100) / 100,
            supplier: s.supplier ?? null,
            updatedAt: s.updatedAt.toISOString(),
          };
        }),
      ].sort((a, b) => a.name.localeCompare(b.name, "es") || a.id.localeCompare(b.id));

      const total = canonical.length;
      const paged = canonical.slice(offset, offset + limit);
      const hasMore = offset + paged.length < total;
      const items = paged.map((item) => formatInventoryItemForProfile(item, ctx.profile, ctx.mapping));

      return NextResponse.json(
        {
          object: "integration_list",
          resource: "inventory",
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
    console.error("Integrations inventory error:", error);
    return NextResponse.json({ error: "No se pudo consultar el inventario" }, { status: 500 });
  }
}

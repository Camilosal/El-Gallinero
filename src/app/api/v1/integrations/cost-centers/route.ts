import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farmLocations } from "@/db/schema";
import { withIntegrationContext } from "@/lib/integrations/auth-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    return await withIntegrationContext(
      req,
      ["read:finance", "read:production"],
      async (ctx) => {
        const locations = await db
          .select({
            id: farmLocations.id,
            code: farmLocations.code,
            name: farmLocations.name,
            type: farmLocations.type,
            zoneType: farmLocations.zoneType,
            status: farmLocations.status,
            allowedSpecies: farmLocations.allowedSpecies,
            updatedAt: farmLocations.updatedAt,
          })
          .from(farmLocations)
          .where(eq(farmLocations.status, "activa"))
          .orderBy(asc(farmLocations.code), asc(farmLocations.name));

        const speciesCostCenters = Object.entries(ctx.mapping.costCentersBySpecies).map(
          ([species, code]) => ({
            kind: "species",
            code,
            name: `Centro de costo ${species}`,
            species,
            active: true,
          }),
        );

        const locationCostCenters = locations.map((loc) => ({
          kind: "location",
          id: loc.id,
          code: loc.code,
          name: loc.name,
          type: loc.type,
          zoneType: loc.zoneType,
          allowedSpecies: loc.allowedSpecies,
          active: loc.status === "activa",
          updatedAt: loc.updatedAt.toISOString(),
        }));

        const items = [...speciesCostCenters, ...locationCostCenters];

        return NextResponse.json(
          {
            object: "integration_list",
            resource: "cost_centers",
            profile: ctx.profile,
            farmId: ctx.farmId,
            authVia: ctx.via,
            count: items.length,
            total: items.length,
            cursor: "0",
            nextCursor: null,
            hasMore: false,
            syncedAt: new Date().toISOString(),
            items,
          },
          { status: 200, headers: { "Cache-Control": "no-store" } },
        );
      },
    );
  } catch (error) {
    console.error("Integrations cost-centers error:", error);
    return NextResponse.json(
      { error: "No se pudieron consultar los centros de costo" },
      { status: 500 },
    );
  }
}

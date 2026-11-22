import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import {
  CAPEX_DESTINATIONS,
  PRODUCTIVE_CAPEX_FAMILIES,
  STANDARD_CAPEX_FAMILIES,
  STANDARD_CAPEX_SUBFAMILIES,
  searchStandardCapexCatalog,
} from "@/lib/finance/standard-capex-catalog";

export const dynamic = "force-dynamic";

/**
 * GET /api/operaciones/activos/catalogo-capex
 * Lista y filtra las 21 familias, 20 subfamilias y 242 conceptos estandarizados
 * desde docs/Catalogos/Catalogo Capex - Inversiones.csv (CAP-001..CAP-242).
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const family = searchParams.get("family") || "all";
  const subfamily = searchParams.get("subfamily") || "all";
  const classification = searchParams.get("classification") || "all";
  const destination = searchParams.get("destination") || "all";
  const priority = searchParams.get("priority") || "all";
  const excludeFrontier = searchParams.get("excludeFrontier") === "true";

  const items = searchStandardCapexCatalog(q, {
    family,
    subfamily,
    classification,
    destination,
    priority,
    excludeFrontier,
  });

  return NextResponse.json({
    total: items.length,
    families: excludeFrontier ? PRODUCTIVE_CAPEX_FAMILIES : STANDARD_CAPEX_FAMILIES,
    subfamilies: STANDARD_CAPEX_SUBFAMILIES,
    destinations: CAPEX_DESTINATIONS,
    items,
  });
});

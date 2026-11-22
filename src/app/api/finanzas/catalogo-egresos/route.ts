import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import {
  NON_FEED_STANDARD_EXPENSE_FAMILIES,
  STANDARD_EXPENSE_FAMILIES,
  searchStandardExpenseCatalog,
} from "@/lib/finance/standard-expense-catalog";

export const dynamic = "force-dynamic";

/**
 * GET /api/finanzas/catalogo-egresos
 * Lista y filtra las 26 familias/centros y 303 conceptos estandarizados desde Catalogo Egresos.csv.
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const family = searchParams.get("family") || "all";
  const treatment = searchParams.get("treatment") || "all";
  const priority = searchParams.get("priority") || "all";
  const opexOnly = searchParams.get("opexOnly") === "true";
  const excludeFood = searchParams.get("excludeFood") === "true";

  const items = searchStandardExpenseCatalog(q, {
    family,
    treatment,
    priority,
    opexOnly,
    excludeFood,
  });

  return NextResponse.json({
    total: items.length,
    families: excludeFood ? NON_FEED_STANDARD_EXPENSE_FAMILIES : STANDARD_EXPENSE_FAMILIES,
    items,
  });
});

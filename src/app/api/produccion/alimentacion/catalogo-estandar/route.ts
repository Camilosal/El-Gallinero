import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import {
  STANDARD_FEED_GROUPS,
  searchStandardFeedCatalog,
} from "@/lib/feeding/standard-feed-catalog";
import type { SanitaryStatus } from "@/lib/feeding/standard-feed-catalog-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/produccion/alimentacion/catalogo-estandar
 * Consulta la base estandarizada de alimentos e ingredientes (IG-001..IG-119).
 */
export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const group = searchParams.get("group") || "all";
  const includeBlocked = searchParams.get("includeBlocked") !== "false";
  const sanitaryStatusParam = searchParams.get("sanitaryStatus");
  const sanitaryStatus =
    sanitaryStatusParam === "CONDICIONAL" ||
    sanitaryStatusParam === "RESTRINGIDO" ||
    sanitaryStatusParam === "NO USAR"
      ? (sanitaryStatusParam as SanitaryStatus)
      : undefined;

  const items = searchStandardFeedCatalog(q, {
    group,
    includeBlocked,
    sanitaryStatus,
  });

  return NextResponse.json({
    total: items.length,
    groups: STANDARD_FEED_GROUPS,
    items,
  });
});

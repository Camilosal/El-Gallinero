import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { isDateOnly, todayColombiaIso } from "@/lib/date-validation";
import { normalizeFeedingSpecies } from "@/lib/species";
import { buildXlsxBytes, rowsToCsv } from "@/lib/export/xlsx";
import { classifyNtc1240Caliber, computeAnalyticalAccounting } from "@/lib/analytics/contabilidad-analitica";

export const dynamic = "force-dynamic";

export { classifyNtc1240Caliber };

export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const today = todayColombiaIso();
  const defaultFrom = `${today.slice(0, 4)}-01-01`;
  const from = searchParams.get("from") || defaultFrom;
  const to = searchParams.get("to") || today;
  if (!isDateOnly(from) || !isDateOnly(to) || from > to) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const speciesParam = searchParams.get("species");
  const speciesFilter = speciesParam ? normalizeFeedingSpecies(speciesParam) : null;
  if (speciesParam && !speciesFilter) {
    return NextResponse.json({ error: "Especie no válida" }, { status: 400 });
  }
  const locationIdFilter = searchParams.get("locationId") || null;
  const batchIdFilter = searchParams.get("batchId") || null;
  const includeProrated = searchParams.get("includeProrated") !== "false";
  const format = (searchParams.get("format") || "json").toLowerCase();

  const payload = await computeAnalyticalAccounting({
    from,
    to,
    speciesFilter,
    locationIdFilter,
    batchIdFilter,
    includeProrated,
  });

  if (format === "csv") {
    const headers = [
      "Dimensión",
      "Clave",
      "Nombre",
      "Ingresos",
      "Costo Directo",
      "Costo Prorrateado",
      "Costo Total",
      "Alimento Devengado",
      "Utilidad Neta",
      "Margen %",
    ];
    const rows = [
      ...payload.bySpecies.map((r) => [
        "Especie",
        r.key,
        r.label,
        r.directRevenue,
        r.directCost,
        r.proratedCost,
        r.totalCost,
        r.accruedFeedCost,
        r.netProfit,
        r.marginPct ?? "",
      ]),
      ...payload.byLocation.map((r) => [
        "Lugar",
        r.key,
        r.label,
        r.directRevenue,
        r.directCost,
        r.proratedCost,
        r.totalCost,
        r.accruedFeedCost,
        r.netProfit,
        r.marginPct ?? "",
      ]),
    ];
    const csv = rowsToCsv(headers, rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contabilidad-analitica-${from}-a-${to}.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const bytes = buildXlsxBytes([
      {
        name: "Resumen",
        rows: [
          ["Indicador", "Valor"],
          ["Período", `${from} a ${to}`],
          ["Ingresos directos", payload.totals.directRevenue],
          ["Costos directos", payload.totals.directCost],
          ["Costos prorrateados", payload.totals.proratedCost],
          ["Utilidad neta", payload.totals.netProfit],
          ["Costo real / huevo", payload.unitEconomics.eggs.realCostPerEgg],
          ["Costo real / cubeta (30)", payload.unitEconomics.eggs.realCostPerTray30],
          ["Precio venta prom. / huevo", payload.unitEconomics.eggs.avgSalePricePerEgg],
          ["Costo real / kg vivo", payload.unitEconomics.meat.realCostPerLiveKg],
          ["Costo real / kg canal", payload.unitEconomics.meat.realCostPerCarcassKg],
          ["CAPEX activos", payload.capexRoi.totalAssetCapex],
          ["ROI anualizado %", payload.capexRoi.roiPercent ?? "N/D"],
          ["Retorno estimado (meses)", payload.capexRoi.paybackMonths ?? "N/D"],
        ],
      },
      {
        name: "Por Especie",
        rows: [
          ["Especie", "Ingresos", "Costo Directo", "Prorrateado", "Costo Total", "Alimento Devengado", "Utilidad Neta", "Margen %"],
          ...payload.bySpecies.map((r) => [
            r.label,
            r.directRevenue,
            r.directCost,
            r.proratedCost,
            r.totalCost,
            r.accruedFeedCost,
            r.netProfit,
            r.marginPct ?? "",
          ]),
        ],
      },
      {
        name: "Por Lugar",
        rows: [
          ["Lugar", "Ingresos", "Costo Directo", "Prorrateado", "Costo Total", "Alimento Devengado", "Utilidad Neta", "Margen %"],
          ...payload.byLocation.map((r) => [
            r.label,
            r.directRevenue,
            r.directCost,
            r.proratedCost,
            r.totalCost,
            r.accruedFeedCost,
            r.netProfit,
            r.marginPct ?? "",
          ]),
        ],
      },
      {
        name: "Calibres NTC 1240",
        rows: [
          [
            "Calibre",
            "Clasificación NTC 1240",
            "Cantidad Vendida",
            "Ingreso",
            "Precio Prom./u",
            "Costo Real/u",
            "Margen/u",
            "Margen Total",
            "Margen %",
          ],
          ...payload.unitEconomics.caliberMargins.map((c) => [
            c.caliber,
            c.ntcLabel,
            c.quantitySold,
            c.revenue,
            c.avgUnitPrice,
            c.unitCost,
            c.unitMargin,
            c.grossMargin,
            c.marginPct ?? "",
          ]),
        ],
      },
    ]);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="contabilidad-analitica-${from}-a-${to}.xlsx"`,
      },
    });
  }

  return NextResponse.json(payload);
});

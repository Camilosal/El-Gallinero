import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { isDateOnly, todayColombiaIso } from "@/lib/date-validation";
import { normalizeFeedingSpecies } from "@/lib/species";
import { buildXlsxBytes, rowsToCsv } from "@/lib/export/xlsx";
import { classifyNtc1240Caliber, computeAnalyticalAccounting } from "@/lib/analytics/contabilidad-analitica";

export const dynamic = "force-dynamic";

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
          ["Costos operativos devengados", payload.totals.directCost],
          ["Insumos consumidos devengados", payload.totals.supplyCost],
          ["Trabajo propio del productor (valorado)", payload.totals.imputedOwnerLaborCost],
          ["Depreciación CapEx del período", payload.totals.depreciationCost],
          ["Costos prorrateados", payload.totals.proratedCost],
          ["Utilidad operativa devengada", payload.totals.netProfit],
          ["Flujo de caja neto (liquidez)", payload.totals.cashNetFlow],
          ["CapEx invertido (excluido del gasto directo)", payload.totals.capexExcluded],
          ["Alimento disponible en bodega", payload.warehouseFeed.totalValueCop],
          ["Insumos disponibles en bodega", payload.warehouseSupply.totalValueCop],
          ["Valor neto equipos (patrimonio)", payload.assetsDepreciation.netBookValueCop],
          ["Capital biológico vivo en granja", payload.biologicalPortfolio.totalBiologicalValueCop],
          ["Etapa del ciclo", payload.lifecycleLabel],
          ["Costo real / huevo", payload.unitEconomics.eggs.realCostPerEgg],
          ["Costo real / cubeta (30)", payload.unitEconomics.eggs.realCostPerTray30],
          ["Precio venta prom. / huevo", payload.unitEconomics.eggs.avgSalePricePerEgg],
          ["Costo real / kg vivo", payload.unitEconomics.meat.realCostPerLiveKg],
          ["Costo real / kg canal", payload.unitEconomics.meat.realCostPerCarcassKg],
          ["CAPEX activos", payload.capexRoi.totalAssetCapex],
          ["% Recuperación CapEx", payload.assetsDepreciation.capexRecoveryPct],
          ["ROI anualizado %", payload.capexRoi.roiPercent ?? "N/D"],
          ["Retorno estimado (meses)", payload.capexRoi.paybackMonths ?? "N/D"],
        ],
      },
      {
        name: "Patrimonio y Biología",
        rows: [
          ["Unidad / Lote", "Especie", "Propósito", "Animales", "Edad (días)", "Etapa valoración", "Base invertida", "Valor biológico", "Valor proyectado cosecha", "Factor ambiente"],
          ...payload.biologicalPortfolio.units.map((u) => [
            u.name,
            u.species,
            u.purpose,
            u.animalCount,
            u.ageDays,
            u.valuationStageLabel,
            u.investedBaseCop,
            u.biologicalValueCop,
            u.projectedHarvestValueCop,
            u.environmentFactor,
          ]),
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
      {
        name: "Tributario y Nomina",
        rows: [
          ["Concepto", "Valor COP"],
          ["IVA generado en ventas", payload.taxAndDeductions.ivaGeneradoCop],
          ["IVA descontable en compras", payload.taxAndDeductions.ivaDescontableCop],
          ["Saldo estimado IVA", payload.taxAndDeductions.ivaSaldoEstimadoCop],
          ["ReteFuente practicada (egresos + nómina)", payload.taxAndDeductions.reteFuentePracticadaCop],
          ["ReteFuente sufrida en ventas", payload.taxAndDeductions.reteFuenteSufridaCop],
          ["ICA municipal declarado", payload.taxAndDeductions.icaTotalCop],
          ["Otras deducciones", payload.taxAndDeductions.otherDeductionsCop],
          ["Nómina bruta devengada/pagada", payload.taxAndDeductions.payrollGrossCop],
          ["Aportes y prestaciones empleador", payload.taxAndDeductions.payrollEmployerBurdenCop],
          ["Deducciones al trabajador (salud/pensión)", payload.taxAndDeductions.payrollWorkerDeductionsCop],
          ["Trabajo propio productor (no retirado)", payload.taxAndDeductions.imputedOwnerLaborCop],
          ["GMF (4x1000) estimado", payload.taxAndDeductions.gmf4x1000EstimatedCop],
        ],
      },
      {
        name: "Egresos por Familia",
        rows: [
          ["Familia / centro", "Tratamiento", "Es OPEX", "Registros", "Conceptos", "Total COP"],
          ...(payload.expensesByFamily || []).map((f) => [
            f.family,
            f.treatment,
            f.isOpex ? "Sí" : "No (No OPEX)",
            f.count,
            f.conceptsCount,
            f.total,
          ]),
        ],
      },
      {
        name: "Activos y CapEx",
        rows: [
          [
            "Código",
            "Activo",
            "Código CAP",
            "Familia CapEx",
            "Subfamilia CapEx",
            "Clasificación",
            "Destino",
            "Driver reparto",
            "Costo adquisición COP",
            "Valor residual COP",
            "Depreciación período COP",
            "Depreciación acumulada COP",
            "Valor neto libros COP",
          ],
          ...(payload.assetsDepreciation.breakdown || []).map((a) => [
            a.code,
            a.name,
            a.capexCatalogId ?? "",
            a.capexFamily ?? "",
            a.capexSubfamily ?? "",
            a.capexClassification ?? "",
            a.capexDestination ?? "",
            a.capexDriver ?? "",
            a.acquisitionCostCop,
            a.residualValueCop,
            a.periodDepreciationCop,
            a.accumulatedDepreciationCop,
            a.netBookValueCop,
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

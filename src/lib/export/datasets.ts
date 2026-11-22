// Catálogo de datos exportables del modelo de operación de la granja.
// Cada dataset declara sus cabeceras estables y su consulta; el endpoint
// /api/export lo serializa a CSV o XLSX reutilizando src/lib/export/xlsx.ts.
// Todas las consultas corren dentro del contexto de granja (RLS por farm_id).

import { and, asc, desc, eq, getTableColumns, getTableName, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import * as farmSchema from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import {
  broilerBatches,
  dailyClosures,
  eggProduction,
  eggProductionDetails,
  eggSales,
  feedInventory,
  feedMovements,
  farmLocations,
  healthControl,
  hens,
  manureProduction,
  manureSales,
  meatSales,
  mortalityRecords,
  sensorReadings,
  slaughter,
  transactions,
  weightLogs,
} from "@/db/schema";
import { isDateOnly, todayColombiaIso } from "@/lib/date-validation";
import { feedTypeLabel, inferFeedCatalogGroup, normalizeFeedCatalogGroup } from "@/lib/feed-classification";
import { findStandardFeedById } from "@/lib/feeding/standard-feed-catalog";
import { resolveExpenseClassification } from "@/lib/finance/standard-expense-catalog";
import type { CellValue } from "./xlsx";

/** Tope de filas por dataset para proteger memoria y tiempos de respuesta. */
export const EXPORT_MAX_ROWS = 50_000;

/** Ventana máxima consultable en un solo archivo (2 años). */
export const EXPORT_MAX_RANGE_DAYS = 731;

export const EXPORT_DEFAULT_DAYS = 30;

export type ExportFormat = "csv" | "xlsx";

export interface ExportRange {
  from: string;
  to: string;
}

export interface ExportDatasetResult {
  headers: string[];
  rows: CellValue[][];
  truncated: boolean;
}

export interface ExportDataset {
  id: string;
  label: string;
  description: string;
  category: "operacion" | "produccion" | "sanidad" | "finanzas" | "inventario" | "infraestructura";
  granularity: "diaria" | "por registro" | "estado actual" | "libro";
  usesRange: boolean;
  formats: ExportFormat[];
  /** Columnas que verá el consumidor externo (para documentación y pruebas). */
  headers: string[];
  load: (range: ExportRange) => Promise<ExportDatasetResult>;
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

async function locationNames(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: farmLocations.id, name: farmLocations.name })
    .from(farmLocations);
  return new Map(rows.map((row) => [row.id, row.name]));
}

async function feedNames(): Promise<Map<string, { name: string; unit: string }>> {
  const rows = await db
    .select({ id: feedInventory.id, name: feedInventory.name, unit: feedInventory.unit })
    .from(feedInventory);
  return new Map(rows.map((row) => [row.id, { name: row.name, unit: row.unit }]));
}

async function batchCodes(): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: broilerBatches.id, code: broilerBatches.code })
    .from(broilerBatches);
  return new Map(rows.map((row) => [row.id, row.code]));
}

async function loadCapped<T>(fetchRows: (limit: number) => Promise<T[]>): Promise<{
  rows: T[];
  truncated: boolean;
}> {
  const rows = await fetchRows(EXPORT_MAX_ROWS + 1);
  if (rows.length > EXPORT_MAX_ROWS) {
    return { rows: rows.slice(0, EXPORT_MAX_ROWS), truncated: true };
  }
  return { rows, truncated: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resumen diario de operación (una fila por fecha, base ideal para dashboards)
// ─────────────────────────────────────────────────────────────────────────────

const RESUMEN_HEADERS = [
  "Fecha",
  "Huevos recolectados",
  "Huevos rotos",
  "Huevos descartados",
  "Huevos para incubación",
  "Huevos autoconsumo",
  "Huevos excedente",
  "Huevos vendidos",
  "Ingreso por huevos",
  "Alimento consumido (kg)",
  "Costo alimento consumido",
  "Alimento comprado (kg)",
  "Mortalidad (aves)",
  "Eventos sanitarios",
  "Costo sanidad",
  "Ingresos totales",
  "Egresos totales",
  "Balance del día",
  "Carne vendida (kg)",
  "Ingreso por carne",
  "Gallinaza producida (kg)",
  "Gallinaza vendida (kg)",
  "Ingreso por gallinaza",
];

async function loadResumenDiario(range: ExportRange): Promise<ExportDatasetResult> {
  const result = await db.execute(sql`
    WITH days AS (
      SELECT generate_series(${range.from}::date, ${range.to}::date, interval '1 day')::date AS d
    )
    SELECT
      to_char(d.d, 'YYYY-MM-DD') AS fecha,
      COALESCE(ep.total_collected, 0) AS huevos_recolectados,
      COALESCE(ep.broken, 0) AS huevos_rotos,
      COALESCE(ep.discarded, 0) AS huevos_descartados,
      COALESCE(ep.for_incubation, 0) AS huevos_incubacion,
      COALESCE(ep.autoconsumo, 0) AS huevos_autoconsumo,
      COALESCE(ep.excedente, 0) AS huevos_excedente,
      COALESCE(es.quantity, 0) AS huevos_vendidos,
      COALESCE(es.amount, 0) AS ingreso_huevos,
      COALESCE(fm.consumed, 0) AS alimento_consumido_kg,
      COALESCE(fm.consumed_cost, 0) AS costo_alimento_consumido,
      COALESCE(fm.purchased, 0) AS alimento_comprado_kg,
      COALESCE(mr.quantity, 0) AS mortalidad,
      COALESCE(hc.events, 0) AS eventos_sanitarios,
      COALESCE(hc.cost, 0) AS costo_sanidad,
      COALESCE(tx.income, 0) AS ingresos,
      COALESCE(tx.expenses, 0) AS egresos,
      COALESCE(tx.income, 0) - COALESCE(tx.expenses, 0) AS balance,
      COALESCE(ms.kg, 0) AS carne_kg,
      COALESCE(ms.amount, 0) AS ingreso_carne,
      COALESCE(mp.kg, 0) AS gallinaza_producida_kg,
      COALESCE(mv.kg, 0) AS gallinaza_vendida_kg,
      COALESCE(mv.amount, 0) AS ingreso_gallinaza
    FROM days d
    LEFT JOIN (
      SELECT date,
        SUM(total_collected) AS total_collected,
        SUM(broken) AS broken,
        SUM(discarded) AS discarded,
        SUM(for_incubation) AS for_incubation,
        SUM(quantity_autoconsumo) AS autoconsumo,
        SUM(quantity_excedente) AS excedente
      FROM egg_production
      WHERE date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY date
    ) ep ON ep.date = d.d
    LEFT JOIN (
      SELECT date, SUM(quantity) AS quantity, SUM(total_amount) AS amount
      FROM egg_sales
      WHERE date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY date
    ) es ON es.date = d.d
    LEFT JOIN (
      SELECT date,
        SUM(CASE WHEN is_entry THEN 0 ELSE quantity END) AS consumed,
        SUM(CASE WHEN is_entry THEN COALESCE(quantity * unit_cost, 0) ELSE 0 END) AS consumed_cost,
        SUM(CASE WHEN is_entry THEN quantity ELSE 0 END) AS purchased
      FROM feed_movements
      WHERE date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY date
    ) fm ON fm.date = d.d
    LEFT JOIN (
      SELECT date, SUM(quantity) AS quantity
      FROM mortality_records
      WHERE date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY date
    ) mr ON mr.date = d.d
    LEFT JOIN (
      SELECT date, COUNT(*) AS events, SUM(COALESCE(cost, 0)) AS cost
      FROM health_control
      WHERE date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY date
    ) hc ON hc.date = d.d
    LEFT JOIN (
      SELECT date,
        SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END) AS income,
        SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END) AS expenses
      FROM transactions
      WHERE date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY date
    ) tx ON tx.date = d.d
    LEFT JOIN (
      SELECT date, SUM(quantity_kg) AS kg, SUM(total_amount) AS amount
      FROM meat_sales
      WHERE date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY date
    ) ms ON ms.date = d.d
    LEFT JOIN (
      SELECT date, SUM(kg_produced) AS kg
      FROM manure_production
      WHERE date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY date
    ) mp ON mp.date = d.d
    LEFT JOIN (
      SELECT date, SUM(quantity_kg) AS kg, SUM(total_amount) AS amount
      FROM manure_sales
      WHERE date BETWEEN ${range.from}::date AND ${range.to}::date
      GROUP BY date
    ) mv ON mv.date = d.d
    ORDER BY d.d
  `);

  const rows = (result.rows as Record<string, unknown>[]).map((row) => [
    str(row.fecha),
    num(row.huevos_recolectados) ?? 0,
    num(row.huevos_rotos) ?? 0,
    num(row.huevos_descartados) ?? 0,
    num(row.huevos_incubacion) ?? 0,
    num(row.huevos_autoconsumo) ?? 0,
    num(row.huevos_excedente) ?? 0,
    num(row.huevos_vendidos) ?? 0,
    num(row.ingreso_huevos) ?? 0,
    num(row.alimento_consumido_kg) ?? 0,
    num(row.costo_alimento_consumido) ?? 0,
    num(row.alimento_comprado_kg) ?? 0,
    num(row.mortalidad) ?? 0,
    num(row.eventos_sanitarios) ?? 0,
    num(row.costo_sanidad) ?? 0,
    num(row.ingresos) ?? 0,
    num(row.egresos) ?? 0,
    num(row.balance) ?? 0,
    num(row.carne_kg) ?? 0,
    num(row.ingreso_carne) ?? 0,
    num(row.gallinaza_producida_kg) ?? 0,
    num(row.gallinaza_vendida_kg) ?? 0,
    num(row.ingreso_gallinaza) ?? 0,
  ]);

  return { headers: RESUMEN_HEADERS, rows, truncated: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// Producción de huevos
// ─────────────────────────────────────────────────────────────────────────────

const HUEVOS_HEADERS = [
  "Fecha",
  "Especie",
  "Lote (PEPS)",
  "Lugar",
  "Recolectados",
  "Rotos",
  "Descartados",
  "Para incubación",
  "Autoconsumo",
  "Excedente",
  "Precio referencia",
  "Temperatura almacenamiento (°C)",
  "Humedad almacenamiento (%)",
  "Tallas",
  "Notas",
];

async function loadHuevos(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(eggProduction)
      .where(and(gte(eggProduction.date, range.from), lte(eggProduction.date, range.to)))
      .orderBy(desc(eggProduction.date), asc(eggProduction.createdAt))
      .limit(limit),
  );

  const [locations, details] = await Promise.all([
    locationNames(),
    rows.length
      ? db
          .select()
          .from(eggProductionDetails)
          .where(inArray(eggProductionDetails.productionId, rows.map((row) => row.id)))
      : Promise.resolve([]),
  ]);

  const sizesByProduction = new Map<string, string[]>();
  for (const detail of details) {
    const list = sizesByProduction.get(detail.productionId) ?? [];
    list.push(`${detail.size}: ${detail.quantity}`);
    sizesByProduction.set(detail.productionId, list);
  }

  return {
    headers: HUEVOS_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.date,
      row.species,
      str(row.lotCode),
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      row.totalCollected,
      row.broken,
      row.discarded,
      row.forIncubation,
      row.quantityAutoconsumo,
      row.quantityExcedente,
      num(row.referenceUnitPrice),
      num(row.storageTempC),
      num(row.storageHumidityPct),
      (sizesByProduction.get(row.id) ?? []).join(" | "),
      str(row.notes),
    ]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ventas de huevos
// ─────────────────────────────────────────────────────────────────────────────

const VENTAS_HUEVOS_HEADERS = [
  "Fecha",
  "Especie",
  "Lote (PEPS)",
  "Lugar",
  "Cantidad",
  "Talla",
  "Presentación",
  "Precio unitario",
  "Monto total",
  "Comprador",
  "Notas",
];

async function loadVentasHuevos(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(eggSales)
      .where(and(gte(eggSales.date, range.from), lte(eggSales.date, range.to)))
      .orderBy(desc(eggSales.date))
      .limit(limit),
  );
  const locations = await locationNames();

  return {
    headers: VENTAS_HUEVOS_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.date,
      row.species,
      str(row.lotCode),
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      row.quantity,
      str(row.size),
      str(row.presentation),
      num(row.pricePerUnit),
      num(row.totalAmount),
      str(row.buyer),
      str(row.notes),
    ]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Animales: gallinas y lotes
// ─────────────────────────────────────────────────────────────────────────────

const GALLINAS_HEADERS = [
  "Código",
  "Raza",
  "Fecha de nacimiento",
  "Estado",
  "Peso (kg)",
  "Empollando",
  "Lugar",
  "Costo de adquisición",
  "Notas",
];

async function loadGallinas(): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db.select().from(hens).orderBy(asc(hens.code)).limit(limit),
  );
  const locations = await locationNames();

  return {
    headers: GALLINAS_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.code,
      row.breed,
      row.birthDate,
      row.status,
      num(row.weight),
      row.isBroody,
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      num(row.acquisitionCost),
      str(row.notes),
    ]),
  };
}

const LOTES_HEADERS = [
  "Código",
  "Especie",
  "Propósito",
  "Sistema",
  "Raza",
  "Fecha de inicio",
  "Cantidad inicial",
  "Cantidad actual",
  "Peso promedio (kg)",
  "Peso objetivo (kg)",
  "Estado",
  "Lugar",
  "Costo total de producción",
  "Notas",
];

async function loadLotes(): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db.select().from(broilerBatches).orderBy(asc(broilerBatches.code)).limit(limit),
  );
  const locations = await locationNames();

  return {
    headers: LOTES_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.code,
      row.species,
      row.purpose,
      str(row.systemType),
      row.breed,
      row.startDate,
      row.initialQuantity,
      row.currentQuantity,
      num(row.avgWeightKg),
      num(row.targetWeightKg),
      row.status,
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      num(row.totalProductionCost),
      str(row.notes),
    ]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Alimento: inventario y movimientos
// ─────────────────────────────────────────────────────────────────────────────

const ALIMENTO_INVENTARIO_HEADERS = [
  "Alimento",
  "Código estándar (IG)",
  "Grupo catálogo",
  "Categoría",
  "Tipo",
  "Estado sanitario",
  "Unidad",
  "Stock actual",
  "Stock mínimo",
  "Costo por unidad",
  "Proveedor",
  "Materia seca (%)",
  "Proteína cruda (%)",
  "EM (kcal/kg MS)",
  "Calcio (% MS)",
  "Fósforo disp. (% MS)",
  "Lisina dig. (% MS)",
  "Met+Cys dig. (% MS)",
  "Fibra bruta (% MS)",
];

async function loadAlimentoInventario(): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db.select().from(feedInventory).orderBy(asc(feedInventory.name)).limit(limit),
  );

  return {
    headers: ALIMENTO_INVENTARIO_HEADERS,
    truncated,
    rows: rows.map((row) => {
      const std = findStandardFeedById(row.standardCatalogId);
      const group =
        std?.group ??
        normalizeFeedCatalogGroup(row.catalogGroup) ??
        inferFeedCatalogGroup(row.feedType, row.name, row.category);
      return [
        row.name,
        str(row.standardCatalogId),
        group,
        row.category,
        feedTypeLabel(row.feedType),
        str(row.sanitaryStatus ?? std?.sanitaryStatus),
        row.unit,
        num(row.currentStock),
        num(row.minStock),
        num(row.costPerUnit),
        str(row.supplier),
        num(row.dryMatterPct),
        num(row.crudeProteinPct),
        num(row.energyKcalKgDm),
        num(row.calciumDmPct),
        num(row.availablePhosphorusDmPct),
        num(row.lysineDigDmPct),
        num(row.metCysDigDmPct),
        num(row.crudeFiberDmPct),
      ];
    }),
  };
}

const ALIMENTO_MOVIMIENTOS_HEADERS = [
  "Fecha",
  "Alimento",
  "Unidad",
  "Movimiento",
  "Motivo",
  "Cantidad",
  "Costo unitario",
  "Costo total",
  "Lugar",
  "Especie",
  "Aves en el grupo",
  "Generado por programa",
  "Notas",
];

async function loadAlimentoMovimientos(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(feedMovements)
      .where(and(gte(feedMovements.date, range.from), lte(feedMovements.date, range.to)))
      .orderBy(desc(feedMovements.date))
      .limit(limit),
  );
  const [feeds, locations] = await Promise.all([feedNames(), locationNames()]);

  return {
    headers: ALIMENTO_MOVIMIENTOS_HEADERS,
    truncated,
    rows: rows.map((row) => {
      const feed = feeds.get(row.feedId);
      const quantity = num(row.quantity);
      const unitCost = num(row.unitCost);
      return [
        row.date,
        feed?.name ?? "",
        feed?.unit ?? "",
        row.isEntry ? "Entrada" : "Consumo",
        row.movementType,
        quantity,
        unitCost,
        quantity !== null && unitCost !== null ? quantity * unitCost : null,
        row.locationId ? locations.get(row.locationId) ?? "" : "",
        str(row.species),
        row.henCount ?? null,
        row.autoGenerated,
        str(row.notes),
      ];
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sanidad y mortalidad
// ─────────────────────────────────────────────────────────────────────────────

const SANIDAD_HEADERS = [
  "Fecha",
  "Especie",
  "Tipo",
  "Descripción",
  "Producto",
  "Costo",
  "Lugar",
  "Lote de vacuna",
  "Laboratorio",
  "Vencimiento",
  "Temperatura cadena de frío (°C)",
  "Vía de administración",
  "Días de retiro",
  "Fin de retiro",
  "Próximo evento",
  "Notas",
];

async function loadSanidad(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(healthControl)
      .where(and(gte(healthControl.date, range.from), lte(healthControl.date, range.to)))
      .orderBy(desc(healthControl.date))
      .limit(limit),
  );
  const locations = await locationNames();

  return {
    headers: SANIDAD_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.date,
      str(row.species),
      row.type,
      row.description,
      str(row.product),
      num(row.cost),
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      str(row.vaccineLot),
      str(row.vaccineLab),
      row.vaccineExpiryDate ?? "",
      num(row.coldChainTempC),
      str(row.administrationRoute),
      row.withdrawalDays,
      row.withdrawalUntilDate ?? "",
      row.nextScheduled ?? "",
      str(row.notes),
    ]),
  };
}

const MORTALIDAD_HEADERS = [
  "Fecha",
  "Especie",
  "Tipo de ave",
  "Cantidad",
  "Causa",
  "Lugar",
  "Descripción",
];

async function loadMortalidad(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(mortalityRecords)
      .where(and(gte(mortalityRecords.date, range.from), lte(mortalityRecords.date, range.to)))
      .orderBy(desc(mortalityRecords.date))
      .limit(limit),
  );
  const locations = await locationNames();

  return {
    headers: MORTALIDAD_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.date,
      row.species,
      row.birdType,
      row.quantity,
      row.cause,
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      str(row.description),
    ]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Finanzas
// ─────────────────────────────────────────────────────────────────────────────

const FINANZAS_HEADERS = [
  "Fecha",
  "Tipo",
  "Categoría",
  "Código catálogo (CST)",
  "Familia / centro",
  "Concepto estándar",
  "Tratamiento",
  "Driver",
  "Descripción",
  "Contraparte",
  "Monto",
  "Cantidad",
  "Precio unitario",
  "Unidad",
  "Presentación",
  "Especie",
  "Lugar",
  "Es crédito",
  "Notas",
];

async function loadFinanzas(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(transactions)
      .where(and(gte(transactions.date, range.from), lte(transactions.date, range.to)))
      .orderBy(desc(transactions.date))
      .limit(limit),
  );
  const locations = await locationNames();

  return {
    headers: FINANZAS_HEADERS,
    truncated,
    rows: rows.map((row) => {
      const resolved = row.type === "egreso"
        ? resolveExpenseClassification({
            type: row.type,
            category: row.category,
            expenseCatalogId: row.expenseCatalogId,
            expenseFamily: row.expenseFamily,
            expenseConcept: row.expenseConcept,
            expenseTreatment: row.expenseTreatment,
            expenseDriver: row.expenseDriver,
            description: row.description,
            sourceType: row.sourceType,
          })
        : null;
      return [
        row.date,
        row.type,
        row.category,
        row.expenseCatalogId ?? resolved?.expenseCatalogId ?? "",
        row.expenseFamily ?? resolved?.expenseFamily ?? "",
        row.expenseConcept ?? resolved?.expenseConcept ?? "",
        row.expenseTreatment ?? resolved?.expenseTreatment ?? "",
        row.expenseDriver ?? resolved?.expenseDriver ?? "",
        row.description,
        str(row.counterparty),
        num(row.amount),
        num(row.quantity),
        num(row.unitPrice),
        str(row.unit),
        str(row.presentation),
        str(row.species),
        row.locationId ? locations.get(row.locationId) ?? "" : "",
        row.isCredit,
        str(row.notes),
      ];
    }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pesajes
// ─────────────────────────────────────────────────────────────────────────────

const PESAJES_HEADERS = [
  "Fecha",
  "Especie",
  "Lote",
  "Lugar",
  "Grupo",
  "Raza",
  "Semana",
  "Peso promedio (kg)",
  "Tamaño de muestra",
  "CV (%)",
  "Uniformidad (%)",
  "Ganancia diaria (g)",
  "Notas",
];

async function loadPesajes(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(weightLogs)
      .where(and(gte(weightLogs.date, range.from), lte(weightLogs.date, range.to)))
      .orderBy(desc(weightLogs.date))
      .limit(limit),
  );
  const [locations, batches] = await Promise.all([locationNames(), batchCodes()]);

  return {
    headers: PESAJES_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.date,
      str(row.species),
      row.batchId ? batches.get(row.batchId) ?? "" : "",
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      str(row.henGroup),
      str(row.breed),
      row.weekNumber ?? null,
      num(row.avgWeightKg),
      row.sampleSize ?? null,
      num(row.cvPercent),
      num(row.uniformityPct),
      num(row.dailyGainG),
      str(row.notes),
    ]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Gallinaza
// ─────────────────────────────────────────────────────────────────────────────

const GALLINAZA_PRODUCCION_HEADERS = ["Fecha", "Kg producidos", "Fuente", "Notas"];

async function loadGallinazaProduccion(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(manureProduction)
      .where(
        and(gte(manureProduction.date, range.from), lte(manureProduction.date, range.to)),
      )
      .orderBy(desc(manureProduction.date))
      .limit(limit),
  );

  return {
    headers: GALLINAZA_PRODUCCION_HEADERS,
    truncated,
    rows: rows.map((row) => [row.date, num(row.kgProduced), row.source, str(row.notes)]),
  };
}

const GALLINAZA_VENTAS_HEADERS = [
  "Fecha",
  "Especie",
  "Lugar",
  "Kg",
  "Precio por kg",
  "Monto total",
  "Presentación",
  "Comprador",
  "Notas",
];

async function loadGallinazaVentas(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(manureSales)
      .where(and(gte(manureSales.date, range.from), lte(manureSales.date, range.to)))
      .orderBy(desc(manureSales.date))
      .limit(limit),
  );
  const locations = await locationNames();

  return {
    headers: GALLINAZA_VENTAS_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.date,
      str(row.species),
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      num(row.quantityKg),
      num(row.pricePerKg),
      num(row.totalAmount),
      str(row.presentation),
      str(row.buyer),
      str(row.notes),
    ]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Carne: sacrificio y ventas
// ─────────────────────────────────────────────────────────────────────────────

const SACRIFICIO_HEADERS = [
  "Fecha",
  "Especie",
  "Tipo de ave",
  "Cantidad",
  "Peso vivo (kg)",
  "Peso canal (kg)",
  "Rendimiento (%)",
  "Destino",
  "Cabezas autoconsumo",
  "Kg autoconsumo",
  "Cabezas excedente",
  "Kg excedente",
  "Precio por kg",
  "Monto total",
  "Lugar",
  "Notas",
];

async function loadSacrificio(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(slaughter)
      .where(and(gte(slaughter.date, range.from), lte(slaughter.date, range.to)))
      .orderBy(desc(slaughter.date))
      .limit(limit),
  );
  const locations = await locationNames();

  return {
    headers: SACRIFICIO_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.date,
      row.species,
      row.birdType,
      row.quantity,
      num(row.liveWeightKg),
      num(row.weightKg),
      num(row.carcassYieldPercent),
      row.destination,
      row.headsAutoconsumo,
      num(row.weightKgAutoconsumo),
      row.headsExcedente,
      num(row.weightKgExcedente),
      num(row.pricePerKg),
      num(row.totalAmount),
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      str(row.notes),
    ]),
  };
}

const VENTAS_CARNE_HEADERS = [
  "Fecha",
  "Especie",
  "Lugar",
  "Kg",
  "Precio por kg",
  "Monto total",
  "Presentación",
  "Comprador",
  "Notas",
];

async function loadVentasCarne(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(meatSales)
      .where(and(gte(meatSales.date, range.from), lte(meatSales.date, range.to)))
      .orderBy(desc(meatSales.date))
      .limit(limit),
  );
  const locations = await locationNames();

  return {
    headers: VENTAS_CARNE_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.date,
      row.species,
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      num(row.quantityKg),
      num(row.pricePerKg),
      num(row.totalAmount),
      str(row.presentation),
      str(row.buyer),
      str(row.notes),
    ]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensores y cierres diarios
// ─────────────────────────────────────────────────────────────────────────────

const SENSORES_HEADERS = [
  "Fecha y hora",
  "Dispositivo",
  "Métrica",
  "Valor",
  "Unidad",
  "ITH",
  "Alerta",
  "Lugar",
  "Lote",
];

async function loadSensores(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(sensorReadings)
      .where(
        and(
          gte(sensorReadings.recordedAt, new Date(`${range.from}T00:00:00.000Z`)),
          lte(sensorReadings.recordedAt, new Date(`${range.to}T23:59:59.999Z`)),
        ),
      )
      .orderBy(desc(sensorReadings.recordedAt))
      .limit(limit),
  );
  const [locations, batches] = await Promise.all([locationNames(), batchCodes()]);

  return {
    headers: SENSORES_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.recordedAt.toISOString(),
      row.deviceId,
      row.metricType,
      num(row.value),
      row.unit,
      num(row.ithIndex),
      row.alertTriggered,
      row.locationId ? locations.get(row.locationId) ?? "" : "",
      row.batchId ? batches.get(row.batchId) ?? "" : "",
    ]),
  };
}

const CIERRES_HEADERS = [
  "Fecha de cierre",
  "Estado",
  "Cerrado en",
  "Reabierto en",
  "Motivo de reapertura",
  "Notas",
];

async function loadCierres(range: ExportRange): Promise<ExportDatasetResult> {
  const { rows, truncated } = await loadCapped((limit) =>
    db
      .select()
      .from(dailyClosures)
      .where(
        and(
          gte(dailyClosures.closureDate, range.from),
          lte(dailyClosures.closureDate, range.to),
        ),
      )
      .orderBy(desc(dailyClosures.closureDate))
      .limit(limit),
  );

  return {
    headers: CIERRES_HEADERS,
    truncated,
    rows: rows.map((row) => [
      row.closureDate,
      row.status,
      row.closedAt.toISOString(),
      row.reopenedAt ? row.reopenedAt.toISOString() : "",
      str(row.reopenReason),
      str(row.notes),
    ]),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Catálogo público
// ─────────────────────────────────────────────────────────────────────────────

export const EXPORT_DATASETS: ExportDataset[] = [
  {
    id: "resumen-diario",
    label: "Resumen diario de operación",
    description:
      "Una fila por día: huevos, alimento, mortalidad, sanidad, ventas, ingresos, egresos y balance. Es la base recomendada para un dashboard.",
    category: "operacion",
    granularity: "diaria",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: RESUMEN_HEADERS,
    load: loadResumenDiario,
  },
  {
    id: "huevos",
    label: "Producción de huevos",
    description: "Recolecciones diarias con rotos, descartados, incubación, autoconsumo, excedente y tallas.",
    category: "produccion",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: HUEVOS_HEADERS,
    load: loadHuevos,
  },
  {
    id: "ventas-huevos",
    label: "Ventas de huevos",
    description: "Ventas con cantidad, talla, presentación, precio y comprador.",
    category: "finanzas",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: VENTAS_HUEVOS_HEADERS,
    load: loadVentasHuevos,
  },
  {
    id: "gallinas",
    label: "Gallinas",
    description: "Inventario de gallinas con raza, estado, peso, lugar y costo de adquisición.",
    category: "produccion",
    granularity: "estado actual",
    usesRange: false,
    formats: ["csv", "xlsx"],
    headers: GALLINAS_HEADERS,
    load: loadGallinas,
  },
  {
    id: "lotes",
    label: "Lotes de producción",
    description: "Lotes multiespecie con cantidades, peso, estado y costo de producción.",
    category: "produccion",
    granularity: "estado actual",
    usesRange: false,
    formats: ["csv", "xlsx"],
    headers: LOTES_HEADERS,
    load: loadLotes,
  },
  {
    id: "alimento-inventario",
    label: "Inventario de alimento",
    description: "Existencias actuales, mínimos, costos y calidad nutricional del alimento.",
    category: "inventario",
    granularity: "estado actual",
    usesRange: false,
    formats: ["csv", "xlsx"],
    headers: ALIMENTO_INVENTARIO_HEADERS,
    load: loadAlimentoInventario,
  },
  {
    id: "alimento-movimientos",
    label: "Movimientos de alimento",
    description: "Entradas y consumos con cantidad, costo, lugar y especie.",
    category: "inventario",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: ALIMENTO_MOVIMIENTOS_HEADERS,
    load: loadAlimentoMovimientos,
  },
  {
    id: "sanidad",
    label: "Sanidad",
    description: "Vacunación, tratamientos, inspecciones, lotes de vacuna y tiempos de retiro.",
    category: "sanidad",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: SANIDAD_HEADERS,
    load: loadSanidad,
  },
  {
    id: "mortalidad",
    label: "Mortalidad",
    description: "Bajas por fecha, especie, tipo de ave, causa y lugar.",
    category: "sanidad",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: MORTALIDAD_HEADERS,
    load: loadMortalidad,
  },
  {
    id: "finanzas",
    label: "Finanzas",
    description: "Libro de ingresos y egresos con categoría, contraparte y dimensiones analíticas.",
    category: "finanzas",
    granularity: "libro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: FINANZAS_HEADERS,
    load: loadFinanzas,
  },
  {
    id: "pesajes",
    label: "Pesajes y crecimiento",
    description: "Pesos promedio, uniformidad, CV y ganancia diaria por lote o grupo.",
    category: "produccion",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: PESAJES_HEADERS,
    load: loadPesajes,
  },
  {
    id: "gallinaza-produccion",
    label: "Producción de gallinaza",
    description: "Kg producidos por día y su fuente de cálculo.",
    category: "produccion",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: GALLINAZA_PRODUCCION_HEADERS,
    load: loadGallinazaProduccion,
  },
  {
    id: "gallinaza-ventas",
    label: "Ventas de gallinaza",
    description: "Kg vendidos, precio, monto, presentación y comprador.",
    category: "finanzas",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: GALLINAZA_VENTAS_HEADERS,
    load: loadGallinazaVentas,
  },
  {
    id: "sacrificio",
    label: "Sacrificio y faena",
    description: "Peso vivo, peso canal, rendimiento, destino y autoconsumo.",
    category: "produccion",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: SACRIFICIO_HEADERS,
    load: loadSacrificio,
  },
  {
    id: "ventas-carne",
    label: "Ventas de carne",
    description: "Kg vendidos, precio, monto, presentación y comprador.",
    category: "finanzas",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: VENTAS_CARNE_HEADERS,
    load: loadVentasCarne,
  },
  {
    id: "sensores",
    label: "Sensores IoT",
    description: "Lecturas de temperatura, humedad, ITH, amoníaco, báscula y consumo de agua.",
    category: "infraestructura",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: SENSORES_HEADERS,
    load: loadSensores,
  },
  {
    id: "cierres",
    label: "Cierres diarios",
    description: "Estado del cierre auditable, reaperturas y notas.",
    category: "operacion",
    granularity: "por registro",
    usesRange: true,
    formats: ["csv", "xlsx"],
    headers: CIERRES_HEADERS,
    load: loadCierres,
  },
];

/** Paquete multi-hoja analítico para XLSX; el respaldo completo se ofrece aparte. */
export const EXPORT_PACKAGE_ID = "paquete-operativo";
export const EXPORT_BACKUP_ID = "respaldo-completo";
export const EXPORT_TABLE_PREFIX = "tabla:";

export const EXPORT_PACKAGE_DATASETS: string[] = [
  "resumen-diario",
  "huevos",
  "ventas-huevos",
  "gallinas",
  "lotes",
  "alimento-inventario",
  "alimento-movimientos",
  "sanidad",
  "mortalidad",
  "finanzas",
  "pesajes",
  "gallinaza-produccion",
  "gallinaza-ventas",
  "sacrificio",
  "ventas-carne",
  "sensores",
  "cierres",
];

export function getExportDataset(id: string): ExportDataset | null {
  return EXPORT_DATASETS.find((dataset) => dataset.id === id) ?? null;
}

export function getExportRequiredScopes(datasetId: string): string[] {
  if (datasetId === EXPORT_BACKUP_ID) return ["read:backup"];
  if (datasetId.startsWith(EXPORT_TABLE_PREFIX)) return ["read:backup"];
  if (datasetId === EXPORT_PACKAGE_ID) {
    return Array.from(new Set(EXPORT_PACKAGE_DATASETS.flatMap((id) => getExportRequiredScopes(id))));
  }
  const dataset = getExportDataset(datasetId);
  if (!dataset) return [];
  if (dataset.id === "resumen-diario") return ["read:finance", "read:production"];
  if (dataset.id === "cierres") return ["read:production"];
  if (dataset.category === "finanzas") return ["read:finance"];
  if (dataset.category === "inventario") return ["read:inventory"];
  if (dataset.category === "operacion") return ["read:finance", "read:production"];
  return ["read:production"];
}

// ─────────────────────────────────────────────────────────────────────────────
// Rango de fechas
// ─────────────────────────────────────────────────────────────────────────────

export type ExportRangeResult =
  | { ok: true; range: ExportRange }
  | { ok: false; error: string };

function isoDaysAgo(days: number): string {
  const today = todayColombiaIso();
  const date = new Date(`${today}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function resolveExportRange(
  fromParam?: string | null,
  toParam?: string | null,
): ExportRangeResult {
  const to = (toParam || "").trim() || todayColombiaIso();
  const from = (fromParam || "").trim() || isoDaysAgo(EXPORT_DEFAULT_DAYS - 1);

  if (!isDateOnly(from) || !isDateOnly(to)) {
    return { ok: false, error: "Rango de fechas inválido. Usa el formato AAAA-MM-DD." };
  }
  if (from > to) {
    return { ok: false, error: "La fecha inicial no puede ser posterior a la fecha final." };
  }

  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  const days = Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000) + 1;
  if (days > EXPORT_MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: `El rango no puede superar ${EXPORT_MAX_RANGE_DAYS} días. Descarga por trimestres o años.`,
    };
  }

  return { ok: true, range: { from, to } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Carga de hojas listas para serializar
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportSheetData {
  id: string;
  label: string;
  headers: string[];
  rows: CellValue[][];
  truncated: boolean;
}

export async function loadExportDataset(
  id: string,
  range: ExportRange,
): Promise<ExportSheetData> {
  const dataset = getExportDataset(id);
  if (!dataset) {
    throw new Error(`Dataset de exportación desconocido: ${id}`);
  }
  const result = await dataset.load(range);
  return {
    id: dataset.id,
    label: dataset.label,
    headers: result.headers,
    rows: result.rows,
    truncated: result.truncated,
  };
}

export async function loadExportPackage(range: ExportRange): Promise<ExportSheetData[]> {
  const sheets: ExportSheetData[] = [];
  for (const id of EXPORT_PACKAGE_DATASETS) {
    sheets.push(await loadExportDataset(id, range));
  }
  return sheets;
}

const BACKUP_EXCLUDED_TABLES = [
  "billing_payments",
  "export_tokens",
  "farm_subscriptions",
  "offline_mutation_receipts",
  "sessions",
  "users",
] as const;

const BACKUP_EXCLUDED_FIELDS = [
  "users.password_hash",
  "users.recovery_code_hash",
  "users.recovery_code_issued_at",
  "sessions.token_hash",
  "export_tokens.token_hash",
] as const;

const BACKUP_PAGE_SIZE = 2_000;

type BackupTableScope = "farm" | "shared_reference";

interface BackupTableDefinition {
  name: string;
  scope: BackupTableScope;
  table: Parameters<typeof getTableColumns>[0];
  columns: string[];
  updatedSinceColumn: string | null;
}

const SHARED_REFERENCE_TABLES = [
  farmSchema.vaccinationTemplates,
  farmSchema.breedWeightStandards,
] as const;

function backupExportTableDefinitions(): BackupTableDefinition[] {
  const tables = Object.values(farmSchema).flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    try {
      const table = value as Parameters<typeof getTableColumns>[0];
      const columns = getTableColumns(table) as Record<string, unknown>;
      const name = getTableName(table);
      if (!columns.farmId || (BACKUP_EXCLUDED_TABLES as readonly string[]).includes(name)) {
        return [];
      }
      return [{ name, scope: "farm" as const, table, columns: Object.keys(columns) }];
    } catch {
      return [];
    }
  });
  const sharedTables = SHARED_REFERENCE_TABLES.map((table) => ({
    name: getTableName(table),
    scope: "shared_reference" as const,
    table,
    columns: Object.keys(getTableColumns(table)),
  }));
  return [...tables, ...sharedTables]
    .map((table) => ({
      ...table,
      updatedSinceColumn: table.columns.includes("updatedAt") ? "updatedAt" : null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getBackupExportTableCatalog() {
  return backupExportTableDefinitions().map(({ name, scope, columns, updatedSinceColumn }) => ({
    id: `${EXPORT_TABLE_PREFIX}${name}`,
    name,
    scope,
    columns,
    updatedSinceColumn,
  }));
}

function getBackupExportTable(datasetId: string): BackupTableDefinition | null {
  if (!datasetId.startsWith(EXPORT_TABLE_PREFIX)) return null;
  const tableName = datasetId.slice(EXPORT_TABLE_PREFIX.length);
  return backupExportTableDefinitions().find((table) => table.name === tableName) ?? null;
}

async function readAllTableRows(table: Parameters<typeof getTableColumns>[0]) {
  const rows: Record<string, unknown>[] = [];
  let offset = 0;
  const dynamicTable = table as unknown as Record<string, never>;
  while (true) {
    const page = await db
      .select()
      .from(table as never)
      .orderBy(asc(dynamicTable.id))
      .limit(BACKUP_PAGE_SIZE)
      .offset(offset);
    rows.push(...(page as Record<string, unknown>[]));
    if (page.length < BACKUP_PAGE_SIZE) break;
    offset += page.length;
  }
  return rows;
}

function redactSecretSettings(tableName: string, row: Record<string, unknown>) {
  if (tableName !== "app_settings" || typeof row.key !== "string") return row;
  if (!/(secret|token|password|credential|api[_-]?key|authorization)/i.test(row.key)) return row;
  return { ...row, value: "[REDACTED]" };
}

/**
 * Respaldo JSON de todas las tablas ligadas a farmId en el esquema actual.
 * Se excluyen secretos de autenticación, sesiones, tokens de conector,
 * registros técnicos de sincronización y facturación del servicio.
 */
export async function loadCompleteFarmBackup() {
  const farmId = getCurrentFarmId();
  const [farmRows, userRows] = await Promise.all([
    db
      .select({
        id: farmSchema.farms.id,
        slug: farmSchema.farms.slug,
        name: farmSchema.farms.name,
        deploymentMode: farmSchema.farms.deploymentMode,
        ownerUserId: farmSchema.farms.ownerUserId,
        qrSource: farmSchema.farms.qrSource,
        allyCode: farmSchema.farms.allyCode,
        planCode: farmSchema.farms.planCode,
        trialEndsAt: farmSchema.farms.trialEndsAt,
        createdAt: farmSchema.farms.createdAt,
        updatedAt: farmSchema.farms.updatedAt,
      })
      .from(farmSchema.farms)
      .where(eq(farmSchema.farms.id, farmId))
      .limit(1),
    db
      .select({
        id: farmSchema.users.id,
        username: farmSchema.users.username,
        name: farmSchema.users.name,
        role: farmSchema.users.role,
        createdAt: farmSchema.users.createdAt,
      })
      .from(farmSchema.users)
      .where(eq(farmSchema.users.farmId, farmId)),
  ]);

  const tableData: Record<string, {
    scope: "farm" | "shared_reference";
    columns: string[];
    recordCount: number;
    records: Record<string, unknown>[];
  }> = {};
  for (const table of backupExportTableDefinitions()) {
    const rawRows = await readAllTableRows(table.table);
    const records = rawRows.map((row) => redactSecretSettings(table.name, row));
    tableData[table.name] = {
      scope: table.scope,
      columns: table.columns,
      recordCount: records.length,
      records,
    };
  }

  return {
    object: "iwagranja_farm_backup",
    version: 1,
    generatedAt: new Date().toISOString(),
    farmId,
    farm: farmRows[0] ?? null,
    farmUsers: userRows,
    tables: tableData,
    includedTables: Object.entries(tableData).map(([name, data]) => ({
      name,
      scope: data.scope,
      recordCount: data.recordCount,
      columns: data.columns,
    })),
    excludedTables: [...BACKUP_EXCLUDED_TABLES],
    excludedFields: [...BACKUP_EXCLUDED_FIELDS],
    sanitizedUserFields: ["id", "username", "name", "role", "createdAt"],
    redactedSettingValues: "app_settings.value is replaced with [REDACTED] when the key suggests a secret or credential.",
  };
}

export async function loadBackupTableExport(
  datasetId: string,
  options: { limit: number; cursor: number; updatedSince?: string | null },
) {
  const tableDefinition = getBackupExportTable(datasetId);
  if (!tableDefinition) return null;
  if (options.updatedSince && !tableDefinition.updatedSinceColumn) {
    throw new Error(`La tabla ${tableDefinition.name} no tiene updatedAt para filtrar updated_since; recórrela por páginas.`);
  }

  const table = tableDefinition.table as unknown as Record<string, never>;
  let query = db.select().from(tableDefinition.table as never);
  if (options.updatedSince && tableDefinition.updatedSinceColumn) {
    query = query.where(gte(table[tableDefinition.updatedSinceColumn], options.updatedSince)) as typeof query;
  }
  const page = await query
    .orderBy(asc(table.id))
    .limit(options.limit + 1)
    .offset(options.cursor);
  const hasMore = page.length > options.limit;
  const records = (page.slice(0, options.limit) as Record<string, unknown>[])
    .map((row) => redactSecretSettings(tableDefinition.name, row));
  const nextCursor = hasMore ? String(options.cursor + records.length) : null;

  return {
    object: "export_records",
    version: 1,
    dataset: datasetId,
    table: tableDefinition.name,
    scope: tableDefinition.scope,
    farmId: getCurrentFarmId(),
    updatedSince: options.updatedSince ?? null,
    changeTrackingColumn: tableDefinition.updatedSinceColumn,
    count: records.length,
    limit: options.limit,
    cursor: String(options.cursor),
    nextCursor,
    hasMore,
    columns: tableDefinition.columns,
    records,
    syncedAt: new Date().toISOString(),
  };
}


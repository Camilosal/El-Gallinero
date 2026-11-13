import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import {
  animalSpeciesEnum, broilerBatches, catalogos, farmLocations, feedInventory,
  feedMovements, feedPrograms, transactions,
} from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { ANIMAL_SPECIES } from "@/lib/species";
import { getStageSpecies } from "@/lib/feeding/stage-species";
import { normalizeProgramEntries, recomputeStagePercentages, withDerivedPercentages } from "@/lib/feeding/program-validation";
import { summarizeRation, parseOptionalPercent } from "@/lib/feeding/ration";
import { resolveDimensions } from "@/lib/analytics-dimensions";
import { mockRequest, parseJson } from "./helpers";
import { DELETE as deleteCatalogo } from "@/app/api/configuracion/catalogos/route";
import { GET as costosAlimento } from "@/app/api/analisis/reportes/costos-alimento/route";
import { GET as rentabilidad } from "@/app/api/analisis/reportes/rentabilidad/route";

const suffix = Math.random().toString(36).slice(2, 8);
const created = {
  stages: [] as string[], feeds: [] as string[], locations: [] as string[],
  transactions: [] as string[], batches: [] as string[],
};

afterAll(async () => {
  if (created.stages.length) await db.delete(feedMovements).where(inArray(feedMovements.stageCatalogoId, created.stages));
  if (created.feeds.length) {
    await db.delete(feedMovements).where(inArray(feedMovements.feedId, created.feeds));
    await db.delete(feedPrograms).where(inArray(feedPrograms.feedId, created.feeds));
    await db.delete(feedInventory).where(inArray(feedInventory.id, created.feeds));
  }
  if (created.transactions.length) await db.delete(transactions).where(inArray(transactions.id, created.transactions));
  if (created.stages.length) await db.delete(catalogos).where(inArray(catalogos.id, created.stages));
  if (created.batches.length) await db.delete(broilerBatches).where(inArray(broilerBatches.id, created.batches));
  if (created.locations.length) await db.delete(farmLocations).where(inArray(farmLocations.id, created.locations));
});

async function createFeed(name: string, costPerUnit = "2.00", category: "Concentrado" | "En Fresco" = "Concentrado") {
  const [feed] = await db.insert(feedInventory).values({
    name: `${name} ${suffix}`, category, feedType: "Otro", unit: "kg", currentStock: "100", costPerUnit,
  }).returning();
  created.feeds.push(feed.id);
  return feed;
}

async function createStage(value: string, tipo: string) {
  const [stage] = await db.insert(catalogos).values({
    category: "etapa_crecimiento", value: `${value} ${suffix}`, tipo, minWeeks: 0, maxWeeks: null, sortOrder: 99,
  }).returning();
  created.stages.push(stage.id);
  return stage;
}

describe("especies: fuente única", () => {
  it("el enum de la base de datos coincide con ANIMAL_SPECIES e incluye cuy", () => {
    expect([...animalSpeciesEnum.enumValues]).toEqual([...ANIMAL_SPECIES]);
    expect(ANIMAL_SPECIES).toContain("cuy");
  });

  it("getStageSpecies reconoce cuy por tipo y por nombre", () => {
    expect(getStageSpecies({ tipo: "cuy" })).toBe("cuy");
    expect(getStageSpecies({ value: "Cuyes engorde" })).toBe("cuy");
    expect(getStageSpecies({ value: "Cobayos levante" })).toBe("cuy");
    expect(getStageSpecies({ value: "Juvenil" })).toBe("gallina");
  });
});

describe("programas de dieta combinada", () => {
  it("deriva el porcentaje de los gramos y suma exactamente 100", () => {
    const result = normalizeProgramEntries([
      { feedId: "a", dailyAmountPerHen: "24", percentage: "5" },
      { feedId: "b", dailyAmountPerHen: "15" },
      { feedId: "c", dailyAmountPerHen: "12" },
      { feedId: "d", dailyAmountPerHen: "9" },
    ]);
    if ("error" in result) throw new Error(result.error);
    expect(result.entries.map((e) => e.percentage)).toEqual(["40.00", "25.00", "20.00", "15.00"]);
  });

  it("reparte el residuo de redondeo para que siempre sume 100", () => {
    const entries = withDerivedPercentages([
      { feedId: "a", grams: 10 }, { feedId: "b", grams: 10 }, { feedId: "c", grams: 10 },
    ]);
    const total = entries.reduce((sum, e) => sum + Number(e.percentage), 0);
    expect(Math.round(total * 100) / 100).toBe(100);
  });

  it("rechaza vacío, duplicados y dosis no positivas", () => {
    expect("error" in normalizeProgramEntries([])).toBe(true);
    expect("error" in normalizeProgramEntries([{ feedId: "a", dailyAmountPerHen: "10" }, { feedId: "a", dailyAmountPerHen: "5" }])).toBe(true);
    expect("error" in normalizeProgramEntries([{ feedId: "a", dailyAmountPerHen: "0" }])).toBe(true);
    expect("error" in normalizeProgramEntries([{ feedId: "", dailyAmountPerHen: "5" }])).toBe(true);
  });

  it("recomputeStagePercentages corrige porcentajes inconsistentes en la base", async () => {
    const stage = await createStage("Cuy levante", "cuy");
    const concentrate = await createFeed("Concentrado cuy");
    const forage = await createFeed("Forraje cuy", "0.30", "En Fresco");
    await db.insert(feedPrograms).values([
      { stageCatalogoId: stage.id, feedId: concentrate.id, percentage: "0", dailyAmountPerHen: "60" },
      { stageCatalogoId: stage.id, feedId: forage.id, percentage: "0", dailyAmountPerHen: "40" },
    ]);
    await recomputeStagePercentages(db, stage.id);
    const rows = await db.select().from(feedPrograms).where(eq(feedPrograms.stageCatalogoId, stage.id));
    const byFeed = Object.fromEntries(rows.map((r) => [r.feedId, Number(r.percentage)]));
    expect(byFeed[concentrate.id]).toBe(60);
    expect(byFeed[forage.id]).toBe(40);
  });
});

describe("composición de la ración", () => {
  it("resume materia seca, proteína y proporción de forraje fresco", () => {
    const summary = summarizeRation([
      { grams: 60, dryMatterPct: 90, crudeProteinPct: 16, category: "Concentrado" },
      { grams: 40, dryMatterPct: 25, crudeProteinPct: 3, category: "En Fresco" },
    ]);
    expect(summary.totalGrams).toBe(100);
    expect(summary.dryMatterGrams).toBe(64);
    expect(summary.dryMatterComplete).toBe(true);
    expect(summary.crudeProteinPctAsFed).toBe(10.8);
    expect(summary.freshSharePct).toBe(40);
  });

  it("marca la composición como incompleta cuando falta un dato", () => {
    const summary = summarizeRation([
      { grams: 60, dryMatterPct: 90, crudeProteinPct: 16, category: "Concentrado" },
      { grams: 40, dryMatterPct: null, crudeProteinPct: null, category: "En Fresco" },
    ]);
    expect(summary.dryMatterComplete).toBe(false);
    expect(summary.crudeProteinPctAsFed).toBeNull();
  });

  it("valida porcentajes opcionales", () => {
    expect(parseOptionalPercent("", "x")).toEqual({ value: null });
    expect(parseOptionalPercent("25.5", "x")).toEqual({ value: "25.50" });
    expect("error" in parseOptionalPercent("101", "x")).toBe(true);
    expect("error" in parseOptionalPercent("0", "x", { positive: true })).toBe(true);
  });
});

describe("catálogo de etapas", () => {
  it("desactiva una etapa con consumos y elimina una sin historial", async () => {
    const withHistory = await createStage("Etapa con historial", "cuy");
    const empty = await createStage("Etapa vacía", "cuy");
    const feed = await createFeed("Alimento historial");
    await db.insert(feedMovements).values({
      feedId: feed.id, quantity: "1.00", isEntry: false, movementType: "consumo_programa", autoGenerated: true,
      stageCatalogoId: withHistory.id, henCount: 1, date: "2026-02-01",
    });

    const res1 = await deleteCatalogo(mockRequest(`http://localhost/api/configuracion/catalogos?id=${withHistory.id}`, { method: "DELETE" }), undefined as never);
    expect((await parseJson(res1)).deactivated).toBe(true);
    const [kept] = await db.select().from(catalogos).where(eq(catalogos.id, withHistory.id));
    expect(kept.isActive).toBe(false);

    const res2 = await deleteCatalogo(mockRequest(`http://localhost/api/configuracion/catalogos?id=${empty.id}`, { method: "DELETE" }), undefined as never);
    expect((await parseJson(res2)).deactivated).toBe(false);
    expect(await db.select().from(catalogos).where(eq(catalogos.id, empty.id))).toHaveLength(0);
  });
});

describe("contabilidad analítica por especie y lugar", () => {
  it("costos-alimento agrupa por especie y lugar con el costo congelado del movimiento", async () => {
    const [location] = await db.insert(farmLocations).values({ code: `T-${suffix}`, name: `Cuyera ${suffix}`, type: "jaula" }).returning();
    created.locations.push(location.id);
    const stage = await createStage("Cuy engorde", "cuy");
    const feed = await createFeed("Concentrado cuy 2", "2.00");
    await db.insert(feedMovements).values({
      feedId: feed.id, quantity: "10.00", isEntry: false, movementType: "consumo_programa", autoGenerated: true,
      stageCatalogoId: stage.id, henCount: 5, species: "cuy", unitCost: "3.00", locationId: location.id, date: "2026-03-10",
    });

    const res = await costosAlimento(mockRequest(`http://localhost/api/analisis/reportes/costos-alimento?from=2026-03-01&to=2026-03-31&species=cuy&locationId=${location.id}`), undefined as never);
    const data = await parseJson(res);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({ species: "cuy", locationId: location.id, kg: 10, cost: 30, animalDays: 5, costPerAnimalDay: 6 });
    expect(data.totalCost).toBe(30);
    expect(data.bySpecies[0]).toMatchObject({ key: "cuy", cost: 30 });
  });

  it("costos-alimento rechaza rangos y especies inválidos", async () => {
    const bad = await costosAlimento(mockRequest("http://localhost/api/analisis/reportes/costos-alimento?from=2026-05-01&to=2026-01-01"), undefined as never);
    expect(bad.status).toBe(400);
    const badSpecies = await costosAlimento(mockRequest("http://localhost/api/analisis/reportes/costos-alimento?species=dragon"), undefined as never);
    expect(badSpecies.status).toBe(400);
  });

  it("rentabilidad separa por especie y agrupa lo no asignado", async () => {
    const [location] = await db.insert(farmLocations).values({ code: `R-${suffix}`, name: `Conejera ${suffix}`, type: "jaula" }).returning();
    created.locations.push(location.id);
    const rows = await db.insert(transactions).values([
      { date: "2025-07-05", type: "ingreso", category: "Venta de carne", description: "t1", amount: "100.00", species: "conejo", locationId: location.id },
      { date: "2025-07-06", type: "egreso", category: "Compra de alimento", description: "t2", amount: "40.00", species: "conejo", locationId: location.id },
      { date: "2025-07-07", type: "ingreso", category: "Venta de huevos", description: "t3", amount: "10.00" },
    ]).returning();
    created.transactions.push(...rows.map((r) => r.id));

    const filtered = await parseJson(await rentabilidad(mockRequest(`http://localhost/api/analisis/reportes/rentabilidad?from=2025-07-01&to=2025-07-31&species=conejo`), undefined as never));
    expect(filtered.totalRevenue).toBe(100);
    expect(filtered.totalCost).toBe(40);
    expect(filtered.totalProfit).toBe(60);
    expect(filtered.bySpecies).toHaveLength(1);
    expect(filtered.productLines.find((l: { line: string }) => l.line === "alimento").cost).toBe(40);

    const all = await parseJson(await rentabilidad(mockRequest(`http://localhost/api/analisis/reportes/rentabilidad?from=2025-07-01&to=2025-07-31`), undefined as never));
    expect(all.totalRevenue).toBe(110);
    const keys = all.bySpecies.map((l: { key: string }) => l.key).sort();
    expect(keys).toEqual(["conejo", "sin_asignar"]);
    const place = all.byLocation.find((l: { key: string }) => l.key === location.id);
    expect(place).toMatchObject({ label: `Conejera ${suffix}`, revenue: 100, cost: 40, profit: 60, marginPct: 60 });
  });

  it("resolveDimensions deriva especie y lugar desde el lote", async () => {
    const [location] = await db.insert(farmLocations).values({ code: `B-${suffix}`, name: `Galpon ${suffix}`, type: "galpon" }).returning();
    created.locations.push(location.id);
    const [batch] = await db.insert(broilerBatches).values({
      code: `LOTE-${suffix}`, species: "cuy", breed: "Peruano", startDate: "2026-01-01",
      initialQuantity: 10, currentQuantity: 10, locationId: location.id,
    }).returning();
    created.batches.push(batch.id);

    const ok = await resolveDimensions(db, { batchId: batch.id });
    expect(ok).toEqual({ dimensions: { species: "cuy", locationId: location.id, batchId: batch.id } });
    expect("error" in (await resolveDimensions(db, { species: "dragon" }))).toBe(true);
    expect("error" in (await resolveDimensions(db, { locationId: "no-es-uuid" }))).toBe(true);
    expect(await resolveDimensions(db, {})).toEqual({ dimensions: { species: null, locationId: null, batchId: null } });
  });
});


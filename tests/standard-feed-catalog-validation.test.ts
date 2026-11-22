import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, pool } from "@/db";
import { runPendingMigrations } from "@/db/migrate-prod";
import { catalogos, feedInventory, feedMovements, feedPrograms } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import {
  STANDARD_FEED_CATALOG,
  findStandardFeedById,
  resolveEffectiveFeedProfile,
  searchStandardFeedCatalog,
} from "@/lib/feeding/standard-feed-catalog";
import {
  suggestSafeSubstitutesForStandardId,
  validateFeedingProgram,
} from "@/lib/feeding/nutrition-validator";
import { POST as feedPost, GET as feedGet } from "@/app/api/produccion/alimentacion/route";
import { POST as alinearCatalogoPost } from "@/app/api/produccion/alimentacion/alinear-catalogo/route";
import { GET as stdCatalogGet } from "@/app/api/produccion/alimentacion/catalogo-estandar/route";
import { GET as etapasGet, POST as etapasPost } from "@/app/api/produccion/etapas/route";
import { POST as programaPost } from "@/app/api/produccion/etapas/[id]/programa/route";
import { POST as configProgramPost } from "@/app/api/configuracion/programas-alimentacion/route";
import { inferLegacyFeedAlignment } from "@/lib/feeding/catalog-alignment";
import {
  STARTER_FEED_DEFINITIONS,
  STARTER_STAGE_PROGRAMS,
} from "@/lib/feeding/default-tenant-seed";

describe("Catálogo estandarizado de alimentos y validación nutricional de dietas", () => {
  const createdFeedIds: string[] = [];
  const createdStageIds: string[] = [];

  beforeAll(async () => {
    await runPendingMigrations(pool);
  });

  afterAll(async () => {
    if (createdStageIds.length > 0) {
      await db.delete(feedPrograms).where(inArray(feedPrograms.stageCatalogoId, createdStageIds));
      await db.delete(catalogos).where(inArray(catalogos.id, createdStageIds));
    }
    if (createdFeedIds.length > 0) {
      await db.delete(feedMovements).where(inArray(feedMovements.feedId, createdFeedIds));
      await db.delete(feedInventory).where(inArray(feedInventory.id, createdFeedIds));
    }
  });

  it("sincroniza los 119 ingredientes de docs/Catalogos/Catalogo Alimentos.csv", () => {
    const csvPath = path.join(process.cwd(), "docs/Catalogos/Catalogo Alimentos.csv");
    const rawLines = fs.readFileSync(csvPath).toString("latin1").trim().split(/\r?\n/);
    expect(rawLines.length - 1).toBe(119);
    expect(STANDARD_FEED_CATALOG).toHaveLength(119);

    const maize = findStandardFeedById("IG-015");
    expect(maize).toMatchObject({
      id: "IG-015",
      name: "Maíz amarillo seco en grano",
      sanitaryStatus: "CONDICIONAL",
      dryMatterPct: 86.3,
      crudeProteinDmPct: 8.8,
      energyKcalKgDm: 3660,
      calciumDmPct: 0.05,
      availablePhosphorusDmPct: 0.07,
      crudeFiberDmPct: 2.6,
      isBlocked: false,
    });
    expect(maize?.crudeProteinAsFedPct).toBeCloseTo(7.59, 2);

    const blocked = searchStandardFeedCatalog("", { sanitaryStatus: "NO USAR" });
    expect(blocked.length).toBeGreaterThanOrEqual(8);
    expect(blocked.some((item) => item.id === "IG-027")).toBe(true); // Soya cruda
    expect(blocked.some((item) => item.id === "IG-106")).toBe(true); // Aguacate
  });

  it("permite consultar el endpoint /api/produccion/alimentacion/catalogo-estandar con filtros", async () => {
    const res = await stdCatalogGet(
      new NextRequest("http://localhost:3000/api/produccion/alimentacion/catalogo-estandar?q=soya"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBeGreaterThanOrEqual(3);
    expect(body.items.some((i: { id: string }) => i.id === "IG-025")).toBe(true);
  });

  it("precarga ficha estandarizada al crear alimento y bloquea ingredientes NO USAR", async () => {
    const blockedRes = await feedPost(
      new NextRequest("http://localhost:3000/api/produccion/alimentacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standardCatalogId: "IG-106", currentStock: "0" }),
      }),
    );
    expect(blockedRes.status).toBe(400);
    const blockedPayload = await blockedRes.json();
    expect(blockedPayload.error).toContain("NO USAR");

    const okRes = await feedPost(
      new NextRequest("http://localhost:3000/api/produccion/alimentacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standardCatalogId: "IG-015",
          name: "Maíz Amarillo Base Test",
          currentStock: "25",
          unit: "kg",
        }),
      }),
    );
    expect(okRes.status).toBe(201);
    const createdMaize = await okRes.json();
    createdFeedIds.push(createdMaize.id);

    expect(createdMaize.standardCatalogId).toBe("IG-015");
    expect(createdMaize.sanitaryStatus).toBe("CONDICIONAL");
    expect(Number(createdMaize.dryMatterPct)).toBeCloseTo(86.3, 2);
    expect(Number(createdMaize.energyKcalKgDm)).toBeCloseTo(3660, 0);

    const soyaRes = await feedPost(
      new NextRequest("http://localhost:3000/api/produccion/alimentacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standardCatalogId: "IG-025",
          name: "Harina de Soya 48% Test",
          currentStock: "15",
          unit: "kg",
        }),
      }),
    );
    expect(soyaRes.status).toBe(201);
    const createdSoya = await soyaRes.json();
    createdFeedIds.push(createdSoya.id);

    // Concentrado IG-001 trae ETIQUETA PENDIENTE pero el productor completa la etiqueta real
    const concRes = await feedPost(
      new NextRequest("http://localhost:3000/api/produccion/alimentacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standardCatalogId: "IG-001",
          name: "Concentrado Postura Etiqueta Real Test",
          dryMatterPct: "89",
          crudeProteinPct: "17.5",
          energyKcalKgDm: "2980",
          calciumDmPct: "4.10",
          availablePhosphorusDmPct: "0.45",
          crudeFiberDmPct: "4.20",
          currentStock: "40",
          unit: "kg",
        }),
      }),
    );
    expect(concRes.status).toBe(201);
    const createdConc = await concRes.json();
    createdFeedIds.push(createdConc.id);

    const invRes = await feedGet(new NextRequest("http://localhost:3000/api/produccion/alimentacion"));
    expect(invRes.status).toBe(200);
    const invItems = await invRes.json();
    expect(invItems.some((item: { id: string; standardCatalogId?: string }) => item.id === createdMaize.id && item.standardCatalogId === "IG-015")).toBe(true);

    // Crear etapa y validar cumplimiento nutricional real en GET /api/produccion/etapas
    const stageRes = await etapasPost(
      new NextRequest("http://localhost:3000/api/produccion/etapas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          species: "gallina",
          value: "Postura Validada Test",
          minWeeks: 20,
          maxWeeks: null,
          programs: [{ feedId: createdConc.id, dailyAmountPerHen: "115" }],
        }),
      }),
    );
    expect(stageRes.status).toBe(201);
    const createdStage = await stageRes.json();
    createdStageIds.push(createdStage.id);

    const listRes = await etapasGet(new NextRequest("http://localhost:3000/api/produccion/etapas"));
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    const matchedStage = listBody.find((s: { id: string }) => s.id === createdStage.id);
    expect(matchedStage?.nutritionValidation?.status).toBe("cumple");
    expect(matchedStage?.nutritionValidation?.summary?.calciumPctDm).toBeCloseTo(4.1, 2);

    // Si cambiamos el programa a solo Maíz (IG-015), detecta déficit severo de proteína y calcio en postura
    const updateProgRes = await programaPost(
      new NextRequest(`http://localhost:3000/api/produccion/etapas/${createdStage.id}/programa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [{ feedId: createdMaize.id, dailyAmountPerHen: "115" }] }),
      }),
      { params: Promise.resolve({ id: createdStage.id }) },
    );
    expect(updateProgRes.status).toBe(201);

    const listAfterRes = await etapasGet(new NextRequest("http://localhost:3000/api/produccion/etapas"));
    const listAfter = await listAfterRes.json();
    const updatedStage = listAfter.find((s: { id: string }) => s.id === createdStage.id);
    expect(updatedStage?.nutritionValidation?.status).toBe("rechazado");
    expect(
      updatedStage?.nutritionValidation?.checks?.some(
        (c: { metric: string; status: string }) => c.metric === "calcium_dm" && c.status === "error",
      ),
    ).toBe(true);
    expect(
      updatedStage?.nutritionValidation?.recommendations?.some(
        (r: { id: string; candidates: Array<{ name: string }> }) =>
          r.id === "add-calcium" && r.candidates.length > 0,
      ),
    ).toBe(true);
    expect(
      updatedStage?.nutritionValidation?.recommendations?.some(
        (r: { id: string; candidates: Array<{ feedId?: string }> }) =>
          r.id === "add-protein" &&
          r.candidates.some((cand) => cand.feedId === createdSoya.id),
      ),
    ).toBe(true);

    // Si existe un feed con estado NO USAR en DB (p.ej. importado manualmente), también bloquea programas
    const [legacyBlocked] = await db
      .insert(feedInventory)
      .values({
        name: "Soya cruda bloqueada test",
        category: "Preparados",
        feedType: "Otro",
        unit: "kg",
        standardCatalogId: "IG-027",
        sanitaryStatus: "NO USAR",
      })
      .returning();
    createdFeedIds.push(legacyBlocked.id);

    const blockedProgRes = await programaPost(
      new NextRequest(`http://localhost:3000/api/produccion/etapas/${createdStage.id}/programa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [{ feedId: legacyBlocked.id, dailyAmountPerHen: "100" }] }),
      }),
      { params: Promise.resolve({ id: createdStage.id }) },
    );
    expect(blockedProgRes.status).toBe(400);

    const blockedConfigProg = await configProgramPost(
      new NextRequest("http://localhost:3000/api/configuracion/programas-alimentacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stageCatalogoId: createdStage.id,
          feedId: legacyBlocked.id,
          percentage: "100",
          dailyAmountPerHen: "100",
        }),
      }),
    );
    expect(blockedConfigProg.status).toBe(400);
  });

  it("evalúa dietas de conejos/cuyes por fibra mínima y reporta datos faltantes en concentrados sin etiqueta", () => {
    const stdConc = findStandardFeedById("IG-001")!;
    const resolvedIncomplete = resolveEffectiveFeedProfile({ standardCatalogId: stdConc.id });
    const incompleteValidation = validateFeedingProgram({
      species: "gallina",
      stageName: "Postura",
      minWeeks: 20,
      lines: [
        {
          grams: 115,
          dryMatterPct: resolvedIncomplete.dryMatterPct,
          crudeProteinPct: resolvedIncomplete.crudeProteinAsFedPct,
          category: "Concentrado",
          energyKcalKgDm: resolvedIncomplete.energyKcalKgDm,
          calciumDmPct: resolvedIncomplete.calciumDmPct,
          availablePhosphorusDmPct: resolvedIncomplete.availablePhosphorusDmPct,
          sanitaryStatus: resolvedIncomplete.sanitaryStatus,
          standardCatalogId: resolvedIncomplete.standardCatalogId,
          feedName: stdConc.name,
        },
      ],
    });
    expect(incompleteValidation.status).toBe("advertencia");
    expect(incompleteValidation.missingNutrients.length).toBeGreaterThanOrEqual(4);

    // Conejo con fibra demasiado baja (2.6% MS) dispara advertencia de fibra mínima
    const lowFiberRabbit = validateFeedingProgram({
      species: "conejo",
      stageName: "Conejo Engorde",
      minWeeks: 10,
      lines: [
        {
          grams: 140,
          dryMatterPct: 86.3,
          crudeProteinPct: 14.5,
          category: "Preparados",
          energyKcalKgDm: 2700,
          calciumDmPct: 0.9,
          availablePhosphorusDmPct: 0.45,
          crudeFiberDmPct: 4.0,
          sanitaryStatus: "CONDICIONAL",
          feedName: "Mezcla sin forraje",
        },
      ],
    });
    expect(lowFiberRabbit.status).toBe("advertencia");
    expect(lowFiberRabbit.checks.find((c) => c.metric === "fiber_dm")?.status).toBe("warning");
    expect(lowFiberRabbit.recommendations.some((r) => r.id === "adjust-fiber" && r.candidates.length > 0)).toBe(true);

    // Sustitutos seguros cuando se selecciona ingrediente NO USAR (ej: soya cruda o aguacate)
    const soySubs = suggestSafeSubstitutesForStandardId("IG-027");
    expect(soySubs.some((s) => s.standardCatalogId === "IG-025")).toBe(true);
    const avocadoSubs = suggestSafeSubstitutesForStandardId("IG-106");
    expect(avocadoSubs.some((s) => s.standardCatalogId === "IG-082")).toBe(true);

    // Condición obligatoria al formular con ingrediente RESTRINGIDO (ej: IG-067 Leucaena)
    const restrictedDiet = validateFeedingProgram({
      species: "conejo",
      stageName: "Conejo Engorde",
      minWeeks: 10,
      lines: [
        {
          grams: 140,
          dryMatterPct: 29.9,
          crudeProteinPct: 6.97,
          category: "En Fresco",
          energyKcalKgDm: 2600,
          calciumDmPct: 1.0,
          availablePhosphorusDmPct: 0.45,
          crudeFiberDmPct: 15.0,
          sanitaryStatus: "RESTRINGIDO",
          standardCatalogId: "IG-067",
          feedName: "Leucaena follaje fresco",
        },
      ],
    });
    expect(
      restrictedDiet.recommendations.some(
        (r) => r.category === "condition" && r.detail.toLowerCase().includes("mimosina"),
      ),
    ).toBe(true);
  });

  it("valida que todas las dietas base multi-especie (STARTER_STAGE_PROGRAMS) cumplen sus metas", () => {
    const defsByKey = new Map(STARTER_FEED_DEFINITIONS.map((d) => [d.key, d]));
    const availableFeeds = STARTER_FEED_DEFINITIONS.map((d) => ({
      id: d.key,
      name: d.name,
      category: d.category,
      feedType: d.feedType,
      standardCatalogId: d.standardCatalogId ?? null,
      sanitaryStatus: d.sanitaryStatus ?? "CONDICIONAL",
      dryMatterPct: d.dryMatterPct,
      crudeProteinPct: d.crudeProteinPct,
      energyKcalKgDm: d.energyKcalKgDm ?? null,
      calciumDmPct: d.calciumDmPct ?? null,
      availablePhosphorusDmPct: d.availablePhosphorusDmPct ?? null,
      crudeFiberDmPct: d.crudeFiberDmPct ?? null,
      stockKg: 100,
    }));

    expect(STARTER_STAGE_PROGRAMS.length).toBeGreaterThanOrEqual(14);
    for (const program of STARTER_STAGE_PROGRAMS) {
      const result = validateFeedingProgram({
        species: program.species,
        stageName: program.value,
        minWeeks: program.minWeeks,
        maxWeeks: program.maxWeeks,
        availableFeeds,
        lines: program.items.map((item) => {
          const def = defsByKey.get(item.feedKey)!;
          return {
            feedName: def.name,
            category: def.category,
            grams: item.gramsPerDay,
            standardCatalogId: def.standardCatalogId ?? null,
            sanitaryStatus: def.sanitaryStatus ?? "CONDICIONAL",
            dryMatterPct: Number(def.dryMatterPct),
            crudeProteinPct: Number(def.crudeProteinPct),
            energyKcalKgDm: def.energyKcalKgDm ? Number(def.energyKcalKgDm) : null,
            calciumDmPct: def.calciumDmPct ? Number(def.calciumDmPct) : null,
            availablePhosphorusDmPct: def.availablePhosphorusDmPct ? Number(def.availablePhosphorusDmPct) : null,
            crudeFiberDmPct: def.crudeFiberDmPct ? Number(def.crudeFiberDmPct) : null,
          };
        }),
      });
      expect(result.status, `Etapa fallida: ${program.species} / ${program.value}`).toBe("cumple");
    }
  });

  it("infiere y alinea alimentos legados sin sobrescribir existencias, costos ni datos manuales", async () => {
    expect(inferLegacyFeedAlignment("Bore", "bore_raices")?.standardCatalogId).toBe("IG-042");
    expect(inferLegacyFeedAlignment("Mosca Soldado Larva", "mosca_soldado")?.standardCatalogId).toBe("IG-007");
    expect(inferLegacyFeedAlignment("Carbonato de calcio finca", "Otro")?.standardCatalogId).toBe("IG-115");

    const beforeInvRes = await feedGet(new NextRequest("http://localhost:3000/api/produccion/alimentacion"));
    const beforeIds = new Set<string>((await beforeInvRes.json()).map((r: { id: string }) => r.id));

    const [legacyRow] = await db
      .insert(feedInventory)
      .values({
        name: "Maíz Amarillo Legado Finca Test",
        category: "suplementario",
        feedType: "maiz_comprado",
        unit: "kg",
        currentStock: "82.50",
        minStock: "10.00",
        costPerUnit: "2450.00",
        supplier: "Proveedor Histórico",
        crudeProteinPct: "8.10",
      })
      .returning();
    createdFeedIds.push(legacyRow.id);

    const alignRes = await alinearCatalogoPost(
      new NextRequest("http://localhost:3000/api/produccion/alimentacion/alinear-catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedStarterCalciumAndRoot: true }),
      }),
    );
    expect(alignRes.status).toBe(200);
    const alignBody = await alignRes.json();
    expect(alignBody.ok).toBe(true);
    expect(alignBody.updatedFeeds).toBeGreaterThanOrEqual(1);
    expect(alignBody.alignedStandardIds).toContain("IG-015");

    // Registrar cualquier alimento sembrado nuevo para limpieza en afterAll
    const afterInvRes = await feedGet(new NextRequest("http://localhost:3000/api/produccion/alimentacion"));
    const afterRows: Array<{ id: string }> = await afterInvRes.json();
    for (const r of afterRows) {
      if (!beforeIds.has(r.id) && !createdFeedIds.includes(r.id)) {
        createdFeedIds.push(r.id);
      }
    }

    const [reloaded] = await db
      .select()
      .from(feedInventory)
      .where(eq(feedInventory.id, legacyRow.id));

    expect(reloaded.category).toBe("Concentrado");
    expect(reloaded.feedType).toBe("Maiz en Grano");
    expect(reloaded.standardCatalogId).toBe("IG-015");
    expect(reloaded.sanitaryStatus).toBe("CONDICIONAL");
    expect(reloaded.energyKcalKgDm).toBe("3660.00");
    // No altera existencias, costo, proveedor ni proteína personalizada
    expect(reloaded.currentStock).toBe("82.50");
    expect(reloaded.costPerUnit).toBe("2450.00");
    expect(reloaded.supplier).toBe("Proveedor Histórico");
    expect(reloaded.crudeProteinPct).toBe("8.10");

    // Segunda ejecución debe ser idempotente (sin duplicados ni cambios sobre fila ya alineada)
    const secondRes = await alinearCatalogoPost(
      new NextRequest("http://localhost:3000/api/produccion/alimentacion/alinear-catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seedStarterCalciumAndRoot: true }),
      }),
    );
    expect(secondRes.status).toBe(200);
    const secondBody = await secondRes.json();
    expect(secondBody.seededMissingStandards).toBe(0);
  });
});

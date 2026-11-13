import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import {
  animalLocationMovements,
  appSettings,
  birdAcquisitions,
  broilerBatches,
  farmLocations,
  farms,
  feedInventory,
  feedMovements,
  flockPlanMilestones,
  flockPlans,
  hens,
  sanitaryCalendar,
} from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import * as authMod from "@/lib/auth";
import { HY_LINE_BROWN_HEN } from "@/lib/breed-standards";
import { getStandardCurve, interpolateStandard } from "@/lib/standard-curves";
import { MASTER_SPECIES_BIOLOGY } from "@/lib/species-params";
import { buildInitialBiologicalPlan } from "@/lib/biological-preload";
import { executeDay1Setup } from "@/lib/onboarding-server";

describe("Day 1 Biological Preload & Hy-Line Brown Standards (6 Species)", () => {
  const createdFarmIds: string[] = [];

  afterEach(async () => {
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "test-user",
      username: "test",
      name: "Test User",
      role: "admin",
      farmId: "00000000-0000-0000-0000-000000000001",
    });

    for (const farmId of createdFarmIds) {
      await db.delete(flockPlanMilestones).where(eq(flockPlanMilestones.farmId, farmId));
      await db.delete(flockPlans).where(eq(flockPlans.farmId, farmId));
      await db.delete(sanitaryCalendar).where(eq(sanitaryCalendar.farmId, farmId));
      await db.delete(feedMovements).where(eq(feedMovements.farmId, farmId));
      await db.delete(feedInventory).where(eq(feedInventory.farmId, farmId));
      await db.delete(animalLocationMovements).where(eq(animalLocationMovements.farmId, farmId));
      await db.delete(hens).where(eq(hens.farmId, farmId));
      await db.delete(broilerBatches).where(eq(broilerBatches.farmId, farmId));
      await db.delete(birdAcquisitions).where(eq(birdAcquisitions.farmId, farmId));
      await db.delete(farmLocations).where(eq(farmLocations.farmId, farmId));
      await db.delete(appSettings).where(eq(appSettings.farmId, farmId));
      await db.delete(farms).where(eq(farms.id, farmId));
    }
    createdFarmIds.length = 0;
  });

  it("expone curva Hy-Line Brown (semanas 15–100) y umbrales exactos de las 6 especies", () => {
    expect(HY_LINE_BROWN_HEN[HY_LINE_BROWN_HEN.length - 1].week).toBe(100);
    const curve = getStandardCurve("gallina", "Hy-Line Brown");
    expect(curve?.breed).toBe("Hy-Line Brown");
    const wk26 = curve ? interpolateStandard(curve, 26) : null;
    expect(wk26?.target).toBe(95);
    const wk100 = curve ? interpolateStandard(curve, 100) : null;
    expect(wk100?.target).toBe(62);

    expect(MASTER_SPECIES_BIOLOGY.codorniz.stopTurningDay).toBe(14);
    expect(MASTER_SPECIES_BIOLOGY.pato.pekinOptimalHarvestDays).toEqual([49, 56]);
    expect(MASTER_SPECIES_BIOLOGY.conejo.palpationDay).toBe(18);
    expect(MASTER_SPECIES_BIOLOGY.cuy.fatteningDaysRange).toEqual([75, 90]);
  });

  it("buildInitialBiologicalPlan genera solo hitos futuros respecto a la edad actual en todas las especies", () => {
    const start = "2026-11-13";
    const chicken20d = buildInitialBiologicalPlan(
      {
        nombreInstalacion: "Galpon Pollo",
        especie: "pollo",
        edadActualDias: 20,
        cantidadVivaHoy: 100,
      },
      start,
    );
    expect(chicken20d.milestones.every((m) => m.dueDate >= start && m.weekNumber >= 3)).toBe(true);
    expect(chicken20d.sanitaryEvents.every((s) => s.nextDueDate >= start)).toBe(true);

    for (const sp of ["gallina", "codorniz", "pato", "conejo", "cuy"]) {
      const plan = buildInitialBiologicalPlan(
        {
          nombreInstalacion: `Modulo ${sp}`,
          especie: sp,
          edadActualDias: 45,
          cantidadVivaHoy: 30,
        },
        start,
      );
      expect(plan.milestones.length).toBeGreaterThan(0);
      expect(plan.milestones.every((m) => m.dueDate >= start)).toBe(true);
      expect(plan.sanitaryEvents.every((s) => s.nextDueDate >= start)).toBe(true);
    }
  });

  it("executeDay1Setup escenario Plan Maestro (150 gallinas sem 26, 20 cuyes y 4 bultos de 40 kg) sin deuda histórica", async () => {
    const suffix = crypto.randomBytes(4).toString("hex");
    const [farm] = await db
      .insert(farms)
      .values({
        slug: `day1-bio-${suffix}`,
        name: `Granja Dia1 ${suffix}`,
        planCode: "FREEMIUM_SEMILLA",
      })
      .returning();
    createdFarmIds.push(farm.id);

    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "test-user",
      username: "test",
      name: "Owner",
      role: "propietario",
      farmId: farm.id,
    });

    const start = "2026-11-13";
    const result = await runWithFarmContext(farm.id, () =>
      executeDay1Setup({
        nombrePredio: "Finca El Paraíso",
        escala: "PEQUENO",
        fechaInicioOperacion: start,
        especies: ["gallina", "cuy"],
        bultosConcentrado40kg: 4,
        unidades: [
          {
            nombreInstalacion: "Galpón Ponedoras 1",
            tipoInstalacion: "galpon",
            especie: "gallina",
            lineaGenetica: "Hy-Line Brown",
            edadActualDias: 26 * 7,
            cantidadVivaHoy: 150,
          },
          {
            nombreInstalacion: "Galpón Cuyes Reproductores",
            tipoInstalacion: "poza",
            especie: "cuy",
            lineaGenetica: "Cuy Mejorado",
            edadActualDias: 90,
            cantidadVivaHoy: 20,
          },
        ],
      }),
    );

    expect(result.created.animalsCreated).toBe(170);
    expect(result.created.totalFeedKg).toBe(160);
    expect(result.created.milestonesCreated).toBeGreaterThan(0);
    expect(result.created.sanitaryEventsCreated).toBeGreaterThan(0);

    const [feeds, milestones, sanitary] = await runWithFarmContext(farm.id, () =>
      Promise.all([
        db.select().from(feedInventory),
        db.select().from(flockPlanMilestones),
        db.select().from(sanitaryCalendar),
      ]),
    );

    expect(Number(feeds[0]?.currentStock)).toBe(160);
    expect(milestones.length).toBe(result.created.milestonesCreated);
    expect(sanitary.every((s) => s.nextDueDate >= start)).toBe(true);
    const futureLayerWeeks = milestones.filter((m) => (m.expectedHens || 0) === 150).map((m) => m.weekNumber);
    expect(futureLayerWeeks.every((w) => w >= 26)).toBe(true);
  });
});


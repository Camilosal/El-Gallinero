import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, farms, users } from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import * as authMod from "@/lib/auth";
import { invalidateSettingsCache } from "@/lib/settings";
import { GET as onboardingGET, PATCH as onboardingPATCH } from "@/app/api/onboarding/route";
import {
  FARM_PURPOSE_CATALOG,
  VALID_FARM_PURPOSES,
  createDefaultProgressiveConfig,
  normalizeFarmPurposes,
  resolvePurposeProfileMode,
  sanitizeProgressiveConfig,
} from "@/lib/onboarding";
import {
  BEHAVIORAL_NUDGE_GROUPS,
  pickAdaptiveNudge,
  resolveNudgeContextMeta,
} from "@/lib/behavioral-nudges";
import {
  adaptMicroInsightForPurpose,
  buildEggMicroInsight,
  buildFeedMicroInsight,
  inferInsightFamily,
  resolveEssentialHabitSteps,
} from "@/lib/micro-insights";
import {
  SCHOOL_BASE_ROUTE,
  SCHOOL_CURRICULUM_ROUTES,
  SCHOOL_MICROLESSONS,
  SCHOOL_MODULE_MOUNTED,
  resolveSchoolLearningBridge,
  type SchoolInsightFamily,
} from "@/lib/school-curriculum";
import { getGuide } from "@/lib/guide-data";
import { mockRequest, parseJson } from "./helpers";

function createMemoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

describe("Cadena Onboarding (Propósitos) -> 69 Nudges -> MicroInsights -> Contrato Escuela", () => {
  const testFarmId = crypto.randomUUID();
  const tempUserId = crypto.randomUUID();
  const suffix = testFarmId.slice(0, 8);

  beforeAll(async () => {
    await db.insert(farms).values({
      id: testFarmId,
      slug: `test-purposes-${suffix}`,
      name: `Granja Test Propósitos ${suffix}`,
    });

    await db.insert(users).values({
      id: tempUserId,
      username: `purp_admin_${suffix}`,
      passwordHash: "hash-not-used",
      name: "Admin Test Propósitos",
      role: "admin",
      farmId: testFarmId,
    });
  });

  afterAll(async () => {
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "test-user",
      username: "test",
      name: "Test User",
      role: "admin",
      farmId: "00000000-0000-0000-0000-000000000001",
    });

    await runWithFarmContext(testFarmId, async () => {
      invalidateSettingsCache();
      await db.delete(appSettings).where(eq(appSettings.farmId, testFarmId));
    });
    await db.delete(users).where(eq(users.farmId, testFarmId));
    await db.delete(farms).where(eq(farms.id, testFarmId));
  });

  it("normaliza propósitos combinables, resuelve el modo de perfil y sanea la configuración progresiva", () => {
    expect(FARM_PURPOSE_CATALOG).toHaveLength(6);
    expect(VALID_FARM_PURPOSES).toHaveLength(6);

    expect(
      normalizeFarmPurposes(["hogar", "invalido", "ingresos", "hogar", "proyecto", 123]),
    ).toEqual(["hogar", "ingresos", "proyecto"]);

    expect(resolvePurposeProfileMode([])).toBe("neutral");
    expect(resolvePurposeProfileMode(["hogar"])).toBe("hogar");
    expect(resolvePurposeProfileMode(["ingresos"])).toBe("ingresos");
    expect(resolvePurposeProfileMode(["hogar", "ingresos"])).toBe("mixto");

    const base = createDefaultProgressiveConfig("PEQUENO");
    expect(base.purposes).toEqual([]);
    expect(base.primaryPurpose).toBeNull();

    const sanitized = sanitizeProgressiveConfig({
      scale: "PEQUENO",
      purposes: ["hogar", "invalido", "sostenibilidad"],
      primaryPurpose: "proyecto", // no está en purposes -> cae en el primero válido ("hogar")
      projectPurposes: ["proyecto", "invalido_libre"],
      acceptedSharedPurposes: ["aprendizaje", ""],
    });

    expect(sanitized.purposes).toEqual(["hogar", "sostenibilidad"]);
    expect(sanitized.primaryPurpose).toBe("hogar");
    expect(sanitized.projectPurposes).toEqual(["proyecto"]);
    expect(sanitized.acceptedSharedPurposes).toEqual(["aprendizaje"]);
  });

  it("persiste propósitos combinables y prioridad vía PATCH y GET /api/onboarding en el_gallinero_test", async () => {
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: tempUserId,
      username: `purp_admin_${suffix}`,
      name: "Admin Test Propósitos",
      role: "admin",
      farmId: testFarmId,
    });

    const patchRes = await onboardingPATCH(
      mockRequest("http://localhost/api/onboarding", {
        method: "PATCH",
        body: {
          purposes: ["ingresos", "hogar", "no_valido", "hogar"],
          primaryPurpose: "ingresos",
          projectPurposes: ["proyecto", "sostenibilidad", "invalido"],
          acceptedSharedPurposes: ["aprendizaje"],
        },
      }),
    );

    expect(patchRes.status).toBe(200);
    const patchBody = (await parseJson(patchRes)) as any;
    expect(patchBody.config.purposes).toEqual(["ingresos", "hogar"]);
    expect(patchBody.config.primaryPurpose).toBe("ingresos");
    expect(patchBody.config.projectPurposes).toEqual(["proyecto", "sostenibilidad"]);
    expect(patchBody.config.acceptedSharedPurposes).toEqual(["aprendizaje"]);

    // Cambiar prioridad a "proyecto" (ausente en purposes -> hace fallback seguro a "hogar")
    const fallbackPatchRes = await onboardingPATCH(
      mockRequest("http://localhost/api/onboarding", {
        method: "PATCH",
        body: {
          purposes: ["hogar"],
          primaryPurpose: "proyecto",
        },
      }),
    );
    expect(fallbackPatchRes.status).toBe(200);

    const getRes = await onboardingGET(mockRequest("http://localhost/api/onboarding"));
    expect(getRes.status).toBe(200);
    const getBody = (await parseJson(getRes)) as any;
    expect(getBody.config.purposes).toEqual(["hogar"]);
    expect(getBody.config.primaryPurpose).toBe("hogar");
    expect(getBody.config.projectPurposes).toEqual(["proyecto", "sostenibilidad"]);
    expect(getBody.config.acceptedSharedPurposes).toEqual(["aprendizaje"]);
  });

  it("audita los 17 grupos / 69 nudges, preserva secuencia base 0->1 y prioriza según propósito y especie", () => {
    const groups = Object.entries(BEHAVIORAL_NUDGE_GROUPS);
    expect(groups).toHaveLength(17);

    const allNudges = groups.flatMap(([, group]) => group.nudges);
    expect(allNudges).toHaveLength(69);

    const validRouteIds = new Set(SCHOOL_CURRICULUM_ROUTES.map((r) => r.id));
    for (const [groupKey, group] of groups) {
      for (const nudge of group.nudges) {
        const meta = resolveNudgeContextMeta(nudge, groupKey);
        expect(meta.purposes.length).toBeGreaterThan(0);
        expect(
          getGuide(meta.appGuideSlug),
          `Guía /guia/${meta.appGuideSlug} faltante para nudge ${nudge.id}`,
        ).toBeDefined();
        expect(validRouteIds.has(meta.schoolRouteId)).toBe(true);
      }
    }

    // 1. Sin historial ni propósitos/especies: mantiene rotación exacta 0 -> 1
    const baseStorage = createMemoryStorage();
    const first = pickAdaptiveNudge("finanzas:seq", BEHAVIORAL_NUDGE_GROUPS.finanzas.nudges, baseStorage, {
      advance: true,
      nowMs: 1_000,
    });
    const second = pickAdaptiveNudge("finanzas:seq", BEHAVIORAL_NUDGE_GROUPS.finanzas.nudges, baseStorage, {
      advance: true,
      nowMs: 2_000,
    });
    expect(first.index).toBe(0);
    expect(second.index).toBe(1);
    expect(first.reasonCode).toBe("rotacion_base");

    // 2. Con propósito "ingresos": explicable por objetivo_declarado y enlazado a /guia y ruta de Escuela
    const purposeStorage = createMemoryStorage();
    const forProfit = pickAdaptiveNudge(
      "inicio:ingresos",
      BEHAVIORAL_NUDGE_GROUPS.inicio.nudges,
      purposeStorage,
      {
        advance: true,
        nowMs: 3_000,
        purposes: ["ingresos"],
        primaryPurpose: "ingresos",
      },
    );
    expect(forProfit.reasonCode).toBe("objetivo_declarado");
    expect(forProfit.appGuideHref).toMatch(/^\/guia\/.+/);
    expect(validRouteIds.has(forProfit.schoolRouteId!)).toBe(true);

    // 3. Especie incompatible ("cuy"): suprime nudges de postura ("ani-3", "ani-4") y reduce score de huevos
    const cuyEggs = pickAdaptiveNudge(
      "produccion_huevos:cuy",
      BEHAVIORAL_NUDGE_GROUPS.produccion_huevos.nudges,
      createMemoryStorage(),
      {
        advance: true,
        nowMs: 4_000,
        activeSpecies: ["cuy"],
      },
    );
    expect(cuyEggs.utilityScore).toBeLessThan(0);
    expect(cuyEggs.reasonCode).toBe("especie_etapa");

    const aniStorage = createMemoryStorage();
    for (let step = 0; step < 3; step++) {
      const pickedAnimal = pickAdaptiveNudge(
        "animales:cuy",
        BEHAVIORAL_NUDGE_GROUPS.animales.nudges,
        aniStorage,
        {
          advance: true,
          nowMs: 5_000 + step * 1000,
          activeSpecies: ["cuy"],
        },
      );
      expect(["ani-3", "ani-4"]).not.toContain(pickedAnimal.nudge.id);
      expect(pickedAnimal.reasonCode).toBe("especie_etapa");
    }
  });

  it("evita doble conteo de autoconsumo, adapta hábitos por especie/propósito y adjunta puente a Escuela en MicroInsights", () => {
    const insight = buildEggMicroInsight({
      date: "2026-11-22",
      species: "gallina",
      locationName: "Galpón Prueba",
      totalCollected: 120,
      broken: 6,
      forIncubation: 10,
      unitPrice: 600,
      activeLayingBirds: 140,
      todayFeedCostCOP: 42000,
      quantityAutoconsumo: 24,
      offline: false,
    });

    // Preserva las métricas existentes (incluyendo Utilidad Neta Hoy)
    expect(insight.metrics[3]?.label).toBe("Utilidad Neta Hoy");
    expect(insight.valueKind).toBe("estimate");
    // 120 - 6 - 10 = 104 huevos útiles; 24 hogar + 80 comercial === 104 (sin doble conteo)
    expect(insight.destinationBreakdown).toEqual({
      total: 104,
      hogar: 24,
      comercial: 80,
      unit: "huevos",
      hogarValuationCOP: 14400,
      comercialValueCOP: 48000,
    });
    expect(insight.destinationBreakdown!.hogar + insight.destinationBreakdown!.comercial).toBe(
      insight.destinationBreakdown!.total,
    );

    // Hábitos esenciales sin huevo para especies no ponedoras y sin venta diaria en perfil 100% hogar
    const nonLayingSteps = resolveEssentialHabitSteps({
      species: ["cuy", "conejo"],
      purposes: ["ingresos"],
    }).map((s) => s.step);
    expect(nonLayingSteps).not.toContain("huevos");
    expect(nonLayingSteps).toContain("alimentacion");
    expect(nonLayingSteps).toContain("finanzas");

    const homeOnlySteps = resolveEssentialHabitSteps({
      species: ["gallina"],
      purposes: ["hogar"],
    }).map((s) => s.step);
    expect(homeOnlySteps).toContain("huevos");
    expect(homeOnlySteps).toContain("alimentacion");
    expect(homeOnlySteps).not.toContain("finanzas");

    const adapted = adaptMicroInsightForPurpose(insight, {
      insightFamily: "huevos",
      purposes: ["hogar", "ingresos"],
      primaryPurpose: "hogar",
      species: "gallina",
      quantityAutoconsumo: 24,
      syncStatus: "confirmed",
    });

    expect(adapted.purposeMode).toBe("mixto");
    expect(adapted.syncStatus).toBe("confirmed");
    expect(adapted.valueKind).toBe("estimate");
    expect(adapted.reasonCode).toBe("evento_operativo");
    expect(adapted.learningAction).toBeDefined();
    expect(adapted.learningAction!.isSchoolModuleMounted).toBe(false);
    expect(adapted.learningAction!.targetHref.startsWith("/escuela")).toBe(false);
    const guideSlug = adapted.learningAction!.appGuideHref.replace(/^\/guia\//, "");
    expect(getGuide(guideSlug)).toBeDefined();

    // Sin costo de alimento diario explícito, se marca como cálculo directo ("calculated")
    const calculatedInsight = buildEggMicroInsight({
      date: "2026-11-22",
      species: "gallina",
      locationName: "Galpón Prueba",
      totalCollected: 30,
      broken: 0,
      unitPrice: 600,
      quantityAutoconsumo: 10,
    });
    expect(calculatedInsight.valueKind).toBe("calculated");
    expect(calculatedInsight.destinationBreakdown).toEqual({
      total: 30,
      hogar: 10,
      comercial: 20,
      unit: "huevos",
      hogarValuationCOP: 6000,
      comercialValueCOP: 12000,
    });

    // Inferencia automática de familia y recálculo de hábito/nextAction sin insightFamily explícito
    expect(inferInsightFamily({ id: "egg-1", categoryLabel: "" })).toBe("huevos");
    expect(inferInsightFamily({ id: "feed-1", categoryLabel: "" })).toBe("alimentacion");
    expect(inferInsightFamily({ id: "mort-1", categoryLabel: "" })).toBe("mortalidad");
    expect(inferInsightFamily({ id: "sale-1", categoryLabel: "" })).toBe("venta");
    expect(inferInsightFamily({ id: "exp-1", categoryLabel: "" })).toBe("gasto");
    expect(inferInsightFamily({ id: "health-1", categoryLabel: "" })).toBe("sanidad");
    expect(inferInsightFamily({ id: "repro-1", categoryLabel: "" })).toBe("reproduccion");
    expect(inferInsightFamily({ id: "inc-start-1", categoryLabel: "" })).toBe("incubacion");

    const rawFeedForCuy = buildFeedMicroInsight({
      date: "2026-11-22",
      feedName: "Forraje Cuyes",
      unit: "kg",
      quantity: 12,
      isEntry: false,
      locationName: "Cuyera A",
      remainingStockAfter: 60,
    });
    const cuyAdaptedFeed = adaptMicroInsightForPurpose(rawFeedForCuy, {
      activeSpecies: ["cuy"],
      purposes: ["ingresos"],
      farmId: testFarmId,
    });
    expect(cuyAdaptedFeed.learningAction?.routeId).toBe("nutricion_bodega");
    expect(cuyAdaptedFeed.habit?.essentialTotal).toBe(2);
    expect(cuyAdaptedFeed.nextAction?.mode).toBe("venta");

    const homeAdaptedEggs = adaptMicroInsightForPurpose(insight, {
      species: "gallina",
      purposes: ["hogar"],
      farmId: testFarmId,
    });
    expect(homeAdaptedEggs.learningAction?.routeId).toBe("produccion_calidad");
    expect(homeAdaptedEggs.habit?.essentialTotal).toBe(2);
    expect(homeAdaptedEggs.nextAction?.mode).toBe("alimentacion");
  });

  it("mantiene el contrato desacoplado de la Escuela (8 rutas x plantilla de 10 bloques) separado de /guia sin enlaces rotos", () => {
    expect(SCHOOL_MODULE_MOUNTED).toBe(false);
    expect(SCHOOL_BASE_ROUTE).toBe("/escuela");
    expect(SCHOOL_CURRICULUM_ROUTES).toHaveLength(8);
    expect(SCHOOL_MICROLESSONS).toHaveLength(8);

    const lessonIds = new Set(SCHOOL_MICROLESSONS.map((l) => l.id));
    for (const route of SCHOOL_CURRICULUM_ROUTES) {
      expect(lessonIds.has(route.inauguralLessonId)).toBe(true);
    }

    for (const lesson of SCHOOL_MICROLESSONS) {
      expect(lesson.block1FieldQuestion.trim().length).toBeGreaterThan(10);
      expect(lesson.block2LearningBenefit.trim().length).toBeGreaterThan(10);
      expect(lesson.block3PlainExplanation.trim().length).toBeGreaterThan(15);
      expect(lesson.block4SpeciesStageExample.trim().length).toBeGreaterThan(15);
      expect(lesson.block5Checklist.length).toBeGreaterThanOrEqual(2);
      expect(lesson.block6PracticeTask.trim().length).toBeGreaterThan(10);
      expect(lesson.block7PracticeModuleHref.startsWith("/")).toBe(true);
      expect(lesson.block8FollowUpInsightFamily.trim().length).toBeGreaterThan(0);
      expect(lesson.block9NetworkCategory.trim().length).toBeGreaterThan(0);
      expect(lesson.block10EditorialMeta.sources.length).toBeGreaterThanOrEqual(1);
      expect(lesson.block10EditorialMeta.version.length).toBeGreaterThan(0);
      expect(
        getGuide(lesson.block10EditorialMeta.appGuideSlug),
        `Guía de app /guia/${lesson.block10EditorialMeta.appGuideSlug} faltante para microlección ${lesson.id}`,
      ).toBeDefined();
    }

    const families: SchoolInsightFamily[] = [
      "huevos",
      "alimentacion",
      "mortalidad",
      "venta",
      "gasto",
      "sanidad",
      "reproduccion",
      "incubacion",
    ];
    for (const family of families) {
      const bridge = resolveSchoolLearningBridge({
        insightFamily: family,
        purpose: "hogar",
        species: "gallina",
      });
      expect(bridge.isSchoolModuleMounted).toBe(false);
      expect(bridge.targetHref.startsWith("/escuela")).toBe(false);
      expect(bridge.targetHref === "/analisis/normas" || bridge.targetHref.startsWith("/guia/")).toBe(
        true,
      );
      expect(bridge.fallbackAppGuideHref.startsWith("/guia/")).toBe(true);
      expect(bridge.practiceHref.startsWith("/")).toBe(true);
    }
  });
});

import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray, like, or } from "drizzle-orm";
import {
  ACTIVATION_HISTORY_SETTING_KEY,
  FEATURE_FLAG_CATALOG,
  PROGRESSIVE_CONFIG_SETTING_KEY,
  PROGRESSIVE_UNLOCKABLE_KEYS,
  applyScalePreset,
  createDefaultProgressiveConfig,
  evaluateProgressiveTriggers,
  exportDay1StarterCsvTemplate,
  getEffectiveFlags,
  inferLegacyFarmConfig,
  isHrefEnabledByFlags,
  parseDay1StarterCsv,
  type LiveFarmMetrics,
} from "@/lib/onboarding";
import { filterNavigationGroups, searchNavigation } from "@/lib/navigation";
import { invalidateSettingsCache } from "@/lib/settings";
import { GET, PATCH, POST } from "@/app/api/onboarding/route";
import { db } from "@/db";
import { DEFAULT_FARM_ID } from "@/db/tenant-context";
import {
  animalLocationMovements,
  appSettings,
  birdAcquisitions,
  broilerBatches,
  farmLocations,
  feedInventory,
  feedMovements,
  hens,
  roosters,
} from "@/db/schema";
import { mockRequest, parseJson } from "./helpers";

function emptyMetrics(overrides: Partial<LiveFarmMetrics> = {}): LiveFarmMetrics {
  return {
    avesActivasTotales: 0,
    gallinasPonedorasActivas: 0,
    reproductoresMamiferos: 0,
    especiesActivas: 0,
    especiesList: [],
    locationsCount: 0,
    animalsTotal: 0,
    feedInventoryCount: 0,
    feedStockKg: 0,
    hasExistingOperation: false,
    ...overrides,
  };
}

describe("Onboarding progresivo — lógica de dominio, feature flags y auto-triggers", () => {
  it("mantiene activos los 4 flags core en PEQUENO y MEDIANO, y desbloquea avanzados según escala", () => {
    const pequeno = createDefaultProgressiveConfig("PEQUENO");
    const mediano = createDefaultProgressiveConfig("MEDIANO");

    const flagsPequeno = getEffectiveFlags(pequeno);
    const flagsMediano = getEffectiveFlags(mediano);

    expect(FEATURE_FLAG_CATALOG).toHaveLength(9);

    for (const def of FEATURE_FLAG_CATALOG.filter((item) => !item.manualUnlock)) {
      expect(flagsPequeno[def.key]).toBe(true);
      expect(flagsMediano[def.key]).toBe(true);
    }

    for (const key of PROGRESSIVE_UNLOCKABLE_KEYS) {
      expect(flagsPequeno[key]).toBe(false);
      expect(flagsMediano[key]).toBe(true);
    }
  });

  it("evalúa correctamente los 5 triggers inteligentes de crecimiento y umbrales exactos", () => {
    const base = createDefaultProgressiveConfig("PEQUENO");

    const belowThresholds = evaluateProgressiveTriggers(
      base,
      emptyMetrics({
        avesActivasTotales: 200,
        gallinasPonedorasActivas: 149,
        reproductoresMamiferos: 29,
        especiesActivas: 1,
        especiesList: ["gallina"],
        animalsTotal: 200,
        hasExistingOperation: true,
      }),
    );

    expect(belowThresholds.triggeredFlags).toEqual([]);
    expect(belowThresholds.newlyActivatedFlags).toEqual([]);

    const aboveThresholds = evaluateProgressiveTriggers(
      { ...base, solicitaReporteFormal: true },
      emptyMetrics({
        avesActivasTotales: 201,
        gallinasPonedorasActivas: 150,
        reproductoresMamiferos: 30,
        especiesActivas: 2,
        especiesList: ["gallina", "cuy"],
        animalsTotal: 231,
        hasExistingOperation: true,
      }),
    );

    expect(new Set(aboveThresholds.triggeredFlags)).toEqual(new Set(PROGRESSIVE_UNLOCKABLE_KEYS));
    expect(new Set(aboveThresholds.newlyActivatedFlags)).toEqual(new Set(PROGRESSIVE_UNLOCKABLE_KEYS));
  });

  it("respeta manualOverrides en false para no reactivar un módulo apagado intencionalmente por el usuario", () => {
    const cfg = {
      ...createDefaultProgressiveConfig("PEQUENO"),
      manualOverrides: {
        auditoria_poe_gab_ica: false,
      },
    };

    const evalRes = evaluateProgressiveTriggers(
      cfg,
      emptyMetrics({
        avesActivasTotales: 350,
        gallinasPonedorasActivas: 180,
        especiesActivas: 2,
        especiesList: ["gallina", "cuy"],
        animalsTotal: 380,
        hasExistingOperation: true,
      }),
    );

    expect(evalRes.triggeredFlags).toContain("auditoria_poe_gab_ica");
    expect(evalRes.newlyActivatedFlags).not.toContain("auditoria_poe_gab_ica");
    expect(evalRes.newlyActivatedFlags).toContain("centros_costo_prorrateo");
    expect(evalRes.newlyActivatedFlags).toContain("clasificacion_ntc1240_calibres");
  });

  it("cambia entre PEQUENO y MEDIANO sin pérdida de perfil mediante applyScalePreset", () => {
    const initial = {
      ...createDefaultProgressiveConfig("PEQUENO"),
      operationStartDate: "2026-01-15",
      selectedSpecies: ["gallina", "cuy"],
    };

    const toMediano = applyScalePreset(initial, "MEDIANO");
    expect(toMediano.config.scale).toBe("MEDIANO");
    expect(toMediano.config.operationStartDate).toBe("2026-01-15");
    expect(toMediano.config.selectedSpecies).toEqual(["gallina", "cuy"]);
    expect(toMediano.changes.every((c) => c.from === false && c.to === true)).toBe(true);
    expect(toMediano.changes).toHaveLength(PROGRESSIVE_UNLOCKABLE_KEYS.length);

    const backToPequeno = applyScalePreset(toMediano.config, "PEQUENO");
    expect(backToPequeno.config.scale).toBe("PEQUENO");
    expect(backToPequeno.config.operationStartDate).toBe("2026-01-15");
    expect(backToPequeno.changes.every((c) => c.from === true && c.to === false)).toBe(true);
    expect(backToPequeno.config.solicitaReporteFormal).toBe(false);
  });

  it("infiere escala legacy sin bloquear granjas existentes con operación activa", () => {
    const freshFarm = inferLegacyFarmConfig(emptyMetrics());
    expect(freshFarm.scale).toBe("PEQUENO");
    expect(freshFarm.onboardingCompleted).toBe(false);

    const activeSmallFarm = inferLegacyFarmConfig(
      emptyMetrics({
        avesActivasTotales: 45,
        gallinasPonedorasActivas: 45,
        especiesActivas: 1,
        especiesList: ["gallina"],
        locationsCount: 2,
        animalsTotal: 45,
        hasExistingOperation: true,
      }),
    );
    expect(activeSmallFarm.scale).toBe("PEQUENO");
    expect(activeSmallFarm.onboardingCompleted).toBe(true);

    const activeMediumFarm = inferLegacyFarmConfig(
      emptyMetrics({
        avesActivasTotales: 240,
        gallinasPonedorasActivas: 240,
        especiesActivas: 1,
        especiesList: ["gallina"],
        locationsCount: 4,
        animalsTotal: 240,
        hasExistingOperation: true,
      }),
    );
    expect(activeMediumFarm.scale).toBe("MEDIANO");
    expect(activeMediumFarm.onboardingCompleted).toBe(true);
    expect(activeMediumFarm.flags.auditoria_poe_gab_ica).toBe(true);
    expect(activeMediumFarm.flags.clasificacion_ntc1240_calibres).toBe(true);
  });

  it("parsea correctamente plantilla_arranque_dia1.csv multi-especie y reporta errores en filas inválidas", () => {
    const templateCsv = exportDay1StarterCsvTemplate();
    const parsed = parseDay1StarterCsv(templateCsv);

    expect(parsed.errors).toEqual([]);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]).toMatchObject({
      nombreInstalacion: "Galpon Principal",
      especie: "gallina",
      cantidadVivaHoy: 80,
      saldoConcentradoBultos40kg: 4,
    });
    expect(parsed.rows[1]).toMatchObject({
      nombreInstalacion: "Cuyera Modulo A",
      especie: "cuy",
      cantidadVivaHoy: 35,
      saldoConcentradoBultos40kg: 2,
    });
    expect(parsed.rows[2]).toMatchObject({
      nombreInstalacion: "Modulo Cunicola",
      especie: "conejo",
      cantidadVivaHoy: 18,
    });

    const invalid = parseDay1StarterCsv(
      "nombre_instalacion,tipo_instalacion,especie,codigo_lote,linea_genetica,edad_actual_dias,cantidad_viva_hoy,saldo_concentrado_bultos_40kg\n" +
        "Corral Malo,corral,gallina,L1,Criolla,30,0,1\n" +
        ",corral,cuy,L2,Andino,20,15,1",
    );
    expect(invalid.rows).toEqual([]);
    expect(invalid.errors).toHaveLength(2);
  });

  it("aplica gating de rutas progresivas y etiqueta resultados bloqueados en búsqueda global", () => {
    const lockedFlags = getEffectiveFlags(createDefaultProgressiveConfig("PEQUENO"));
    expect(isHrefEnabledByFlags("/dashboard/produccion", lockedFlags)).toBe(true);
    expect(isHrefEnabledByFlags("/dashboard/analisis/reportes", lockedFlags)).toBe(true);
    expect(isHrefEnabledByFlags("/dashboard/sanidad/bioseguridad", lockedFlags)).toBe(false);
    expect(isHrefEnabledByFlags("/dashboard/operaciones/cierre", lockedFlags)).toBe(false);
    expect(isHrefEnabledByFlags("/dashboard/analisis/reportes?tab=analitica", lockedFlags)).toBe(false);
    expect(isHrefEnabledByFlags("/dashboard/finanzas/presupuestos", lockedFlags)).toBe(false);

    const searchLocked = searchNavigation("Bioseguridad", 12, lockedFlags);
    const bioResult = searchLocked.find((item) => item.href === "/dashboard/sanidad/bioseguridad");
    expect(bioResult).toBeDefined();
    expect(bioResult?.lockedByFlag).toBe("auditoria_poe_gab_ica");

    const defaultLocked = searchNavigation("", 12, lockedFlags);
    expect(defaultLocked.some((item) => item.href === "/dashboard/sanidad/bioseguridad")).toBe(false);

    const navLocked = filterNavigationGroups(lockedFlags).flatMap((g) => g.items.map((i) => i.href));
    expect(navLocked).not.toContain("/dashboard/sanidad/bioseguridad");
    expect(navLocked).not.toContain("/dashboard/operaciones/cierre");
    expect(navLocked).toContain("/dashboard/produccion?tab=huevos");

    const unlockedFlags = getEffectiveFlags(createDefaultProgressiveConfig("MEDIANO"));
    expect(isHrefEnabledByFlags("/dashboard/sanidad/bioseguridad", unlockedFlags)).toBe(true);
    const searchUnlocked = searchNavigation("Bioseguridad", 12, unlockedFlags);
    const bioUnlocked = searchUnlocked.find((item) => item.href === "/dashboard/sanidad/bioseguridad");
    expect(bioUnlocked?.lockedByFlag).toBeUndefined();

    expect(isHrefEnabledByFlags("/dashboard/analisis/kpis", lockedFlags)).toBe(false);
    expect(isHrefEnabledByFlags("/dashboard/inventarios/huevos", lockedFlags)).toBe(false);
    expect(isHrefEnabledByFlags("/dashboard/analisis/razas", lockedFlags)).toBe(false);
    expect(isHrefEnabledByFlags("/dashboard/operaciones/activos", lockedFlags)).toBe(false);
    expect(isHrefEnabledByFlags("/dashboard/operaciones/mantenimiento", lockedFlags)).toBe(false);

    const navUnlocked = filterNavigationGroups(unlockedFlags).flatMap((g) => g.items.map((i) => i.href));
    expect(navUnlocked).toContain("/dashboard/sanidad/bioseguridad");
    expect(navUnlocked).toContain("/dashboard/operaciones/cierre");
    expect(navUnlocked).toContain("/dashboard/analisis/kpis");
    expect(navUnlocked).toContain("/dashboard/inventarios/huevos");
    expect(navUnlocked).toContain("/dashboard/finanzas/presupuestos");
    expect(navUnlocked.length).toBeGreaterThan(navLocked.length + 5);
  });
});

describe("API /api/onboarding integración contra el_gallinero_test", () => {
  const TEST_PREFIX = "TEST-ONB-";
  const settingsSnapshot = new Map<string, string | null>();
  const watchedKeys = [
    PROGRESSIVE_CONFIG_SETTING_KEY,
    ACTIVATION_HISTORY_SETTING_KEY,
    "farm.name",
    "farm.city",
    "farm.altitude_meters",
    "farm.admin_name",
    "farm.operation_start_date",
  ];

  async function cleanupTestEntities() {
    const testLocs = await db
      .select({ id: farmLocations.id })
      .from(farmLocations)
      .where(like(farmLocations.name, `${TEST_PREFIX}%`));
    const locIds = testLocs.map((l) => l.id);

    if (locIds.length > 0) {
      await db
        .delete(animalLocationMovements)
        .where(
          or(
            inArray(animalLocationMovements.toLocationId, locIds),
            inArray(animalLocationMovements.fromLocationId, locIds),
          ),
        );
      await db.delete(hens).where(inArray(hens.locationId, locIds));
      await db.delete(roosters).where(inArray(roosters.locationId, locIds));
      await db.delete(broilerBatches).where(inArray(broilerBatches.locationId, locIds));
      await db.delete(birdAcquisitions).where(inArray(birdAcquisitions.destinationLocationId, locIds));
      await db.delete(farmLocations).where(inArray(farmLocations.id, locIds));
    }

    const testFeeds = await db
      .select({ id: feedInventory.id })
      .from(feedInventory)
      .where(like(feedInventory.name, `${TEST_PREFIX}%`));
    const feedIds = testFeeds.map((f) => f.id);

    if (feedIds.length > 0) {
      await db.delete(feedMovements).where(inArray(feedMovements.feedId, feedIds));
      await db.delete(feedInventory).where(inArray(feedInventory.id, feedIds));
    }
  }

  async function restoreSettings() {
    for (const key of watchedKeys) {
      const prev = settingsSnapshot.get(key);
      if (prev === undefined || prev === null) {
        await db.delete(appSettings).where(and(eq(appSettings.farmId, DEFAULT_FARM_ID), eq(appSettings.key, key)));
      } else {
        await db
          .insert(appSettings)
          .values({ farmId: DEFAULT_FARM_ID, key, value: prev })
          .onConflictDoUpdate({
            target: [appSettings.farmId, appSettings.key],
            set: { value: prev, updatedAt: new Date() },
          });
      }
    }
    invalidateSettingsCache();
  }

  beforeAll(async () => {
    const existing = await db
      .select()
      .from(appSettings)
      .where(and(eq(appSettings.farmId, DEFAULT_FARM_ID), inArray(appSettings.key, watchedKeys)));
    for (const key of watchedKeys) {
      const row = existing.find((r) => r.key === key);
      settingsSnapshot.set(key, row ? row.value : null);
    }
    await cleanupTestEntities();
  });

  beforeEach(async () => {
    await db
      .delete(appSettings)
      .where(
        inArray(appSettings.key, [PROGRESSIVE_CONFIG_SETTING_KEY, ACTIVATION_HISTORY_SETTING_KEY]),
      );
    invalidateSettingsCache();
  });

  afterAll(async () => {
    await cleanupTestEntities();
    await restoreSettings();
  });

  it("GET /api/onboarding retorna estado completo, métricas vivas y catálogo", async () => {
    const res = await GET(mockRequest("http://localhost/api/onboarding"));
    expect(res.status).toBe(200);
    const data = await parseJson(res);
    expect(["PEQUENO", "MEDIANO"]).toContain(data.config.scale);
    expect(data.catalog).toHaveLength(9);
    expect(data.day1Rules.exigirHistorialPasado).toBe(false);
    expect(data.day1Rules.pasosMaximosWizard).toBe(3);
    expect(typeof data.metrics.animalsTotal).toBe("number");
  });

  it("PATCH /api/onboarding valida entradas, cambia escala y registra historial MANUAL_USUARIO / AUTO_TRIGGER_CRECIMIENTO", async () => {
    const badScale = await PATCH(
      mockRequest("http://localhost/api/onboarding", {
        method: "PATCH",
        body: { scale: "GIGANTE" },
      }),
    );
    expect(badScale.status).toBe(400);

    const badFlag = await PATCH(
      mockRequest("http://localhost/api/onboarding", {
        method: "PATCH",
        body: { toggleFlag: { key: "flag_inexistente", enabled: true } },
      }),
    );
    expect(badFlag.status).toBe(400);

    const patchScale = await PATCH(
      mockRequest("http://localhost/api/onboarding", {
        method: "PATCH",
        body: { scale: "MEDIANO" },
      }),
    );
    expect(patchScale.status).toBe(200);
    const medianoState = await parseJson(patchScale);
    expect(medianoState.config.scale).toBe("MEDIANO");
    expect(medianoState.flags.auditoria_poe_gab_ica).toBe(true);

    const patchToggleOff = await PATCH(
      mockRequest("http://localhost/api/onboarding", {
        method: "PATCH",
        body: {
          toggleFlag: {
            key: "clasificacion_ntc1240_calibres",
            enabled: false,
            reason: "Desactivación manual en prueba",
          },
        },
      }),
    );
    expect(patchToggleOff.status).toBe(200);
    const toggledState = await parseJson(patchToggleOff);
    expect(toggledState.flags.clasificacion_ntc1240_calibres).toBe(false);
    expect(toggledState.config.manualOverrides.clasificacion_ntc1240_calibres).toBe(false);
    expect(
      toggledState.history.some(
        (h: { featureKey: string; origin: string; estadoNuevo: boolean }) =>
          h.featureKey === "clasificacion_ntc1240_calibres" &&
          h.origin === "MANUAL_USUARIO" &&
          h.estadoNuevo === false,
      ),
    ).toBe(true);

    // Probar auto-trigger por solicitaReporteFormal=true desde escala PEQUENO
    await PATCH(
      mockRequest("http://localhost/api/onboarding", {
        method: "PATCH",
        body: { scale: "PEQUENO", solicitaReporteFormal: false },
      }),
    );
    const triggerFormal = await PATCH(
      mockRequest("http://localhost/api/onboarding", {
        method: "PATCH",
        body: { solicitaReporteFormal: true },
      }),
    );
    expect(triggerFormal.status).toBe(200);
    const formalState = await parseJson(triggerFormal);
    expect(formalState.flags.reportes_dian_roi_credito).toBe(true);

    // Cambiar de nuevo a PEQUENO apaga incluso solicitudes formales previas y respeta el preset
    const backPeqRes = await PATCH(
      mockRequest("http://localhost/api/onboarding", {
        method: "PATCH",
        body: { scale: "PEQUENO" },
      }),
    );
    expect(backPeqRes.status).toBe(200);
    const backPeqState = await parseJson(backPeqRes);
    expect(backPeqState.config.scale).toBe("PEQUENO");
    expect(backPeqState.config.solicitaReporteFormal).toBe(false);
    expect(backPeqState.flags.reportes_dian_roi_credito).toBe(false);
    expect(backPeqState.flags.auditoria_poe_gab_ica).toBe(false);
    expect(
      formalState.history.some(
        (h: { featureKey: string; origin: string; estadoNuevo: boolean }) =>
          h.featureKey === "reportes_dian_roi_credito" &&
          h.origin === "AUTO_TRIGGER_CRECIMIENTO" &&
          h.estadoNuevo === true,
      ),
    ).toBe(true);
  });

  it("POST /api/onboarding ejecuta arranque Día 1 con CSV multi-especie, stock en bultos y dispara triggers de especie", async () => {
    const csvText = [
      "nombre_instalacion,tipo_instalacion,especie,codigo_lote,linea_genetica,edad_actual_dias,cantidad_viva_hoy,saldo_concentrado_bultos_40kg",
      `${TEST_PREFIX}Galpon Pon,galpon_piso,gallina_ponedora,TEST-PON-01,Hy-Line Brown,180,12,2`,
      `${TEST_PREFIX}Cuyera A,poza,cuy,TEST-CUY-01,Andino Mejorado,45,25,1`,
    ].join("\n");

    const res = await POST(
      mockRequest("http://localhost/api/onboarding", {
        method: "POST",
        body: {
          nombrePredio: `${TEST_PREFIX}Granja El Mirador`,
          ciudad: "Fusagasugá",
          altitudMsnm: 1728,
          administrador: "Productor Prueba",
          escala: "PEQUENO",
          csvText,
          bultosConcentrado40kg: 5,
          kgConcentradoAdicional: 15,
          costoPorBulto40kg: 80000,
          nombreAlimentoInicial: `${TEST_PREFIX}Concentrado Arranque`,
        },
      }),
    );

    expect(res.status).toBe(201);
    const body = await parseJson(res);

    expect(body.created.locationsCreated).toBe(2);
    expect(body.created.animalsCreated).toBe(37);
    expect(body.created.feedEntriesCreated).toBe(1);
    expect(body.created.totalFeedKg).toBe(215);
    expect(body.created.sanitaryEventsCreated).toBeGreaterThanOrEqual(1);
    expect(body.created.milestonesCreated).toBeGreaterThanOrEqual(1);

    expect(body.state.config.onboardingCompleted).toBe(true);
    expect(body.state.farmProfile.name).toBe(`${TEST_PREFIX}Granja El Mirador`);
    expect(body.state.farmProfile.altitudeMeters).toBe("1728");

    // Verificar persistencia real en BD
    const createdFeedRows = await db
      .select()
      .from(feedInventory)
      .where(and(eq(feedInventory.name, `${TEST_PREFIX}Concentrado Arranque`)));
    expect(createdFeedRows).toHaveLength(1);
    expect(Number(createdFeedRows[0].currentStock)).toBe(215);
    expect(Number(createdFeedRows[0].costPerUnit)).toBe(2000);

    const createdLocs = await db
      .select()
      .from(farmLocations)
      .where(like(farmLocations.name, `${TEST_PREFIX}%`));
    expect(createdLocs).toHaveLength(2);

    const createdBatches = await db
      .select()
      .from(broilerBatches)
      .where(inArray(broilerBatches.locationId, createdLocs.map((l) => l.id)));
    expect(createdBatches.some((b) => b.species === "cuy" && b.currentQuantity === 25)).toBe(true);

    // Como tiene >= 2 especies (gallina + cuy), centros_costo_prorrateo debe quedar activo tras la evaluación automática
    expect(body.state.metrics.especiesActivas).toBeGreaterThanOrEqual(2);
    expect(body.state.flags.centros_costo_prorrateo).toBe(true);
  });

  it("expone accesos visibles al Asistente inicial desde Inicio, Configuración y Creación rápida, manteniendo el Sidebar limpio", () => {
    const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

    const dashboardSrc = read("src/app/dashboard/page.tsx");
    expect(dashboardSrc).toContain("OPEN_ONBOARDING_WIZARD_EVENT");
    expect(dashboardSrc).toContain("Asistente inicial: prepara tu granja en 3 pasos");
    expect(dashboardSrc).toContain("<span>Asistente inicial</span>");
    expect(dashboardSrc).toContain("<span>Abrir asistente inicial</span>");

    const sidebarSrc = read("src/components/Sidebar.tsx");
    expect(sidebarSrc).not.toContain("Asistente inicial");
    expect(sidebarSrc).not.toContain("Modo Pequeño · Simple");
    expect(sidebarSrc).not.toContain("Escala:");

    const configSrc = read("src/app/dashboard/configuracion/page.tsx");
    expect(configSrc).toContain('/dashboard?wizard=1');
    expect(configSrc).toContain("Asistente inicial (Día 1 · 3 pasos)");

    const flagsPanelSrc = read("src/components/FeatureFlagsPanel.tsx");
    expect(flagsPanelSrc).toContain("OPEN_ONBOARDING_WIZARD_EVENT");

    const wizardSrc = read("src/components/OnboardingWizardModal.tsx");
    expect(wizardSrc).toContain('key="wizard-next"');
    expect(wizardSrc).toContain('key="wizard-submit"');
    expect(wizardSrc).toContain("if (step === 2) {");

    const createSrc = read("src/lib/create-actions.ts");
    expect(createSrc).toContain('/dashboard?wizard=1');
    expect(createSrc).toContain("Abrir asistente inicial (Día 1 · 3 pasos)");
  });

  it("diferencia visual y funcionalmente el Modo Pequeño del Modo Mediano en layout, Inicio y módulos", () => {
    const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

    expect(read("src/app/dashboard/_client-layout.tsx")).toContain("<ScaleModeControl");
    expect(read("src/components/ScaleModeControl.tsx")).toContain('patchOnboarding({ scale: nextScale })');

    const dashSrc = read("src/app/dashboard/page.tsx");
    expect(dashSrc).toContain("Modo Pequeño Productor");
    expect(dashSrc).toContain("Modo Mediano / Tecnificado");
    expect(dashSrc).not.toContain("Franja operativa diferenciada");

    expect(read("src/app/dashboard/produccion/_components/HuevosTab.tsx")).toContain("ntc1240Enabled");
    expect(read("src/app/dashboard/produccion/_components/ReproduccionTab.tsx")).toContain("advancedGenetics");
    expect(read("src/app/dashboard/sanidad/bioseguridad/page.tsx")).toContain('mode="gate"');
    expect(read("src/app/dashboard/operaciones/cierre/page.tsx")).toContain('mode="gate"');
    expect(read("src/app/dashboard/finanzas/presupuestos/page.tsx")).toContain('mode="gate"');
    expect(read("src/app/dashboard/analisis/reportes/page.tsx")).toContain('mode="gate"');
  });
});

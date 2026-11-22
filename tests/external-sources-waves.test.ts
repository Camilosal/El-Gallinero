import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  externalDataSnapshots,
  farmLocations,
  healthControl,
  sensorReadings,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { getSettings, updateSettings } from "@/lib/settings";
import {
  GET as fuentesGET,
  POST as fuentesPOST,
} from "@/app/api/configuracion/fuentes-externas/route";
import { PUT as parametrosPUT } from "@/app/api/configuracion/parametros/route";
import { GET as alertasGET } from "@/app/api/produccion/alertas/route";
import { GET as prediccionGET } from "@/app/api/produccion/alimentacion/prediccion/route";
import { GET as curvasGET } from "@/app/api/analisis/curvas/route";
import { GET as contabilidadGET } from "@/app/api/analisis/contabilidad-analitica/route";
import {
  POST as healthPOST,
  PUT as healthPUT,
} from "@/app/api/sanidad/control/route";
import { GET as bioGET } from "@/app/api/sanidad/bioseguridad/route";
import { GET as calendarioGET } from "@/app/api/planeacion/calendario/route";
import {
  DELETE as adjuntosDELETE,
  GET as adjuntosGET,
  POST as adjuntosPOST,
} from "@/app/api/adjuntos/route";
import {
  computeIthIndex,
  resolveDivipolaMunicipality,
  resolveZoneWithFallback,
} from "@/lib/external-sources/wave1-territory-weather-market";
import { findIcaDrugByProduct } from "@/lib/external-sources/wave2-standards-sanitary-ica";
import {
  getColombianHolidaysForYear,
  getColombianHolidaysInRange,
} from "@/lib/external-sources/wave3-tax-holidays-iot";
import { mockRequest, parseJson } from "./helpers";

const DEFAULT_ADMIN_USER = {
  id: "test-user",
  username: "test",
  name: "Test User",
  role: "admin",
  farmId: "00000000-0000-0000-0000-000000000001",
};

async function withRole<T>(
  user: { id: string; username: string; name: string; role: string; farmId: string },
  fn: () => Promise<T>,
): Promise<T> {
  vi.mocked(getSessionUser).mockResolvedValue(user as never);
  try {
    return await fn();
  } finally {
    vi.mocked(getSessionUser).mockResolvedValue(DEFAULT_ADMIN_USER as never);
  }
}

describe("Integración de Fuentes Externas Offline-First (Olas 1 a 5 y catálogos manuales)", () => {
  const createdHealthIds: string[] = [];
  const createdSensorIds: string[] = [];
  const createdLocationIds: string[] = [];
  let savedSettingsSnapshot: Record<string, string> = {};

  beforeAll(async () => {
    const current = await getSettings();
    savedSettingsSnapshot = {
      "farm.country": current["farm.country"] || "Colombia",
      "farm.department": current["farm.department"] || "Cundinamarca",
      "farm.city": current["farm.city"] || "Funza",
      "farm.dane_municipality_code": current["farm.dane_municipality_code"] || "25286",
      "farm.latitude": current["farm.latitude"] || "4.7164",
      "farm.longitude": current["farm.longitude"] || "-74.212",
      "farm.altitude_meters": current["farm.altitude_meters"] || "2548",
      "external.sync_enabled": current["external.sync_enabled"] || "true",
    };
  });

  afterAll(async () => {
    if (createdHealthIds.length > 0) {
      await db.delete(healthControl).where(inArray(healthControl.id, createdHealthIds));
    }
    if (createdSensorIds.length > 0) {
      await db.delete(sensorReadings).where(inArray(sensorReadings.id, createdSensorIds));
    }
    if (createdLocationIds.length > 0) {
      await db.delete(farmLocations).where(inArray(farmLocations.id, createdLocationIds));
    }
    await updateSettings(
      Object.entries(savedSettingsSnapshot).map(([key, value]) => ({ key, value })),
      null,
    );
  });

  it("API /api/configuracion/fuentes-externas inicializa fuentes conectadas y soporta ?section=vademecum", async () => {
    const vadRes = await fuentesGET(
      mockRequest("http://localhost/api/configuracion/fuentes-externas?section=vademecum"),
    );
    expect(vadRes.status).toBe(200);
    const vadJson = await parseJson(vadRes);
    expect(Array.isArray(vadJson.vademecum)).toBe(true);
    expect(vadJson.vademecum.length).toBeGreaterThanOrEqual(15);

    const fullRes = await fuentesGET(
      mockRequest("http://localhost/api/configuracion/fuentes-externas"),
    );
    expect(fullRes.status).toBe(200);
    const fullJson = await parseJson(fullRes);
    expect(Array.isArray(fullJson.snapshots)).toBe(true);
    expect(fullJson.snapshots.length).toBeGreaterThanOrEqual(6);
    expect(fullJson.snapshots.some((snapshot: { sourceKey: string }) => snapshot.sourceKey === "ideam_hydro_alerts")).toBe(true);
    expect(fullJson.banrepSeriesCatalog.map((series: { flowId: string }) => series.flowId)).toContain("DF_IBR");
    expect(fullJson.selectedBanrepFlowIds).toContain("DF_IBR");
    const scheduledKeys = fullJson.syncSchedule.map((item: { sourceKey: string }) => item.sourceKey);
    expect(scheduledKeys).toContain("ideam_hydro_alerts");
    expect(scheduledKeys).not.toContain("ica_vademecum_alerts");
    expect(scheduledKeys).not.toContain("standards_normative_feed");
    expect(scheduledKeys).not.toContain("iot_telemetry_bridge");
    expect(fullJson.ideamHydroAlerts.datasetId).toBe("h4gs-wsmg");
    expect(fullJson.divipolaCatalog.length).toBeGreaterThanOrEqual(25);
    expect(fullJson.nutritionTables.length).toBeGreaterThanOrEqual(6);
    expect(fullJson.colombianHolidays.length).toBeGreaterThanOrEqual(17);
    expect(fullJson.taxContext?.uvtCop).toBeGreaterThan(40000);

    const dbSnapshots = await db.select().from(externalDataSnapshots);
    expect(dbSnapshots.length).toBeGreaterThanOrEqual(6);
  });

  it("Ola 1: DIVIPOLA, clima Open-Meteo/ITH, predicción de ración, curvas, alertas y precios SIPSA/TRM", async () => {
    const mun = resolveDivipolaMunicipality("Bucaramanga");
    expect(mun.daneCode).toBe("68001");
    expect(computeIthIndex(30, 75)).toBeGreaterThan(78);

    // Probar modo offline determinístico + aplicación DIVIPOLA
    await updateSettings([{ key: "external.sync_enabled", value: "false" }], null);
    try {
      const divRes = await fuentesPOST(
        mockRequest("http://localhost/api/configuracion/fuentes-externas", {
          method: "POST",
          body: { action: "apply_divipola", codeOrCity: "68001" },
        }),
      );
      expect(divRes.status).toBe(200);
      const divJson = await parseJson(divRes);
      expect(divJson.ok).toBe(true);
      expect(divJson.farmLocation.daneCode).toBe("68001");
      expect(divJson.farmLocation.department).toBe("Santander");
      expect(divJson.farmLocation.city).toBe("Bucaramanga");

      const marketRes = await fuentesPOST(
        mockRequest("http://localhost/api/configuracion/fuentes-externas", {
          method: "POST",
          body: { action: "apply_market_prices", overwriteCustom: false },
        }),
      );
      expect(marketRes.status).toBe(409);
      const marketJson = await parseJson(marketRes);
      expect(marketJson.code).toBe("manual_master_update_required");

      const predRes = await prediccionGET(
        mockRequest("http://localhost/api/produccion/alimentacion/prediccion?days=14"),
      );
      expect(predRes.status).toBe(200);
      const predJson = await parseJson(predRes);
      expect(predJson.weatherContext).toBeTruthy();
      expect(typeof predJson.weatherContext.currentIth).toBe("number");
      expect(typeof predJson.weatherContext.currentTempC).toBe("number");
      expect(typeof predJson.weatherContext.feedIntakeFactor).toBe("number");

      const curvasRes = await curvasGET(
        mockRequest("http://localhost/api/analisis/curvas?species=pollo"),
      );
      expect(curvasRes.status).toBe(200);
      const curvasJson = await parseJson(curvasRes);
      expect(curvasJson.externalWeather).toBeTruthy();
      expect(typeof curvasJson.externalWeather.currentIth).toBe("number");

      const alertasRes = await alertasGET(
        mockRequest("http://localhost/api/produccion/alertas"),
      );
      expect(alertasRes.status).toBe(200);
      const alertasJson = await parseJson(alertasRes);
      expect(Array.isArray(alertasJson)).toBe(true);
    } finally {
      await updateSettings([{ key: "external.sync_enabled", value: "true" }], null);
    }
  });

  it("Ola 2: feed genético/normativo, autocompletado ICA de retiro en Sanidad y alertas epidemiológicas", async () => {
    const [testLoc] = await db
      .insert(farmLocations)
      .values({
        code: `TEST-ICA-${Date.now()}`,
        name: "Galpón Test ICA Vademécum",
        type: "galpon",
        allowedSpecies: ["pollo", "gallina"],
        status: "activa",
      })
      .returning();
    createdLocationIds.push(testLoc.id);

    const stdRes = await fuentesPOST(
      mockRequest("http://localhost/api/configuracion/fuentes-externas", {
        method: "POST",
        body: { action: "apply_standards_feed" },
      }),
    );
    expect(stdRes.status).toBe(200);
    const stdJson = await parseJson(stdRes);
    expect(stdJson.ok).toBe(true);
    expect(stdJson.result.feedVersion).toContain("ICA");

    const icaMatch = findIcaDrugByProduct("Enrofloxacina 10% Oral", "pollo");
    expect(icaMatch).not.toBeNull();
    const expectedWithdrawal = Math.max(icaMatch!.withdrawalDaysMeat, icaMatch!.withdrawalDaysEggs);
    expect(expectedWithdrawal).toBeGreaterThan(0);

    // POST con withdrawalDays=0 debe autocompletar días de carencia, lab y vía desde Vademécum ICA
    const todayIso = new Date().toISOString().slice(0, 10);
    const hcCreateRes = await healthPOST(
      mockRequest("http://localhost/api/sanidad/control", {
        method: "POST",
        body: {
          date: todayIso,
          type: "tratamiento",
          species: "pollo",
          locationId: testLoc.id,
          description: "Prueba retiro automático ICA",
          product: "Enrofloxacina 10% Oral",
          withdrawalDays: 0,
        },
      }),
    );
    expect(hcCreateRes.status).toBe(201);
    const createdHc = await parseJson(hcCreateRes);
    createdHealthIds.push(createdHc.id);
    expect(createdHc.withdrawalDays).toBe(expectedWithdrawal);
    expect(createdHc.withdrawalUntilDate).toBeTruthy();
    expect(createdHc.vaccineLab).toBe(icaMatch!.laboratory);

    // PUT con withdrawalDays=0 sobre otro fármaco ICA también actualiza el retiro
    const hcUpdateRes = await healthPUT(
      mockRequest("http://localhost/api/sanidad/control", {
        method: "PUT",
        body: {
          id: createdHc.id,
          date: todayIso,
          type: "tratamiento",
          species: "gallina",
          locationId: testLoc.id,
          description: "Actualización fármaco ICA postura",
          product: "Amprolio 20%",
          withdrawalDays: 0,
        },
      }),
    );
    expect(hcUpdateRes.status).toBe(200);
    const updatedHc = await parseJson(hcUpdateRes);
    expect(updatedHc.withdrawalDays).toBeGreaterThanOrEqual(0);
    expect(updatedHc.vaccineLab).toBeTruthy();

    const bioRes = await bioGET(
      mockRequest("http://localhost/api/sanidad/bioseguridad"),
    );
    expect(bioRes.status).toBe(200);
    const bioJson = await parseJson(bioRes);
    expect(bioJson.summary.epidemiologicalAlertsCount).toBeGreaterThan(0);
    expect(Array.isArray(bioJson.epidemiologicalAlerts)).toBe(true);
    expect(bioJson.epidemiologicalAlerts.length).toBeGreaterThan(0);
  });

  it("Ola 3: festivos Ley 51/83 en Calendario sin sesgar cumplimiento, DIAN UVT/Finagro y puente IoT", async () => {
    const holidays2026 = getColombianHolidaysForYear(2026);
    expect(holidays2026.length).toBe(18);
    expect(holidays2026.some((h) => h.date === "2026-04-03" && h.localName === "Viernes Santo")).toBe(true);
    expect(holidays2026.some((h) => h.date === "2026-07-20")).toBe(true);

    const rangeHolidays = getColombianHolidaysInRange("2026-01-01", "2026-12-31");
    expect(rangeHolidays.length).toBe(18);

    const calRes = await calendarioGET(
      mockRequest("http://localhost/api/planeacion/calendario"),
    );
    expect(calRes.status).toBe(200);
    const calJson = await parseJson(calRes);
    const todayRoutineIds = (calJson.todayRoutineTasks as Array<{ id: string }>).map((t) => t.id);
    expect(todayRoutineIds.some((id) => id.startsWith("holiday:"))).toBe(false);
    expect(Array.isArray(calJson.allEvents)).toBe(true);

    const acctRes = await contabilidadGET(
      mockRequest("http://localhost/api/analisis/contabilidad-analitica"),
    );
    expect(acctRes.status).toBe(200);
    const acctJson = await parseJson(acctRes);
    expect(acctJson.marketBenchmarks).toBeTruthy();
    expect(acctJson.taxAndFinanceContext).toBeTruthy();
    expect(acctJson.taxAndFinanceContext.uvtCop).toBeGreaterThan(40000);
    expect(acctJson.taxAndFinanceContext.agriculturalRetentionThresholdCop).toBeGreaterThan(0);
    expect(Array.isArray(acctJson.taxAndFinanceContext.finagroLines)).toBe(true);

    await updateSettings([{ key: "external.sync_enabled", value: "false" }], null);
    try {
      const iotRes = await fuentesPOST(
        mockRequest("http://localhost/api/configuracion/fuentes-externas", {
          method: "POST",
          body: { action: "bridge_weather_to_sensors" },
        }),
      );
      expect(iotRes.status).toBe(200);
      const iotJson = await parseJson(iotRes);
      expect(iotJson.ok).toBe(true);
      expect(iotJson.result.readingId).toBeTruthy();
      createdSensorIds.push(iotJson.result.readingId);
      expect(iotJson.iotStatus.readingsLast24h).toBeGreaterThanOrEqual(1);
    } finally {
      await updateSettings([{ key: "external.sync_enabled", value: "true" }], null);
    }

    // RBAC: operario no puede ejecutar acciones POST de configuración externa
    const opRes = await withRole(
      { ...DEFAULT_ADMIN_USER, role: "operario" },
      () =>
        fuentesPOST(
          mockRequest("http://localhost/api/configuracion/fuentes-externas", {
            method: "POST",
            body: { action: "sync_wave", wave: 3 },
          }),
        ),
    );
    expect(opRes.status).toBe(403);
  });

  it("Cascada Local -> Promedio Regional -> Promedio Nacional, auto-sync por vencimiento y cambio automático por ubicación", async () => {
    // 1. Cobertura local exacta
    const localZone = resolveZoneWithFallback({ daneCode: "25286", city: "Funza", department: "Cundinamarca" });
    expect(localZone.coverageScope).toBe("local");
    expect(localZone.municipality.municipality).toBe("Funza");

    // 2. Cascada a promedio regional cuando el municipio no está en catálogo pero sí el departamento
    const regionalZone = resolveZoneWithFallback({
      daneCode: "",
      city: "Vereda El Triunfo",
      department: "Antioquia",
      country: "Colombia",
    });
    expect(regionalZone.coverageScope).toBe("regional");
    expect(regionalZone.coverageLabel).toContain("Promedio regional");
    expect(regionalZone.matchedDepartment).toBe("Antioquia");

    // 3. Cascada a promedio nacional cuando no coincide municipio ni departamento
    const nationalZone = resolveZoneWithFallback({
      daneCode: "",
      city: "Zona Desconocida",
      department: "Territorio Remoto",
      country: "Colombia",
    });
    expect(nationalZone.coverageScope).toBe("nacional");
    expect(nationalZone.coverageLabel).toContain("Promedio nacional");

    // 4. Expirar snapshot de clima manualmente y verificar que GET auto-sincronice según su periodo
    await updateSettings([{ key: "external.sync_enabled", value: "false" }], null);
    try {
      await db
        .update(externalDataSnapshots)
        .set({ expiresAt: new Date(Date.now() - 60_000) })
        .where(
          and(
            eq(externalDataSnapshots.farmId, DEFAULT_ADMIN_USER.farmId),
            eq(externalDataSnapshots.sourceKey, "open_meteo"),
          ),
        );

      const autoRes = await fuentesGET(
        mockRequest("http://localhost/api/configuracion/fuentes-externas"),
      );
      expect(autoRes.status).toBe(200);
      const autoJson = await parseJson(autoRes);
      expect(Array.isArray(autoJson.syncSchedule)).toBe(true);
      // 9 fuentes automáticas tras la ola de índices/GEIH/Banrep/IDEAM (el catálogo
      // normativo, vademécum e IoT quedan como sync manual, fuera del calendario).
      expect(autoJson.syncSchedule.length).toBe(9);
      expect(autoJson.autoRefreshedKeys).toContain("open_meteo");

      // 5. PUT /api/configuracion/parametros cambiando ciudad -> autocompleta DANE/depto y actualiza zona activa
      const putLocalRes = await parametrosPUT(
        mockRequest("http://localhost/api/configuracion/parametros", {
          method: "PUT",
          body: {
            updates: [
              { key: "farm.country", value: "Colombia" },
              { key: "farm.city", value: "Bucaramanga" },
            ],
          },
        }),
      );
      expect(putLocalRes.status).toBe(200);
      const localStateRes = await fuentesGET(
        mockRequest("http://localhost/api/configuracion/fuentes-externas"),
      );
      const localStateJson = await parseJson(localStateRes);
      expect(localStateJson.activeZone.daneCode).toBe("68001");
      expect(localStateJson.activeZone.department).toBe("Santander");
      expect(localStateJson.activeZone.coverageScope).toBe("local");

      // 6. PUT /api/configuracion/parametros con vereda sin registro directo en Antioquia -> promedio regional
      const putRegRes = await parametrosPUT(
        mockRequest("http://localhost/api/configuracion/parametros", {
          method: "PUT",
          body: {
            updates: [
              { key: "farm.country", value: "Colombia" },
              { key: "farm.department", value: "Antioquia" },
              { key: "farm.city", value: "Vereda La Esperanza" },
            ],
          },
        }),
      );
      expect(putRegRes.status).toBe(200);
      const regStateRes = await fuentesGET(
        mockRequest("http://localhost/api/configuracion/fuentes-externas"),
      );
      const regStateJson = await parseJson(regStateRes);
      expect(regStateJson.activeZone.coverageScope).toBe("regional");
      expect(regStateJson.activeZone.coverageLabel).toContain("Antioquia");
    } finally {
      await updateSettings([{ key: "external.sync_enabled", value: "true" }], null);
    }
  });

  it("Catálogo interactivo de normas, estándares y guías con referencias, checklist y prompts para Gina", async () => {
    const res = await fuentesGET(
      mockRequest("http://localhost/api/configuracion/fuentes-externas"),
    );
    expect(res.status).toBe(200);
    const json = await parseJson(res);

    expect(Array.isArray(json.normativeCatalog)).toBe(true);
    expect(json.normativeCatalog.length).toBeGreaterThanOrEqual(12);
    expect(json.normativeCatalogMeta?.version).toBeTruthy();
    expect(json.normativeCatalogMeta?.totalItems).toBe(json.normativeCatalog.length);
    expect(json.normativeCatalogMeta?.updateFrequencyLabel).toBeTruthy();
    expect(json.normativeCatalogMeta?.lastCheckedAt).toBeTruthy();

    const kinds = new Set(
      (json.normativeCatalog as Array<{ kind: string }>).map((item) => item.kind),
    );
    expect(kinds.has("norma")).toBe(true);
    expect(kinds.has("estandar")).toBe(true);
    expect(kinds.has("guia")).toBe(true);

    for (const item of json.normativeCatalog as Array<{
      id: string;
      code: string;
      sourceUrl: string;
      appRoute: string;
      keyReferences: string[];
      complianceChecklist: string[];
      ginaPrompts: string[];
    }>) {
      expect(item.id).toBeTruthy();
      expect(item.code).toBeTruthy();
      expect(item.sourceUrl).toMatch(/^https?:\/\//);
      expect(item.appRoute).toMatch(/^\/.+/);
      expect(Array.isArray(item.keyReferences) && item.keyReferences.length).toBeGreaterThan(0);
      expect(Array.isArray(item.complianceChecklist) && item.complianceChecklist.length).toBeGreaterThan(0);
      expect(Array.isArray(item.ginaPrompts) && item.ginaPrompts.length).toBeGreaterThan(0);
    }

    const sectionRes = await fuentesGET(
      mockRequest("http://localhost/api/configuracion/fuentes-externas?section=normas"),
    );
    expect(sectionRes.status).toBe(200);
    const sectionJson = await parseJson(sectionRes);
    expect(sectionJson.version).toBe(json.normativeCatalogMeta.version);
    expect(sectionJson.totalItems).toBeGreaterThanOrEqual(12);
    expect(Array.isArray(sectionJson.items)).toBe(true);
    expect(sectionJson.items.length).toBe(sectionJson.totalItems);
    expect(sectionJson.countsByKind?.norma).toBeGreaterThan(0);
    expect(sectionJson.countsByKind?.estandar).toBeGreaterThan(0);
    expect(sectionJson.countsByKind?.guia).toBeGreaterThan(0);

    const syncRes = await fuentesPOST(
      mockRequest("http://localhost/api/configuracion/fuentes-externas", {
        method: "POST",
        body: { action: "sync_source", sourceKey: "standards_normative_feed" },
      }),
    );
    expect(syncRes.status).toBe(200);
    const syncJson = await parseJson(syncRes);
    expect(syncJson.normativeCatalogMeta?.version).toBe(json.normativeCatalogMeta.version);
    expect(Array.isArray(syncJson.normativeCatalog)).toBe(true);
  });

  it("Permite incluir adjuntos PDF/imagen en normas y registrar/eliminar normas o guías propias con revinculación", async () => {
    const samplePdfDataUrl = "data:application/pdf;base64,JVBERi0xLjQKJVBERg==";

    // 1. Adjuntar soporte PDF a una norma existente del catálogo (NTC 1240)
    const directAttachRes = await adjuntosPOST(
      mockRequest("http://localhost/api/adjuntos", {
        method: "POST",
        body: {
          entityType: "normative_doc",
          entityId: "norm-ntc-1240",
          category: "norma_guia",
          fileName: "ntc-1240-resumen.pdf",
          mimeType: "application/pdf",
          sizeBytes: 128,
          dataUrl: samplePdfDataUrl,
          notes: "Copia oficial archivada",
        },
      }),
    );
    expect(directAttachRes.status).toBe(201);
    const directAttachJson = await parseJson(directAttachRes);
    expect(directAttachJson.entityType).toBe("normative_doc");
    expect(directAttachJson.entityId).toBe("norm-ntc-1240");

    // Se declara fuera del try para poder limpiar la norma propia en el finally
    // aunque el test falle a mitad: si quedara residuo en normative.custom_items_json,
    // la prueba del catálogo interactivo (que exige sourceUrl https) fallaría en la
    // siguiente corrida contra el mismo DB de test.
    let createdNormId: string | null = null;

    try {
      const listDirectRes = await adjuntosGET(
        mockRequest("http://localhost/api/adjuntos?entityType=normative_doc&entityId=norm-ntc-1240"),
      );
      expect(listDirectRes.status).toBe(200);
      const listDirectJson = await parseJson(listDirectRes);
      expect(
        (listDirectJson as Array<{ id: string }>).some((a) => a.id === directAttachJson.id),
      ).toBe(true);

      // 2. Subir adjunto en borrador y crear una norma/guía propia con revinculación automática
      const draftId = `draft_norm_${Date.now()}`;
      const draftAttachRes = await adjuntosPOST(
        mockRequest("http://localhost/api/adjuntos", {
          method: "POST",
          body: {
            entityType: "normative_doc",
            entityId: draftId,
            category: "norma_guia",
            fileName: "poe-bioseguridad-granja.pdf",
            mimeType: "application/pdf",
            sizeBytes: 128,
            dataUrl: samplePdfDataUrl,
          },
        }),
      );
      expect(draftAttachRes.status).toBe(201);
      const draftAttachJson = await parseJson(draftAttachRes);

      const addNormRes = await fuentesPOST(
        mockRequest("http://localhost/api/configuracion/fuentes-externas", {
          method: "POST",
          body: {
            action: "add_normative_item",
            code: "POE-BIO-99",
            kind: "guia",
            authority: "Protocolo Interno Granja",
            title: "Guía propia de lavado y desinfección de bebederos",
            version: "v1.0",
            species: ["gallina", "pollo"],
            moduleLabel: "Sanidad y Bioseguridad",
            appRoute: "/sanidad/bioseguridad",
            summary: "Procedimiento operativo estandarizado con soporte PDF.",
            keyReferences: ["Dosis de cloro residual 2-3 ppm"],
            complianceChecklist: ["Registrar lavado semanal en bitácora"],
            draftEntityId: draftId,
          },
        }),
      );
      expect(addNormRes.status).toBe(200);
      const addNormJson = await parseJson(addNormRes);
      expect(addNormJson.ok).toBe(true);
      const createdNormIdLocal = addNormJson.item?.id as string;
      createdNormId = createdNormIdLocal || null;
      expect(createdNormId).toBeTruthy();
      if (!createdNormId) throw new Error("No se creó el identificador de la norma personalizada.");

      // Confirmar que la referencia personalizada aparece en ?section=normas
      const sectionRes = await fuentesGET(
        mockRequest("http://localhost/api/configuracion/fuentes-externas?section=normas"),
      );
      expect(sectionRes.status).toBe(200);
      const sectionJson = await parseJson(sectionRes);
      const foundCustom = (sectionJson.items as Array<{ id: string; isCustom?: boolean; code: string }>).find(
        (i) => i.id === createdNormId,
      );
      expect(foundCustom?.code).toBe("POE-BIO-99");
      expect(foundCustom?.isCustom).toBe(true);

      // Confirmar que el adjunto del borrador quedó revinculado al id de la nueva norma
      const reboundRes = await adjuntosGET(
        mockRequest(`http://localhost/api/adjuntos?entityType=normative_doc&entityId=${encodeURIComponent(createdNormId)}`),
      );
      expect(reboundRes.status).toBe(200);
      const reboundJson = await parseJson(reboundRes);
      expect(
        (reboundJson as Array<{ id: string }>).some((a) => a.id === draftAttachJson.id),
      ).toBe(true);

      // 3. Eliminar la norma propia y confirmar cascada de adjuntos
      const delNormRes = await fuentesPOST(
        mockRequest("http://localhost/api/configuracion/fuentes-externas", {
          method: "POST",
          body: { action: "delete_normative_item", id: createdNormId },
        }),
      );
      expect(delNormRes.status).toBe(200);

      const afterDelAttachRes = await adjuntosGET(
        mockRequest(`http://localhost/api/adjuntos?entityType=normative_doc&entityId=${encodeURIComponent(createdNormId)}`),
      );
      const afterDelAttachJson = await parseJson(afterDelAttachRes);
      expect(afterDelAttachJson).toHaveLength(0);
    } finally {
      await adjuntosDELETE(
        mockRequest(`http://localhost/api/adjuntos?id=${encodeURIComponent(directAttachJson.id)}`, {
          method: "DELETE",
        }),
      );
      // Limpieza garantizada de la norma propia aunque el test haya fallado a mitad,
      // para no dejar residuo en normative.custom_items_json entre corridas.
      if (createdNormId) {
        await fuentesPOST(
          mockRequest("http://localhost/api/configuracion/fuentes-externas", {
            method: "POST",
            body: { action: "delete_normative_item", id: createdNormId },
          }),
        ).catch(() => null);
      }
    }
  });
});

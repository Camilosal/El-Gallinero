import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attachments, purchaseProducts } from "@/db/schema";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { requirePermission } from "@/lib/rbac-server";
import { getSessionUser } from "@/lib/auth";
import { getExternalSyncConfig, getSettings, getTaxAndFinanceDefaults, updateSettings } from "@/lib/settings";
import {
  COLOMBIA_DIVIPOLA_CATALOG,
  resolveZoneWithFallback,
} from "@/lib/divipola-catalog";
import {
  getNormativeCatalogWithSyncMeta,
  NORMATIVE_CATALOG_VERSION,
  type NormativeCatalogItem,
  type NormativeDocumentKind,
  type NormativeLegalBinding,
  type NormativeSourceKind,
  type NormativeVerificationStatus,
} from "@/lib/normative-catalog";
import {
  isSnapshotExpired,
  listExternalObservations,
  listExternalSnapshots,
  type ExternalSourceKey,
  type StoredExternalSnapshot,
} from "@/lib/external-sources/snapshot-store";
import {
  applyDivipolaToFarmSettings,
  syncDivipolaSnapshot,
  syncMarketPricesSnapshot,
  syncWeatherSnapshot,
  type DivipolaSnapshotPayload,
  type MarketPricesPayload,
  type WeatherSnapshotPayload,
} from "@/lib/external-sources/wave1-territory-weather-market";
import {
  applyStandardsNormativeFeedToDb,
  FEDNA_NRC_NUTRITION_TABLES,
  ICA_VETERINARY_VADEMECUM,
  REGIONAL_EPIDEMIOLOGICAL_BULLETIN,
  STANDARDS_FEED_VERSION,
  syncIcaVademecumAndAlertsSnapshot,
  syncStandardsNormativeSnapshot,
  type IcaVademecumSnapshotPayload,
  type StandardsFeedSnapshotPayload,
} from "@/lib/external-sources/wave2-standards-sanitary-ica";
import {
  bridgeWeatherToSensorReading,
  getColombianHolidaysForYear,
  syncColombianTaxAndHolidaysSnapshot,
  syncIotTelemetryStatusSnapshot,
  type IotBridgeSnapshotPayload,
  type TaxHolidaysSnapshotPayload,
} from "@/lib/external-sources/wave3-tax-holidays-iot";
import {
  BANREP_SERIES,
  parseBanrepFlowSelection,
  syncBanrepMacroSnapshot,
  type BanrepMacroSnapshotPayload,
} from "@/lib/external-sources/wave4-official-economic";
import { syncIdeamHydroAlertsSnapshot, type IdeamHydroSnapshotPayload } from "@/lib/external-sources/wave5-official-alerts";
import { syncOfficialDaneIndicesSnapshots } from "@/lib/external-sources/wave6-dane-files";
import { syncOfficialGeihSnapshot, syncOfficialSipsaISnapshot } from "@/lib/external-sources/wave7-dane-market-labor";
import { getCurrentFarmId } from "@/db/tenant-context";
import { getSipsaIProductMappingKey, parseSipsaIProductMappings } from "@/lib/external-sources/sipsa-product-mapping";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<NormativeDocumentKind, string> = {
  norma: "Norma obligatoria",
  estandar: "Estándar técnico",
  guia: "Guía de manejo",
};

function parseCustomNormativeItems(raw?: string): NormativeCatalogItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const items: NormativeCatalogItem[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const obj = entry as Record<string, unknown>;
      const id = typeof obj.id === "string" ? obj.id.trim() : "";
      const code = typeof obj.code === "string" ? obj.code.trim() : "";
      const title = typeof obj.title === "string" ? obj.title.trim() : "";
      if (!id || !code || !title) continue;
      const kind: NormativeDocumentKind =
        obj.kind === "norma" || obj.kind === "estandar" || obj.kind === "guia" ? obj.kind : "guia";
      const defaultLegalBinding: NormativeLegalBinding =
        kind === "norma"
          ? "obligatoria_legal"
          : kind === "estandar"
            ? "norma_tecnica_voluntaria"
            : "guia_tecnica";
      const legalBinding: NormativeLegalBinding =
        obj.legalBinding === "obligatoria_legal" ||
          obj.legalBinding === "norma_tecnica_voluntaria" ||
          obj.legalBinding === "estandar_referencia" ||
          obj.legalBinding === "guia_tecnica"
          ? obj.legalBinding
          : defaultLegalBinding;
      let verificationStatus: NormativeVerificationStatus =
        obj.verificationStatus === "verificado" ||
          obj.verificationStatus === "pendiente" ||
          obj.verificationStatus === "reemplazado" ||
          obj.verificationStatus === "derogado"
          ? obj.verificationStatus
          : typeof obj.lastVerifiedAt === "string" && obj.lastVerifiedAt.trim()
            ? "verificado"
            : "pendiente";
      const recordedVerifier = typeof obj.verifiedBy === "string" ? obj.verifiedBy.trim() : "";
      // Earlier custom entries were automatically labeled as verified when added.
      // They were never reviewed by a person, so keep them visibly pending.
      if (verificationStatus === "verificado" && recordedVerifier === "Registro propio de granja") {
        verificationStatus = "pendiente";
      }
      const sourceKind: NormativeSourceKind =
        obj.sourceKind === "documento_especifico" ||
          obj.sourceKind === "portal_oficial" ||
          obj.sourceKind === "norma_paga_referencia"
          ? obj.sourceKind
          : typeof obj.sourceUrl === "string" && obj.sourceUrl.trim()
            ? "documento_especifico"
            : "portal_oficial";
      items.push({
        id,
        code,
        kind,
        kindLabel: typeof obj.kindLabel === "string" && obj.kindLabel.trim() ? obj.kindLabel : KIND_LABELS[kind],
        legalBinding,
        authority: typeof obj.authority === "string" && obj.authority.trim() ? obj.authority : "Registro propio de granja",
        jurisdiction:
          typeof obj.jurisdiction === "string" && obj.jurisdiction.trim()
            ? obj.jurisdiction
            : "Registro propio de granja",
        applicableScope:
          typeof obj.applicableScope === "string" && obj.applicableScope.trim()
            ? obj.applicableScope
            : "Uso interno de granja según registro documental",
        title,
        version: typeof obj.version === "string" && obj.version.trim() ? obj.version : "Vigente",
        publishedAt: typeof obj.publishedAt === "string" && obj.publishedAt.trim() ? obj.publishedAt : undefined,
        effectiveFrom: typeof obj.effectiveFrom === "string" && obj.effectiveFrom.trim() ? obj.effectiveFrom : undefined,
        lastVerifiedAt:
          verificationStatus !== "pendiente" && typeof obj.lastVerifiedAt === "string" && obj.lastVerifiedAt.trim()
            ? obj.lastVerifiedAt
            : null,
        verifiedBy:
          verificationStatus !== "pendiente" && recordedVerifier && recordedVerifier !== "Registro propio de granja"
            ? recordedVerifier
            : null,
        verificationStatus,
        verificationNote:
          typeof obj.verificationNote === "string" && obj.verificationNote.trim()
            ? obj.verificationNote
            : undefined,
        updateFrequencyLabel:
          typeof obj.updateFrequencyLabel === "string" && obj.updateFrequencyLabel.trim()
            ? obj.updateFrequencyLabel
            : "Documento propio / adjunto",
        species: Array.isArray(obj.species) && obj.species.length > 0 ? obj.species.map(String) : ["todas"],
        module: typeof obj.module === "string" && obj.module.trim() ? obj.module : "general",
        moduleLabel:
          typeof obj.moduleLabel === "string" && obj.moduleLabel.trim()
            ? obj.moduleLabel
            : "Gestión Interna",
        appRoute:
          typeof obj.appRoute === "string" && obj.appRoute.startsWith("/")
            ? obj.appRoute
            : "/configuracion/catalogos?tab=normas",
        appRouteLabel:
          typeof obj.appRouteLabel === "string" && obj.appRouteLabel.trim()
            ? obj.appRouteLabel
            : "Ver en Catálogos",
        sourceUrl: typeof obj.sourceUrl === "string" ? obj.sourceUrl.trim() : "",
        sourceLabel:
          typeof obj.sourceLabel === "string" && obj.sourceLabel.trim()
            ? obj.sourceLabel
            : "Fuente externa / documental",
        sourceKind,
        summary: typeof obj.summary === "string" ? obj.summary : "",
        keyReferences: Array.isArray(obj.keyReferences) ? obj.keyReferences.map(String).filter(Boolean) : [],
        complianceChecklist: Array.isArray(obj.complianceChecklist)
          ? obj.complianceChecklist.map(String).filter(Boolean)
          : [],
        ginaPrompts:
          Array.isArray(obj.ginaPrompts) && obj.ginaPrompts.length > 0
            ? obj.ginaPrompts.map(String).filter(Boolean)
            : [`¿Cómo aplico "${code} — ${title}" en mi granja?`],
        isCustom: true,
      });
    }
    return items;
  } catch {
    return [];
  }
}

const ALL_SOURCE_KEYS: ExternalSourceKey[] = [
  "divipola_dane",
  "open_meteo",
  "dane_sipsa_trm",
  "dane_price_indices",
  "dane_sipsa_i",
  "dane_labor_geih",
  "banrep_sdmx",
  "ideam_hydro_alerts",
  "colombia_tax_holidays",
];

// Fuentes con sincronización manual (sync_source) además del ciclo automático:
// el catálogo normativo versionado, el vademécum ICA y el puente IoT se refrescan
// bajo demanda desde la UI aunque no entren en el auto-sync por vencimiento.
const SYNCABLE_SOURCE_KEYS: ExternalSourceKey[] = [
  ...ALL_SOURCE_KEYS,
  "standards_normative_feed",
  "ica_vademecum_alerts",
  "iot_telemetry_bridge",
];

const ZONE_DEPENDENT_KEYS = new Set<ExternalSourceKey>([
  "divipola_dane",
  "open_meteo",
  "dane_sipsa_trm",
  "dane_sipsa_i",
  "ica_vademecum_alerts",
]);

function formatPeriodLabel(hours: number): string {
  if (hours <= 1) return "Cada 1 hora";
  if (hours < 24) return `Cada ${hours} horas`;
  if (hours === 24) return "Diario (cada 24 h)";
  const days = Math.round(hours / 24);
  if (days === 7) return "Semanal (cada 7 días)";
  if (days === 14) return "Quincenal (cada 14 días)";
  return `Cada ${days} días`;
}

function getSourceScheduleDefinitions(syncConfig: {
  weatherTtlHours: number;
  marketTtlHours: number;
}) {
  const weatherH = Math.max(1, syncConfig.weatherTtlHours || 3);
  const marketH = Math.max(1, syncConfig.marketTtlHours || 12);
  return [
    {
      sourceKey: "open_meteo" as ExternalSourceKey,
      label: "Clima e índice ITH en galpón (Open-Meteo)",
      domainLabel: "Clima y estrés térmico",
      periodHours: weatherH,
      periodLabel: formatPeriodLabel(weatherH),
    },
    {
      sourceKey: "dane_sipsa_trm" as ExternalSourceKey,
      label: "Precios mayoristas DANE SIPSA-P y TRM de la SFC",
      domainLabel: "Mercado e insumos",
      periodHours: marketH,
      periodLabel: formatPeriodLabel(marketH),
    },
    {
      sourceKey: "dane_price_indices" as ExternalSourceKey,
      label: "Índices de precios DANE (IPC e IPP · anexos XLSX)",
      domainLabel: "Macroeconomía y costos",
      periodHours: 24 * 5,
      periodLabel: "Cada 5 días",
    },
    {
      sourceKey: "dane_sipsa_i" as ExternalSourceKey,
      label: "Precios de insumos y factores DANE SIPSA-I (anexo XLSX)",
      domainLabel: "Precios de insumos agropecuarios",
      periodHours: 24 * 5,
      periodLabel: "Cada 5 días",
    },
    {
      sourceKey: "dane_labor_geih" as ExternalSourceKey,
      label: "Indicadores laborales DANE GEIH (anexo XLSX)",
      domainLabel: "Mercado laboral",
      periodHours: 24 * 5,
      periodLabel: "Cada 5 días",
    },
    {
      sourceKey: "banrep_sdmx" as ExternalSourceKey,
      label: "Series macroeconómicas Banco de la República (SDMX)",
      domainLabel: "Macroeconomía y financiación",
      periodHours: 24,
      periodLabel: "Diario (cada 24 h)",
    },
    {
      sourceKey: "ideam_hydro_alerts" as ExternalSourceKey,
      label: "Alertas hidrológicas IDEAM (CSV oficial)",
      domainLabel: "Riesgo climático oficial",
      periodHours: 3,
      periodLabel: "Cada 3 horas",
    },
    {
      sourceKey: "colombia_tax_holidays" as ExternalSourceKey,
      label: "Festivos de referencia Nager.Date (no oficial) y parámetros fiscales locales",
      domainLabel: "Calendario de referencia",
      periodHours: 24 * 7,
      periodLabel: "Semanal (cada 7 días)",
    },
    {
      sourceKey: "divipola_dane" as ExternalSourceKey,
      label: "Territorio municipal y pisos térmicos DIVIPOLA DANE",
      domainLabel: "Localización oficial",
      periodHours: 24 * 14,
      periodLabel: "Quincenal (cada 14 días)",
    },
  ];
}

async function syncSingleSource(key: ExternalSourceKey, forceRefresh: boolean) {
  switch (key) {
    case "divipola_dane":
      return syncDivipolaSnapshot({ forceRefresh });
    case "open_meteo":
      return syncWeatherSnapshot({ forceRefresh });
    case "dane_sipsa_trm":
      return syncMarketPricesSnapshot({ forceRefresh });
    case "dane_price_indices":
      return syncOfficialDaneIndicesSnapshots({ forceRefresh });
    case "dane_sipsa_i":
      return syncOfficialSipsaISnapshot({ forceRefresh });
    case "dane_labor_geih":
      return syncOfficialGeihSnapshot({ forceRefresh });
    case "banrep_sdmx":
      return syncBanrepMacroSnapshot({ forceRefresh });
    case "ideam_hydro_alerts":
      return syncIdeamHydroAlertsSnapshot({ forceRefresh });
    case "standards_normative_feed":
      return syncStandardsNormativeSnapshot({ forceRefresh });
    case "ica_vademecum_alerts":
      return syncIcaVademecumAndAlertsSnapshot({ forceRefresh });
    case "colombia_tax_holidays":
      return syncColombianTaxAndHolidaysSnapshot({ forceRefresh });
    case "iot_telemetry_bridge":
      return syncIotTelemetryStatusSnapshot({ forceRefresh });
  }
}

async function syncByWave(wave: number, forceRefresh: boolean) {
  if (wave === 1) {
    await Promise.all([
      syncDivipolaSnapshot({ forceRefresh }).catch(() => null),
      syncWeatherSnapshot({ forceRefresh }).catch(() => null),
      syncMarketPricesSnapshot({ forceRefresh }).catch(() => null),
    ]);
    return;
  }
  if (wave === 2) {
    await Promise.all([
      syncStandardsNormativeSnapshot({ forceRefresh }).catch(() => null),
      syncIcaVademecumAndAlertsSnapshot({ forceRefresh }).catch(() => null),
    ]);
    return;
  }
  if (wave === 3) {
    await Promise.all([
      syncColombianTaxAndHolidaysSnapshot({ forceRefresh }).catch(() => null),
      syncIotTelemetryStatusSnapshot({ forceRefresh }).catch(() => null),
    ]);
    return;
  }
  if (wave === 4) {
    await syncBanrepMacroSnapshot({ forceRefresh }).catch(() => null);
    return;
  }
  if (wave === 5) {
    await syncIdeamHydroAlertsSnapshot({ forceRefresh }).catch(() => null);
    return;
  }
  if (wave === 6) {
    await syncOfficialDaneIndicesSnapshots({ forceRefresh }).catch(() => null);
    return;
  }
  if (wave === 7) {
    await Promise.all([
      syncOfficialSipsaISnapshot({ forceRefresh }).catch(() => null),
      syncOfficialGeihSnapshot({ forceRefresh }).catch(() => null),
    ]);
  }
}

function normalizeCmp(value: unknown): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isZoneSnapshotStale(
  snap: StoredExternalSnapshot,
  settings: Record<string, string>,
): boolean {
  const payload = snap.payload as Record<string, unknown> | undefined;
  if (!payload) return true;

  if (snap.sourceKey === "ica_vademecum_alerts") {
    const snapDept = normalizeCmp(payload.department);
    const farmZone = resolveZoneWithFallback({
      daneCode: settings["farm.dane_municipality_code"],
      city: settings["farm.city"],
      department: settings["farm.department"],
      country: settings["farm.country"],
    });
    return snapDept !== normalizeCmp(farmZone.matchedDepartment);
  }

  const ref = payload.configuredFarmZone as Record<string, unknown> | undefined;
  if (!ref) return true;

  return (
    normalizeCmp(ref.country) !== normalizeCmp(settings["farm.country"] || "Colombia") ||
    normalizeCmp(ref.department) !== normalizeCmp(settings["farm.department"] || "") ||
    normalizeCmp(ref.city) !== normalizeCmp(settings["farm.city"] || "") ||
    normalizeCmp(ref.daneCode) !== normalizeCmp(settings["farm.dane_municipality_code"] || "")
  );
}

async function ensureMissingOrRefresh(forceRefresh = false): Promise<{
  refreshedKeys: string[];
}> {
  const [existing, settings] = await Promise.all([
    listExternalSnapshots(),
    getSettings(),
  ]);
  // El auto-sync por vencimiento sana snapshots expirados aunque el toggle
  // external.sync_enabled esté apagado: cada conector respeta ese toggle antes
  // de tocar la red y cae al último dato válido/estimado si está desactivado.
  const byKey = new Map(existing.map((s) => [s.sourceKey as ExternalSourceKey, s]));
  const keysToSync: ExternalSourceKey[] = [];

  for (const key of ALL_SOURCE_KEYS) {
    const snap = byKey.get(key);
    const expired = !snap || isSnapshotExpired(snap);
    const normativeOutdated =
      key === "standards_normative_feed" &&
      Boolean(snap) &&
      ((snap!.payload as StandardsFeedSnapshotPayload | undefined)?.normativeCatalogVersion !== NORMATIVE_CATALOG_VERSION ||
        !Array.isArray((snap!.payload as StandardsFeedSnapshotPayload | undefined)?.normativeCatalog));
    const zoneStale =
      Boolean(snap) &&
      ZONE_DEPENDENT_KEYS.has(key) &&
      isZoneSnapshotStale(snap!, settings);

    if (forceRefresh || expired || normativeOutdated || zoneStale) {
      keysToSync.push(key);
    }
  }

  if (keysToSync.length > 0) {
    await Promise.allSettled(
      keysToSync.map((k) => {
        const snap = byKey.get(k);
        const normativeOutdated =
          k === "standards_normative_feed" &&
          Boolean(snap) &&
          ((snap!.payload as StandardsFeedSnapshotPayload | undefined)?.normativeCatalogVersion !== NORMATIVE_CATALOG_VERSION ||
            !Array.isArray((snap!.payload as StandardsFeedSnapshotPayload | undefined)?.normativeCatalog));
        const shouldForce =
          forceRefresh ||
          isSnapshotExpired(snap) ||
          normativeOutdated ||
          (snap ? isZoneSnapshotStale(snap, settings) : false);
        return syncSingleSource(k, shouldForce);
      }),
    );
  }

  return { refreshedKeys: keysToSync };
}

async function buildStateResponse(options?: {
  forceRefresh?: boolean;
  refreshedKeys?: string[];
}) {
  const syncResult = await ensureMissingOrRefresh(Boolean(options?.forceRefresh));

  const [snapshots, settings, syncConfig, taxDefaults, marketHistory, banrepHistory, sipsaIHistory, daneIndexHistory, daneLaborHistory] = await Promise.all([
    listExternalSnapshots(),
    getSettings(),
    getExternalSyncConfig(),
    getTaxAndFinanceDefaults(),
    listExternalObservations("dane_sipsa_trm", 200),
    listExternalObservations("banrep_sdmx", 300),
    listExternalObservations("dane_sipsa_i", 5000),
    listExternalObservations("dane_price_indices", 300),
    listExternalObservations("dane_labor_geih", 300),
  ]);
  const sortedMarketHistory = marketHistory
    .sort((a, b) => new Date(b.observedAt).getTime() - new Date(a.observedAt).getTime())
    .slice(0, 200);

  const byKey = new Map(snapshots.map((s) => [s.sourceKey, s]));
  const currentYear = new Date().getUTCFullYear();
  const taxSnap = byKey.get("colombia_tax_holidays") as StoredExternalSnapshot<TaxHolidaysSnapshotPayload> | undefined;
  const icaSnap = byKey.get("ica_vademecum_alerts") as StoredExternalSnapshot<IcaVademecumSnapshotPayload> | undefined;
  const iotSnap = byKey.get("iot_telemetry_bridge") as StoredExternalSnapshot<IotBridgeSnapshotPayload> | undefined;
  const divipolaSnap = byKey.get("divipola_dane") as StoredExternalSnapshot<DivipolaSnapshotPayload> | undefined;
  const weatherSnap = byKey.get("open_meteo") as StoredExternalSnapshot<WeatherSnapshotPayload> | undefined;
  const marketSnap = byKey.get("dane_sipsa_trm") as StoredExternalSnapshot<MarketPricesPayload> | undefined;
  const standardsSnap = byKey.get("standards_normative_feed") as StoredExternalSnapshot<StandardsFeedSnapshotPayload> | undefined;
  const banrepSnap = byKey.get("banrep_sdmx") as StoredExternalSnapshot<BanrepMacroSnapshotPayload> | undefined;
  const ideamSnap = byKey.get("ideam_hydro_alerts") as StoredExternalSnapshot<IdeamHydroSnapshotPayload> | undefined;
  const customNormativeItems = parseCustomNormativeItems(settings["normative.custom_items_json"]);
  const farmPurchaseProducts = await db
    .select({
      id: purchaseProducts.id,
      name: purchaseProducts.name,
      expenseCategory: purchaseProducts.expenseCategory,
      defaultPresentation: purchaseProducts.defaultPresentation,
      defaultUnit: purchaseProducts.defaultUnit,
    })
    .from(purchaseProducts)
    .where(and(eq(purchaseProducts.farmId, getCurrentFarmId()), eq(purchaseProducts.isActive, true)))
    .orderBy(purchaseProducts.name);
  const activePurchaseProductIds = new Set(farmPurchaseProducts.map((product) => product.id));
  const sipsaIProductMappings = Object.fromEntries(
    Object.entries(parseSipsaIProductMappings(settings["external.sipsa_i_product_mappings_json"]))
      .filter(([, productId]) => activePurchaseProductIds.has(productId)),
  );
  const normativeMeta = getNormativeCatalogWithSyncMeta(
    standardsSnap?.fetchedAt ? new Date(standardsSnap.fetchedAt).toISOString().slice(0, 10) : null,
    customNormativeItems,
    null,
  );

  const activeZoneResolution = resolveZoneWithFallback({
    daneCode: settings["farm.dane_municipality_code"],
    city: settings["farm.city"],
    department: settings["farm.department"],
    country: settings["farm.country"],
  });

  const scheduleDefs = getSourceScheduleDefinitions(syncConfig);
  const syncSchedule = scheduleDefs.map((def) => {
    const snap = byKey.get(def.sourceKey);
    const payload = (snap?.payload || {}) as Record<string, unknown>;
    return {
      sourceKey: def.sourceKey,
      label: def.label,
      domainLabel: def.domainLabel,
      periodHours: def.periodHours,
      periodLabel: def.periodLabel,
      status: snap?.status || "fallback",
      providerName: snap?.providerName || def.label,
      summary: snap?.summary || null,
      fetchedAt: snap?.fetchedAt || null,
      expiresAt: snap?.expiresAt || null,
      isExpired: isSnapshotExpired(snap),
      coverageScope: (payload.coverageScope as string | undefined) || activeZoneResolution.coverageScope,
      coverageLabel: (payload.coverageLabel as string | undefined) || activeZoneResolution.coverageLabel,
    };
  });

  const holidays = taxSnap?.payload?.holidays || getColombianHolidaysForYear(currentYear);
  const todayIso = new Date().toISOString().slice(0, 10);

  return {
    snapshots,
    marketHistory: sortedMarketHistory,
    banrepHistory,
    sipsaIHistory,
    sipsaIProductMappings,
    sipsaIPurchaseProducts: farmPurchaseProducts,
    daneIndexHistory,
    daneLaborHistory,
    banrepMacro: banrepSnap?.payload || { schemaVersion: 1, series: [], note: "Sin datos SDMX consultados." },
    banrepSeriesCatalog: BANREP_SERIES.map(({ flowId, label, unitLabel }) => ({ flowId, label, unitLabel })),
    selectedBanrepFlowIds: parseBanrepFlowSelection(settings["external.banrep_series_json"]),
    ideamHydroAlerts: ideamSnap?.payload || {
      datasetId: "h4gs-wsmg",
      datasetName: "Alertas hidrológicas vigentes · IDEAM",
      coverageScope: "nacional",
      coverageLabel: "Nacional · Alertas hidrológicas IDEAM",
      metadataUpdatedAt: null,
      alerts: [],
      note: "Aún no se han consultado alertas hidrológicas oficiales.",
    },
    syncSchedule,
    autoRefreshedKeys: options?.refreshedKeys || syncResult.refreshedKeys,
    farmLocation: {
      country: settings["farm.country"] || "Colombia",
      department: settings["farm.department"] || activeZoneResolution.matchedDepartment,
      city: settings["farm.city"] || activeZoneResolution.municipality.municipality,
      daneCode: settings["farm.dane_municipality_code"] || activeZoneResolution.municipality.daneCode,
      latitude: settings["farm.latitude"] || String(activeZoneResolution.municipality.latitude),
      longitude: settings["farm.longitude"] || String(activeZoneResolution.municipality.longitude),
      altitudeMeters: settings["farm.altitude_meters"] || String(activeZoneResolution.municipality.altitudeMeters),
    },
    activeZone: {
      country: settings["farm.country"] || "Colombia",
      department: settings["farm.department"] || activeZoneResolution.matchedDepartment,
      city: settings["farm.city"] || activeZoneResolution.municipality.municipality,
      daneCode: settings["farm.dane_municipality_code"] || activeZoneResolution.municipality.daneCode,
      region: activeZoneResolution.matchedRegion,
      matchedDepartment: activeZoneResolution.matchedDepartment,
      thermalFloor: activeZoneResolution.municipality.thermalFloor,
      altitudeMeters: activeZoneResolution.municipality.altitudeMeters,
      nearestMarketHub: activeZoneResolution.municipality.nearestMarketHub,
      coverageScope: activeZoneResolution.coverageScope,
      coverageLabel: activeZoneResolution.coverageLabel,
      periodLabel: activeZoneResolution.periodLabel,
      weatherCoverageLabel: weatherSnap?.payload?.coverageLabel || activeZoneResolution.coverageLabel,
      marketCoverageLabel: marketSnap?.payload?.coverageLabel || activeZoneResolution.coverageLabel,
      icaCoverageLabel: icaSnap?.payload?.coverageLabel || activeZoneResolution.coverageLabel,
      divipolaCoverageLabel: divipolaSnap?.payload?.coverageLabel || activeZoneResolution.coverageLabel,
    },
    syncConfig,
    standardsFeedVersion: STANDARDS_FEED_VERSION,
    normativeCatalog: normativeMeta.items,
    normativeCatalogMeta: {
      version: standardsSnap?.payload?.normativeCatalogVersion || normativeMeta.version,
      lastSyncAt:
        standardsSnap?.payload?.normativeLastCheckedAt || standardsSnap?.fetchedAt || normativeMeta.lastSyncAt,
      lastSourceCheckedAt: null,
      lastCheckedAt:
        standardsSnap?.payload?.normativeLastCheckedAt || standardsSnap?.fetchedAt || normativeMeta.lastCheckedAt,
      updateFrequencyLabel: normativeMeta.updateFrequencyLabel,
      totalItems: normativeMeta.totalItems,
      verifiedCount: normativeMeta.verifiedCount,
      pendingCount: normativeMeta.pendingCount,
      countsByKind: normativeMeta.countsByKind,
    },
    divipolaCatalog: COLOMBIA_DIVIPOLA_CATALOG,
    icaVademecum: ICA_VETERINARY_VADEMECUM,
    epidemiologicalAlerts: icaSnap?.payload?.alerts || REGIONAL_EPIDEMIOLOGICAL_BULLETIN,
    nutritionTables: FEDNA_NRC_NUTRITION_TABLES,
    colombianHolidays: holidays,
    taxContext: taxSnap?.payload || {
      year: currentYear,
      uvtCop: taxDefaults.uvtCop,
      reteComprasThresholdUvt: taxDefaults.reteComprasThresholdUvt,
      reteAgroThresholdUvt: taxDefaults.reteAgroThresholdUvt,
      retentionPurchasesThresholdCop: Math.round(taxDefaults.uvtCop * taxDefaults.reteComprasThresholdUvt),
      retentionAgroThresholdCop: Math.round(taxDefaults.uvtCop * taxDefaults.reteAgroThresholdUvt),
      finagroIbrEaPct: taxDefaults.finagroIbrEaPct,
      finagroLines: [],
      nextHoliday: holidays.find((h) => h.date >= todayIso) || holidays[0] || null,
      holidaysCount: holidays.length,
    },
    iotStatus: iotSnap?.payload || null,
  };
}

/** GET /api/configuracion/fuentes-externas */
export const GET = withApiHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section");
  const refresh = searchParams.get("refresh") === "1";

  if (section === "vademecum") {
    return NextResponse.json({
      vademecum: ICA_VETERINARY_VADEMECUM,
      epidemiologicalAlerts: REGIONAL_EPIDEMIOLOGICAL_BULLETIN,
    });
  }

  if (section === "normas") {
    const [existing, settings] = await Promise.all([
      listExternalSnapshots(),
      getSettings(),
    ]);
    const standardsSnap = existing.find((s) => s.sourceKey === "standards_normative_feed");
    const customNormativeItems = parseCustomNormativeItems(settings["normative.custom_items_json"]);
    const syncDate = standardsSnap?.fetchedAt
      ? new Date(standardsSnap.fetchedAt).toISOString().slice(0, 10)
      : null;
    return NextResponse.json(
      getNormativeCatalogWithSyncMeta(syncDate, customNormativeItems, null),
    );
  }

  const state = await buildStateResponse({ forceRefresh: refresh });
  return NextResponse.json(state);
});

/** POST /api/configuracion/fuentes-externas */
export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;

  const body = await safeParseJson(req);
  const action = String(body.action || "").trim();

  if (action === "sync_all") {
    const syncResult = await ensureMissingOrRefresh(true);
    return NextResponse.json({
      ok: true,
      action,
      refreshedKeys: syncResult.refreshedKeys,
      ...(await buildStateResponse({ refreshedKeys: syncResult.refreshedKeys })),
    });
  }

  if (action === "auto_sync_due") {
    const syncResult = await ensureMissingOrRefresh(false);
    return NextResponse.json({
      ok: true,
      action,
      refreshedKeys: syncResult.refreshedKeys,
      ...(await buildStateResponse({ refreshedKeys: syncResult.refreshedKeys })),
    });
  }

  if (action === "sync_source") {
    const sourceKey = String(body.sourceKey || "") as ExternalSourceKey;
    if (!SYNCABLE_SOURCE_KEYS.includes(sourceKey)) {
      return NextResponse.json({ error: "Fuente externa no válida" }, { status: 400 });
    }
    const updated = await syncSingleSource(sourceKey, true);
    return NextResponse.json({
      ok: true,
      action,
      updated,
      ...(await buildStateResponse()),
    });
  }

  if (action === "set_banrep_series") {
    const requested = body.flowIds;
    const allowed = new Set<string>(BANREP_SERIES.map((series) => series.flowId));
    if (
      !Array.isArray(requested) ||
      requested.length === 0 ||
      requested.length > BANREP_SERIES.length ||
      requested.some((flowId) => typeof flowId !== "string" || !allowed.has(flowId))
    ) {
      return NextResponse.json({ error: "Seleccione al menos una serie SDMX válida del catálogo permitido." }, { status: 400 });
    }
    const selected = [...new Set(requested as string[])];
    const user = await getSessionUser();
    await updateSettings(
      [{ key: "external.banrep_series_json", value: JSON.stringify(selected) }],
      user?.id ?? null,
    );
    const updated = await syncBanrepMacroSnapshot({ forceRefresh: true, selectedFlowIds: selected });
    return NextResponse.json({
      ok: true,
      action,
      updated,
      ...(await buildStateResponse()),
    });
  }

  if (action === "save_sipsa_i_mappings") {
    const submitted = body.mappings;
    if (!submitted || typeof submitted !== "object" || Array.isArray(submitted)) {
      return NextResponse.json({ error: "Las equivalencias SIPSA-I deben enviarse como un objeto." }, { status: 400 });
    }
    const entries = Object.entries(submitted as Record<string, unknown>);
    if (entries.length > 1000) {
      return NextResponse.json({ error: "Se enviaron demasiadas equivalencias SIPSA-I." }, { status: 400 });
    }
    if (entries.some(([key, value]) => key.length > 1000 || typeof value !== "string" || value.length > 100)) {
      return NextResponse.json({ error: "Una equivalencia SIPSA-I tiene un formato inválido." }, { status: 400 });
    }

    const [settings, observations] = await Promise.all([
      getSettings(),
      listExternalObservations("dane_sipsa_i", 5000),
    ]);
    const existingMappings = parseSipsaIProductMappings(settings["external.sipsa_i_product_mappings_json"]);
    const knownKeys = new Set<string>(Object.keys(existingMappings));
    for (const observation of observations) {
      const key = getSipsaIProductMappingKey((observation.dimensions || {}) as Record<string, unknown>);
      if (key) knownKeys.add(key);
    }
    if (entries.some(([key]) => !knownKeys.has(key))) {
      return NextResponse.json({ error: "Una equivalencia no corresponde a un producto SIPSA-I importado en esta granja." }, { status: 400 });
    }

    const mappings = Object.fromEntries(entries.filter(([, value]) => Boolean(value))) as Record<string, string>;
    const productIds = [...new Set(Object.values(mappings))];
    if (productIds.length > 0) {
      const validProducts = await db
        .select({ id: purchaseProducts.id })
        .from(purchaseProducts)
        .where(and(
          eq(purchaseProducts.farmId, getCurrentFarmId()),
          eq(purchaseProducts.isActive, true),
          inArray(purchaseProducts.id, productIds),
        ));
      if (validProducts.length !== productIds.length) {
        return NextResponse.json({ error: "Cada producto local debe estar activo y pertenecer a esta granja." }, { status: 400 });
      }
    }

    const user = await getSessionUser();
    await updateSettings(
      [{ key: "external.sipsa_i_product_mappings_json", value: JSON.stringify(mappings) }],
      user?.id ?? null,
    );
    return NextResponse.json({ ok: true, action, ...(await buildStateResponse()) });
  }

  if (action === "sync_wave") {
    const wave = Number(body.wave);
    if (![1, 2, 3, 4, 5, 6, 7].includes(wave)) {
      return NextResponse.json({ error: "Grupo de sincronización no válido" }, { status: 400 });
    }
    await syncByWave(wave, true);
    return NextResponse.json({
      ok: true,
      action,
      wave,
      ...(await buildStateResponse()),
    });
  }

  if (action === "apply_divipola") {
    const codeOrCity = String(body.codeOrCity || body.daneCode || "").trim();
    if (!codeOrCity) {
      return NextResponse.json({ error: "Seleccione un código DANE o municipio DIVIPOLA" }, { status: 400 });
    }
    const user = await getSessionUser();
    const res = await applyDivipolaToFarmSettings(codeOrCity, user?.id ?? null);
    await syncIcaVademecumAndAlertsSnapshot({ forceRefresh: true }).catch(() => null);
    return NextResponse.json({
      ok: true,
      action,
      result: {
        municipality: res.municipality,
        weatherSummary: res.weather.summary,
        marketSummary: res.market.summary,
      },
      ...(await buildStateResponse()),
    });
  }

  if (action === "apply_market_prices") {
    return NextResponse.json({
      action,
      error: "Las observaciones externas son referencias. Revise el dato y actualice el precio maestro manualmente para conservar trazabilidad y control.",
      code: "manual_master_update_required",
    }, { status: 409 });
  }

  if (action === "apply_standards_feed") {
    const result = await applyStandardsNormativeFeedToDb();
    return NextResponse.json({
      ok: true,
      action,
      result: {
        addedWeightPoints: result.addedWeightPoints,
        addedVaccineTemplates: result.addedVaccineTemplates,
        feedVersion: result.snapshot.payload.feedVersion,
      },
      ...(await buildStateResponse()),
    });
  }

  if (action === "bridge_weather_to_sensors") {
    const locationId = body.locationId ? String(body.locationId) : null;
    const result = await bridgeWeatherToSensorReading(locationId);
    return NextResponse.json({
      ok: true,
      action,
      result: {
        readingId: result.reading?.id,
        ithIndex: result.reading?.ithIndex,
        alertTriggered: result.reading?.alertTriggered,
      },
      ...(await buildStateResponse()),
    });
  }

  if (action === "add_normative_item") {
    const code = String(body.code || "").trim();
    const title = String(body.title || "").trim();
    if (!code || !title) {
      return NextResponse.json(
        { error: "El código y el título de la norma, estándar o guía son obligatorios." },
        { status: 400 },
      );
    }

    const kindRaw = String(body.kind || "guia").trim();
    const kind: NormativeDocumentKind =
      kindRaw === "norma" || kindRaw === "estandar" || kindRaw === "guia" ? kindRaw : "guia";
    const authority = String(body.authority || "").trim() || "Protocolo interno / documental";
    const version = String(body.version || "").trim() || `Edición ${new Date().getUTCFullYear()}`;
    const summary = String(body.summary || "").trim() || title;
    const sourceUrl = String(body.sourceUrl || "").trim();
    const sourceLabel = String(body.sourceLabel || "").trim() || authority;
    const moduleLabel = String(body.moduleLabel || "").trim() || "Gestión y Bioseguridad";
    const appRoute = String(body.appRoute || "").trim().startsWith("/")
      ? String(body.appRoute).trim()
      : "/sanidad/bioseguridad";
    const appRouteLabel = String(body.appRouteLabel || "").trim() || "Ir al módulo";
    const draftEntityId = String(body.draftEntityId || "").trim();

    const toStringArray = (val: unknown): string[] => {
      if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
      if (typeof val === "string") {
        return val
          .split(/\r?\n|;/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      return [];
    };

    const species = toStringArray(body.species);
    const keyReferences = toStringArray(body.keyReferences);
    const complianceChecklist = toStringArray(body.complianceChecklist);

    const newItem: NormativeCatalogItem = {
      id: `custom-norm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code,
      kind,
      kindLabel: KIND_LABELS[kind],
      legalBinding:
        kind === "norma"
          ? "obligatoria_legal"
          : kind === "estandar"
            ? "estandar_referencia"
            : "guia_tecnica",
      authority,
      jurisdiction: "Colombia",
      title,
      version,
      applicableScope: "Referencia registrada manualmente por la granja.",
      lastVerifiedAt: null,
      verifiedBy: null,
      verificationStatus: "pendiente",
      verificationNote: "Pendiente de revisión humana contra la fuente y versión del documento.",
      sourceKind: "documento_especifico",
      updateFrequencyLabel: "Manual / con soportes adjuntos",
      species: species.length > 0 ? species : ["todas"],
      module: "personalizado",
      moduleLabel,
      appRoute,
      appRouteLabel,
      sourceUrl,
      sourceLabel,
      summary,
      keyReferences: keyReferences.length > 0 ? keyReferences : [summary],
      complianceChecklist: complianceChecklist.length > 0 ? complianceChecklist : [`Verificar cumplimiento de ${code} en galpón.`],
      ginaPrompts: [
        `Explícame en detalle "${code} — ${title}" y qué debo verificar según esta referencia.`,
      ],
      isCustom: true,
    };

    const [settings, user] = await Promise.all([getSettings(), getSessionUser()]);
    const existingCustom = parseCustomNormativeItems(settings["normative.custom_items_json"]);
    const updatedCustom = [newItem, ...existingCustom];

    await updateSettings(
      [{ key: "normative.custom_items_json", value: JSON.stringify(updatedCustom) }],
      user?.id ?? null,
    );

    if (draftEntityId) {
      await db
        .update(attachments)
        .set({ entityId: newItem.id })
        .where(
          and(
            eq(attachments.entityType, "normative_doc"),
            eq(attachments.entityId, draftEntityId),
          ),
        );
    }

    return NextResponse.json({
      ok: true,
      action,
      item: newItem,
      ...(await buildStateResponse()),
    });
  }

  if (action === "review_normative_item") {
    const id = String(body.id || "").trim();
    const requestedStatus = String(body.status || "").trim() as NormativeVerificationStatus;
    const note = String(body.note || "").trim();
    const allowedStatuses: NormativeVerificationStatus[] = ["pendiente", "verificado", "reemplazado", "derogado"];
    if (!id || !allowedStatuses.includes(requestedStatus)) {
      return NextResponse.json({ error: "Indica una referencia propia y un estado de revisión válido." }, { status: 400 });
    }
    if (note.length < 10 || note.length > 1000) {
      return NextResponse.json({ error: "La nota de revisión debe tener entre 10 y 1.000 caracteres." }, { status: 400 });
    }

    const [settings, user] = await Promise.all([getSettings(), getSessionUser()]);
    const existingCustom = parseCustomNormativeItems(settings["normative.custom_items_json"]);
    const itemIndex = existingCustom.findIndex((item) => item.id === id);
    if (itemIndex < 0) {
      return NextResponse.json({ error: "La referencia propia no existe en esta granja." }, { status: 404 });
    }
    if (!user) return NextResponse.json({ error: "No se pudo identificar a quien registra la revisión." }, { status: 401 });

    const reviewedAt = new Date().toISOString().slice(0, 10);
    const updatedItem = {
      ...existingCustom[itemIndex],
      verificationStatus: requestedStatus,
      lastVerifiedAt: requestedStatus === "pendiente" ? null : reviewedAt,
      verifiedBy: requestedStatus === "pendiente" ? null : `${user.name} (@${user.username})`,
      verificationNote: note,
    };
    const updatedCustom = [...existingCustom];
    updatedCustom[itemIndex] = updatedItem;
    await updateSettings(
      [{ key: "normative.custom_items_json", value: JSON.stringify(updatedCustom) }],
      user.id,
    );

    return NextResponse.json({
      ok: true,
      action,
      item: updatedItem,
      ...(await buildStateResponse()),
    });
  }

  if (action === "delete_normative_item") {
    const id = String(body.id || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Identificador de referencia requerido." }, { status: 400 });
    }

    const [settings, user] = await Promise.all([getSettings(), getSessionUser()]);
    const existingCustom = parseCustomNormativeItems(settings["normative.custom_items_json"]);
    const updatedCustom = existingCustom.filter((item) => item.id !== id);

    await updateSettings(
      [{ key: "normative.custom_items_json", value: JSON.stringify(updatedCustom) }],
      user?.id ?? null,
    );

    await db
      .delete(attachments)
      .where(
        and(
          eq(attachments.entityType, "normative_doc"),
          eq(attachments.entityId, id),
        ),
      );

    return NextResponse.json({
      ok: true,
      action,
      deletedId: id,
      ...(await buildStateResponse()),
    });
  }

  return NextResponse.json({ error: `Acción no reconocida: ${action}` }, { status: 400 });
});

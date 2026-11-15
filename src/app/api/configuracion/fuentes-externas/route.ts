import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
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
  listExternalSnapshots,
  type ExternalSourceKey,
  type StoredExternalSnapshot,
} from "@/lib/external-sources/snapshot-store";
import {
  applyDivipolaToFarmSettings,
  applyMarketPricesToSpeciesCatalog,
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
      const verificationStatus: NormativeVerificationStatus =
        obj.verificationStatus === "verificado" ||
        obj.verificationStatus === "pendiente" ||
        obj.verificationStatus === "reemplazado" ||
        obj.verificationStatus === "derogado"
          ? obj.verificationStatus
          : typeof obj.lastVerifiedAt === "string" && obj.lastVerifiedAt.trim()
            ? "verificado"
            : "pendiente";
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
          typeof obj.lastVerifiedAt === "string" && obj.lastVerifiedAt.trim()
            ? obj.lastVerifiedAt
            : null,
        verifiedBy:
          typeof obj.verifiedBy === "string" && obj.verifiedBy.trim()
            ? obj.verifiedBy
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
            : "/dashboard/configuracion/catalogos?tab=normas",
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
  "standards_normative_feed",
  "ica_vademecum_alerts",
  "colombia_tax_holidays",
  "iot_telemetry_bridge",
];

const ZONE_DEPENDENT_KEYS = new Set<ExternalSourceKey>([
  "divipola_dane",
  "open_meteo",
  "dane_sipsa_trm",
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
      label: "Precios mayoristas SIPSA y TRM oficial",
      domainLabel: "Mercado e insumos",
      periodHours: marketH,
      periodLabel: formatPeriodLabel(marketH),
    },
    {
      sourceKey: "ica_vademecum_alerts" as ExternalSourceKey,
      label: "Vademécum veterinario y alertas epidemiológicas ICA",
      domainLabel: "Sanidad animal ICA",
      periodHours: 24,
      periodLabel: "Diario (cada 24 h)",
    },
    {
      sourceKey: "standards_normative_feed" as ExternalSourceKey,
      label: "Catálogo de normas, estándares, guías, curvas y FEDNA/NRC",
      domainLabel: "Normativa, guías y nutrición",
      periodHours: 24 * 7,
      periodLabel: "Semanal (cada 7 días)",
    },
    {
      sourceKey: "colombia_tax_holidays" as ExternalSourceKey,
      label: "Festivos de Colombia, DIAN UVT y crédito Finagro",
      domainLabel: "Calendario oficial y finanzas",
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
    {
      sourceKey: "iot_telemetry_bridge" as ExternalSourceKey,
      label: "Puente de sensores y telemetría ambiental",
      domainLabel: "Sensores de galpón",
      periodHours: 1,
      periodLabel: "Cada 1 hora",
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

  const [snapshots, settings, syncConfig, taxDefaults] = await Promise.all([
    listExternalSnapshots(),
    getSettings(),
    getExternalSyncConfig(),
    getTaxAndFinanceDefaults(),
  ]);

  const byKey = new Map(snapshots.map((s) => [s.sourceKey, s]));
  const currentYear = new Date().getUTCFullYear();
  const taxSnap = byKey.get("colombia_tax_holidays") as StoredExternalSnapshot<TaxHolidaysSnapshotPayload> | undefined;
  const icaSnap = byKey.get("ica_vademecum_alerts") as StoredExternalSnapshot<IcaVademecumSnapshotPayload> | undefined;
  const iotSnap = byKey.get("iot_telemetry_bridge") as StoredExternalSnapshot<IotBridgeSnapshotPayload> | undefined;
  const divipolaSnap = byKey.get("divipola_dane") as StoredExternalSnapshot<DivipolaSnapshotPayload> | undefined;
  const weatherSnap = byKey.get("open_meteo") as StoredExternalSnapshot<WeatherSnapshotPayload> | undefined;
  const marketSnap = byKey.get("dane_sipsa_trm") as StoredExternalSnapshot<MarketPricesPayload> | undefined;
  const standardsSnap = byKey.get("standards_normative_feed") as StoredExternalSnapshot<StandardsFeedSnapshotPayload> | undefined;
  const customNormativeItems = parseCustomNormativeItems(settings["normative.custom_items_json"]);
  const normativeMeta = getNormativeCatalogWithSyncMeta(
    standardsSnap?.fetchedAt ? new Date(standardsSnap.fetchedAt).toISOString().slice(0, 10) : null,
    customNormativeItems,
    standardsSnap?.fetchedAt ? new Date(standardsSnap.fetchedAt).toISOString().slice(0, 10) : null,
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
      lastSourceCheckedAt:
        standardsSnap?.payload?.normativeLastCheckedAt || standardsSnap?.fetchedAt || normativeMeta.lastSourceCheckedAt,
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
      retentionPurchases27UvtCop: Math.round(taxDefaults.uvtCop * 27),
      retentionAgro92UvtCop: Math.round(taxDefaults.uvtCop * 92),
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
      getNormativeCatalogWithSyncMeta(syncDate, customNormativeItems, syncDate),
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
    if (!ALL_SOURCE_KEYS.includes(sourceKey)) {
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

  if (action === "sync_wave") {
    const wave = Number(body.wave);
    if (![1, 2, 3].includes(wave)) {
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
    const result = await applyMarketPricesToSpeciesCatalog();
    return NextResponse.json({
      ok: true,
      action,
      result: {
        updatedCount: result.updatedCount,
        regionDepartment: result.prices.regionDepartment,
        trmCopPerUsd: result.prices.trmCopPerUsd,
        coverageScope: result.prices.coverageScope,
        coverageLabel: result.prices.coverageLabel,
      },
      ...(await buildStateResponse()),
    });
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
      : "/dashboard/sanidad/bioseguridad";
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

    const todayIso = new Date().toISOString().slice(0, 10);
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
      lastVerifiedAt: todayIso,
      verifiedBy: "Registro propio de granja",
      verificationStatus: "verificado",
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

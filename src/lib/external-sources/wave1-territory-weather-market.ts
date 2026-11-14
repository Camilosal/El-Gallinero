import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { catalogos } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";
import {
  getEggStorageThresholds,
  getExternalSyncConfig,
  getSettings,
  updateSettings,
} from "@/lib/settings";
import {
  fetchJsonWithTimeout,
  getExternalSnapshot,
  isSnapshotExpired,
  saveExternalSnapshot,
  type StoredExternalSnapshot,
} from "./snapshot-store";

import {
  COLOMBIA_DEPARTMENTS,
  COLOMBIA_DIVIPOLA_CATALOG,
  getMunicipalitiesByDepartment,
  resolveDivipolaMunicipality,
  resolveZoneWithFallback,
  type DivipolaMunicipality,
  type ZoneCoverageScope,
  type ZoneResolutionResult,
} from "@/lib/divipola-catalog";

export {
  COLOMBIA_DEPARTMENTS,
  COLOMBIA_DIVIPOLA_CATALOG,
  getMunicipalitiesByDepartment,
  resolveDivipolaMunicipality,
  resolveZoneWithFallback,
  type DivipolaMunicipality,
  type ZoneCoverageScope,
  type ZoneResolutionResult,
};

export interface FarmZoneSnapshotRef {
  country: string;
  department: string;
  city: string;
  daneCode: string;
}

export interface WeatherForecastDay {
  date: string;
  maxTempC: number;
  minTempC: number;
  humidityPct: number;
  maxIth: number;
  precipitationMm: number;
}

export interface WeatherSnapshotPayload extends Record<string, unknown> {
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  locationLabel: string;
  coverageScope: ZoneCoverageScope;
  coverageLabel: string;
  periodLabel: string;
  configuredFarmZone: FarmZoneSnapshotRef;
  currentTempC: number;
  currentHumidityPct: number;
  apparentTempC: number;
  windSpeedKmh: number;
  precipitationMm: number;
  currentIth: number;
  thermalStressLevel: "confort" | "alerta_moderada" | "estres_severo" | "riesgo_frio";
  feedIntakeFactor: number;
  feedIntakeNote: string;
  ntc1240StorageRisk: {
    outOfRange: boolean;
    reason: string | null;
  };
  forecast: WeatherForecastDay[];
  recommendation: string;
}

export interface DivipolaSnapshotPayload extends Record<string, unknown> {
  selected: DivipolaMunicipality;
  coverageScope: ZoneCoverageScope;
  coverageLabel: string;
  periodLabel: string;
  configuredFarmZone: FarmZoneSnapshotRef;
  officialMatch: {
    cod_mpio?: string;
    nom_mpio?: string;
    dpto?: string;
    latitud?: string;
    longitud?: string;
  } | null;
  catalogCount: number;
}

export interface RegionalMarketBenchmarkRow {
  plaza: string;
  departments: string[];
  region: string;
  eggAaCopUnit: number;
  eggACopUnit: number;
  polloPieKgCop: number;
  polloCanalKgCop: number;
  gallinaDescarteUnitCop: number;
  conejoCanalKgCop: number;
  quailEggCopUnit: number;
  concentrado40KgBagCop: number;
  maizAmarilloKgCop: number;
  tortaSoyaKgCop: number;
  periodLabel: string;
}

export interface MarketPricesPayload extends Record<string, unknown> {
  regionDepartment: string;
  coverageScope: ZoneCoverageScope;
  coverageLabel: string;
  periodLabel: string;
  configuredFarmZone: FarmZoneSnapshotRef;
  trmCopPerUsd: number;
  trmDate: string;
  eggs: {
    jumboUnitCop: number;
    aaaUnitCop: number;
    aaUnitCop: number;
    aUnitCop: number;
    bUnitCop: number;
    aaTray30Cop: number;
    quailEggUnitCop: number;
  };
  meat: {
    polloCanalKgCop: number;
    polloPieKgCop: number;
    gallinaDescarteUnitCop: number;
    patoCanalKgCop: number;
    conejoCanalKgCop: number;
    cuyPieUnitCop: number;
    cuyCanalKgCop: number;
  };
  feed: {
    maizAmarilloKgCop: number;
    tortaSoyaKgCop: number;
    concentrado40KgBagCop: number;
    concentradoKgCop: number;
  };
  selectedZonePrices: {
    eggAaCopUnit: number;
    eggACopUnit: number;
    broilerLiveCopKg: number;
    broilerCarcassCopKg: number;
    cullHenCopUnit: number;
    rabbitCopKg: number;
    quailEggCopUnit: number;
    cornYellowCopKg: number;
    soybeanMealCopKg: number;
    balancedFeed40KgCop: number;
  };
  regionalPrices: RegionalMarketBenchmarkRow[];
  sipsaSampleRows: Array<{
    product: string;
    market: string;
    avgPriceCop: number;
    unit: string;
  }>;
  note: string;
}

function normalizeText(value: string | null | undefined): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function buildFarmZoneRef(settings: Record<string, string>): FarmZoneSnapshotRef {
  return {
    country: (settings["farm.country"] || "Colombia").trim(),
    department: (settings["farm.department"] || "").trim(),
    city: (settings["farm.city"] || "").trim(),
    daneCode: (settings["farm.dane_municipality_code"] || "").trim(),
  };
}

function isSameFarmZone(a?: Partial<FarmZoneSnapshotRef> | null, b?: FarmZoneSnapshotRef | null): boolean {
  if (!a || !b) return false;
  return (
    normalizeText(a.country) === normalizeText(b.country) &&
    normalizeText(a.department) === normalizeText(b.department) &&
    normalizeText(a.city) === normalizeText(b.city) &&
    normalizeText(a.daneCode) === normalizeText(b.daneCode)
  );
}

export function computeIthIndex(tempC: number, humidityPct: number): number {
  const hr = Math.max(0, Math.min(100, humidityPct));
  const ith = 1.8 * tempC + 32 - (0.55 - 0.0055 * hr) * (1.8 * tempC - 26);
  return Number(ith.toFixed(2));
}

function classifyThermalStress(tempC: number, ith: number): {
  level: WeatherSnapshotPayload["thermalStressLevel"];
  feedIntakeFactor: number;
  feedIntakeNote: string;
  recommendation: string;
} {
  if (ith >= 78 || tempC >= 31) {
    return {
      level: "estres_severo",
      feedIntakeFactor: 0.9,
      feedIntakeNote: "Reducción estimada -10% de consumo voluntario por estrés calórico severo",
      recommendation: "Activar ventilación cruzada, refrescar agua de bebida (< 20 °C), evitar manejo en horas pico y reforzar electrolitos/vitamina C.",
    };
  }
  if (ith >= 72 || tempC >= 27.5) {
    return {
      level: "alerta_moderada",
      feedIntakeFactor: 0.95,
      feedIntakeNote: "Ajuste -5% en consumo diario por incremento de temperatura e ITH",
      recommendation: "Monitorear jadeo en galpón, incrementar recambio de agua y revisar densidad en aves/conejos.",
    };
  }
  if (tempC < 12) {
    return {
      level: "riesgo_frio",
      feedIntakeFactor: 1.07,
      feedIntakeNote: "Incremento +7% en consumo calórico por baja temperatura ambiental",
      recommendation: "Cerrar cortinas nocturnas en cría y cuyes, revisar criadoras/calefacción y proteger pollitos < 3 semanas.",
    };
  }
  return {
    level: "confort",
    feedIntakeFactor: 1.0,
    feedIntakeNote: "Zona térmica confortable (sin penalización sobre el consumo base)",
    recommendation: "Condiciones ambientales estables para postura, engorde y almacenamiento.",
  };
}

export async function syncDivipolaSnapshot(
  options?: { forceRefresh?: boolean; query?: string | null },
): Promise<StoredExternalSnapshot<DivipolaSnapshotPayload>> {
  const settings = await getSettings();
  const configuredFarmZone = buildFarmZoneRef(settings);
  const query = options?.query?.trim() || null;

  const zone = query
    ? resolveZoneWithFallback({
      daneCode: /^\d+$/.test(query) ? query : undefined,
      city: /^\d+$/.test(query) ? undefined : query,
    })
    : resolveZoneWithFallback(configuredFarmZone);

  const selected = zone.municipality;
  const existing = await getExternalSnapshot<DivipolaSnapshotPayload>("divipola_dane");

    if (
      !options?.forceRefresh &&
      !query &&
      existing &&
      !isSnapshotExpired(existing) &&
      isSameFarmZone(existing.payload.configuredFarmZone, configuredFarmZone) &&
      existing.payload.selected?.daneCode === selected.daneCode
    ) {
      return existing;
    }

    const syncConfig = await getExternalSyncConfig();
    const apiUrl = `https://www.datos.gov.co/resource/gdxc-w37w.json?cod_mpio=${encodeURIComponent(selected.daneCode)}&$limit=1`;

    let officialMatch: DivipolaSnapshotPayload["officialMatch"] = null;
    let status: "ok" | "fallback" = "fallback";
    let lastError: string | null = null;

      if (syncConfig.syncEnabled && selected.daneCode !== "00000") {
        const res = await fetchJsonWithTimeout<Array<{
          cod_mpio?: string;
          nom_mpio?: string;
          dpto?: string;
          latitud?: string;
          longitud?: string;
        }>>(apiUrl, 3500);
        if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
          officialMatch = res.data[0];
          status = "ok";
        } else if (!res.ok) {
          lastError = res.error;
        }
      }

      const payload: DivipolaSnapshotPayload = {
        selected,
        coverageScope: zone.coverageScope,
        coverageLabel: zone.coverageLabel,
        periodLabel: zone.periodLabel,
        configuredFarmZone,
        officialMatch,
        catalogCount: COLOMBIA_DIVIPOLA_CATALOG.length,
      };

      return saveExternalSnapshot({
        sourceKey: "divipola_dane",
        wave: 1,
        status,
        providerName: "DANE DIVIPOLA (datos.gov.co)",
        sourceUrl: "https://www.datos.gov.co/resource/gdxc-w37w.json",
        payload,
        summary: `${zone.coverageLabel} · ${selected.altitudeMeters} msnm · Piso ${selected.thermalFloor}`,
        ttlHours: 24 * 14,
        lastError,
      });
    }

    export async function applyDivipolaToFarmSettings(daneCode: string, userId?: string | null) {
      const municipality = resolveDivipolaMunicipality(daneCode);
      await updateSettings(
        [
          { key: "farm.country", value: "Colombia" },
          { key: "farm.department", value: municipality.department },
          { key: "farm.city", value: municipality.municipality },
          { key: "farm.dane_municipality_code", value: municipality.daneCode },
          { key: "farm.latitude", value: String(municipality.latitude) },
          { key: "farm.longitude", value: String(municipality.longitude) },
          { key: "farm.altitude_meters", value: String(municipality.altitudeMeters) },
        ],
        userId,
      );
      const divipola = await syncDivipolaSnapshot({ forceRefresh: true, query: municipality.daneCode });
      const weather = await syncWeatherSnapshot({ forceRefresh: true });
      const market = await syncMarketPricesSnapshot({ forceRefresh: true });
      return { municipality, divipola, weather, market };
    }

    export async function syncWeatherSnapshot(
      options?: { forceRefresh?: boolean },
    ): Promise<StoredExternalSnapshot<WeatherSnapshotPayload>> {
      const [settings, syncConfig, storageThresholds, existing] = await Promise.all([
        getSettings(),
        getExternalSyncConfig(),
        getEggStorageThresholds(),
        getExternalSnapshot<WeatherSnapshotPayload>("open_meteo"),
      ]);
      const configuredFarmZone = buildFarmZoneRef(settings);

        if (
          !options?.forceRefresh &&
          existing &&
          !isSnapshotExpired(existing) &&
          isSameFarmZone(existing.payload.configuredFarmZone, configuredFarmZone)
        ) {
          return existing;
        }

        const zone = resolveZoneWithFallback(configuredFarmZone);
        const fallbackMuni = zone.municipality;
        const latNum = Number(settings["farm.latitude"]);
        const lonNum = Number(settings["farm.longitude"]);
        const altNum = Number(settings["farm.altitude_meters"]);

        const latitude =
          zone.coverageScope === "local" && Number.isFinite(latNum) && settings["farm.latitude"]
            ? latNum
            : fallbackMuni.latitude;
        const longitude =
          zone.coverageScope === "local" && Number.isFinite(lonNum) && settings["farm.longitude"]
            ? lonNum
            : fallbackMuni.longitude;
        const altitudeMeters =
          zone.coverageScope === "local" && Number.isFinite(altNum) && settings["farm.altitude_meters"]
            ? altNum
            : fallbackMuni.altitudeMeters;
        const locationLabel =
          zone.coverageScope === "local"
            ? `${fallbackMuni.municipality}, ${fallbackMuni.department}`
            : zone.coverageLabel;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,precipitation_sum&timezone=America%2FBogota&forecast_days=7`;

        interface OpenMeteoResp {
          current?: {
            temperature_2m?: number;
            relative_humidity_2m?: number;
            apparent_temperature?: number;
            precipitation?: number;
            wind_speed_10m?: number;
          };
          daily?: {
            time?: string[];
            temperature_2m_max?: number[];
            temperature_2m_min?: number[];
            relative_humidity_2m_mean?: number[];
            precipitation_sum?: number[];
          };
        }

        let status: "ok" | "fallback" = "fallback";
        let lastError: string | null = null;
        let meteo: OpenMeteoResp | null = null;

        if (syncConfig.syncEnabled) {
          const res = await fetchJsonWithTimeout<OpenMeteoResp>(url, 4000);
          if (res.ok && res.data?.current?.temperature_2m != null) {
            meteo = res.data;
            status = "ok";
          } else if (!res.ok) {
            lastError = res.error;
          }
        }

        const estimatedBaseTemp = Number(Math.max(10, Math.min(31.5, 29.2 - 0.0058 * altitudeMeters)).toFixed(1));
        const currentTempC = meteo?.current?.temperature_2m ?? estimatedBaseTemp;
        const currentHumidityPct = meteo?.current?.relative_humidity_2m ?? 74;
        const apparentTempC = meteo?.current?.apparent_temperature ?? currentTempC;
        const windSpeedKmh = meteo?.current?.wind_speed_10m ?? 7.5;
        const precipitationMm = meteo?.current?.precipitation ?? 0;
        const currentIth = computeIthIndex(currentTempC, currentHumidityPct);

        const stress = classifyThermalStress(currentTempC, currentIth);

        const forecast: WeatherForecastDay[] = [];
        if (meteo?.daily?.time && Array.isArray(meteo.daily.time)) {
          for (let i = 0; i < meteo.daily.time.length; i++) {
            const maxT = Number(meteo.daily.temperature_2m_max?.[i] ?? currentTempC + 3);
            const minT = Number(meteo.daily.temperature_2m_min?.[i] ?? Math.max(6, currentTempC - 6));
            const hum = Number(meteo.daily.relative_humidity_2m_mean?.[i] ?? currentHumidityPct);
            const rain = Number(meteo.daily.precipitation_sum?.[i] ?? 0);
            forecast.push({
              date: meteo.daily.time[i],
              maxTempC: Number(maxT.toFixed(1)),
              minTempC: Number(minT.toFixed(1)),
              humidityPct: Math.round(hum),
              maxIth: computeIthIndex(maxT, hum),
              precipitationMm: Number(rain.toFixed(1)),
            });
          }
        } else {
          const today = new Date();
          for (let i = 0; i < 7; i++) {
            const dt = new Date(today.getTime() + i * 86400000);
            const maxT = Number((estimatedBaseTemp + 3.5).toFixed(1));
            const minT = Number(Math.max(5, estimatedBaseTemp - 5.5).toFixed(1));
            forecast.push({
              date: dt.toISOString().slice(0, 10),
              maxTempC: maxT,
              minTempC: minT,
              humidityPct: currentHumidityPct,
              maxIth: computeIthIndex(maxT, currentHumidityPct),
              precipitationMm: 0,
            });
          }
        }

        const outOfRange =
          currentTempC > storageThresholds.maxTempC ||
          currentTempC < storageThresholds.minTempC ||
          currentHumidityPct > storageThresholds.maxHumidityPct ||
          currentHumidityPct < storageThresholds.minHumidityPct;
        const ntcReasons: string[] = [];
        if (currentTempC > storageThresholds.maxTempC) {
          ntcReasons.push(`Temp. exterior ${currentTempC}°C supera límite bodega (${storageThresholds.maxTempC}°C)`);
        } else if (currentTempC < storageThresholds.minTempC) {
          ntcReasons.push(`Temp. exterior ${currentTempC}°C bajo mínimo bodega (${storageThresholds.minTempC}°C)`);
        }
        if (currentHumidityPct > storageThresholds.maxHumidityPct) {
          ntcReasons.push(`Humedad ${currentHumidityPct}% supera máximo (${storageThresholds.maxHumidityPct}%)`);
        }

        const payload: WeatherSnapshotPayload = {
          latitude,
          longitude,
          altitudeMeters,
          locationLabel,
          coverageScope: zone.coverageScope,
          coverageLabel: zone.coverageLabel,
          periodLabel: zone.periodLabel,
          configuredFarmZone,
          currentTempC,
          currentHumidityPct,
          apparentTempC,
          windSpeedKmh,
          precipitationMm,
          currentIth,
          thermalStressLevel: stress.level,
          feedIntakeFactor: stress.feedIntakeFactor,
          feedIntakeNote: stress.feedIntakeNote,
          ntc1240StorageRisk: {
            outOfRange,
            reason: ntcReasons.length > 0 ? ntcReasons.join(" · ") : null,
          },
          forecast,
          recommendation: stress.recommendation,
        };

        return saveExternalSnapshot({
          sourceKey: "open_meteo",
          wave: 1,
          status,
          providerName: status === "ok" ? "Open-Meteo Forecast API" : "Open-Meteo (Estimación altitudinal zonal)",
          sourceUrl: "https://api.open-meteo.com/v1/forecast",
          payload,
          summary: `${zone.coverageLabel}: ${currentTempC}°C · HR ${currentHumidityPct}% · ITH ${currentIth} (${stress.level})`,
          ttlHours: syncConfig.weatherTtlHours,
          lastError,
        });
      }

        const SIPSA_REGIONAL_HUBS: Array<{
          plaza: string;
          departments: string[];
          region: string;
          mult: number;
        }> = [
            { plaza: "Corabastos Bogotá / Cundinamarca", departments: ["Cundinamarca", "Bogotá D.C."], region: "Andina", mult: 1.02 },
            { plaza: "Central Mayorista Medellín / Antioquia", departments: ["Antioquia"], region: "Andina", mult: 1.02 },
            { plaza: "Centroabastos Bucaramanga / Santander", departments: ["Santander"], region: "Andina", mult: 1.0 },
            { plaza: "Cavasa Cali / Valle del Cauca", departments: ["Valle del Cauca"], region: "Pacífica", mult: 1.01 },
            { plaza: "Mercasa Pereira / Eje Cafetero", departments: ["Risaralda", "Quindío", "Caldas"], region: "Andina", mult: 1.0 },
            { plaza: "Tunja / Boyacá", departments: ["Boyacá"], region: "Andina", mult: 0.96 },
            { plaza: "Plaza La 21 Ibagué / Surabastos Neiva", departments: ["Tolima", "Huila"], region: "Andina", mult: 0.98 },
            { plaza: "El Potrerillo Pasto / Popayán", departments: ["Nariño", "Cauca"], region: "Andina", mult: 0.96 },
            { plaza: "Granabastos Barranquilla / Costa Caribe", departments: ["Atlántico", "Bolívar", "Córdoba", "Sucre", "Magdalena", "Cesar"], region: "Caribe", mult: 1.05 },
            { plaza: "Central Abastos Villavicencio / Orinoquía", departments: ["Meta", "Casanare"], region: "Orinoquía", mult: 1.01 },
            { plaza: "Cenabastos Cúcuta / Norte de Santander", departments: ["Norte de Santander"], region: "Andina", mult: 0.99 },
          ];

        function buildRegionalPricesTable(
          trmFeedFactor: number,
          periodLabel: string,
        ): RegionalMarketBenchmarkRow[] {
          const rows: RegionalMarketBenchmarkRow[] = SIPSA_REGIONAL_HUBS.map((hub) => {
            const bag = Math.round(108000 * trmFeedFactor * (0.97 + (hub.mult - 1) * 0.4));
            return {
              plaza: hub.plaza,
              departments: hub.departments,
              region: hub.region,
              eggAaCopUnit: Math.round(490 * hub.mult),
              eggACopUnit: Math.round(445 * hub.mult),
              polloPieKgCop: Math.round(8600 * hub.mult),
              polloCanalKgCop: Math.round(12400 * hub.mult),
              gallinaDescarteUnitCop: Math.round(21000 * hub.mult),
              conejoCanalKgCop: Math.round(26500 * hub.mult),
              quailEggCopUnit: Math.round(170 * hub.mult),
              concentrado40KgBagCop: bag,
              maizAmarilloKgCop: Math.round(1680 * trmFeedFactor),
              tortaSoyaKgCop: Math.round(2950 * trmFeedFactor),
              periodLabel,
            };
          });

          const avg = (fn: (r: RegionalMarketBenchmarkRow) => number) =>
            Math.round(rows.reduce((s, r) => s + fn(r), 0) / rows.length);

          rows.push({
            plaza: "Promedio Nacional Colombia (último periodo SIPSA)",
            departments: ["Promedio Nacional"],
            region: "Nacional",
            eggAaCopUnit: avg((r) => r.eggAaCopUnit),
            eggACopUnit: avg((r) => r.eggACopUnit),
            polloPieKgCop: avg((r) => r.polloPieKgCop),
            polloCanalKgCop: avg((r) => r.polloCanalKgCop),
            gallinaDescarteUnitCop: avg((r) => r.gallinaDescarteUnitCop),
            conejoCanalKgCop: avg((r) => r.conejoCanalKgCop),
            quailEggCopUnit: avg((r) => r.quailEggCopUnit),
            concentrado40KgBagCop: avg((r) => r.concentrado40KgBagCop),
            maizAmarilloKgCop: avg((r) => r.maizAmarilloKgCop),
            tortaSoyaKgCop: avg((r) => r.tortaSoyaKgCop),
            periodLabel,
          });

          return rows;
        }

        export async function syncMarketPricesSnapshot(
          options?: { forceRefresh?: boolean },
        ): Promise<StoredExternalSnapshot<MarketPricesPayload>> {
          const [settings, syncConfig, existing] = await Promise.all([
            getSettings(),
            getExternalSyncConfig(),
            getExternalSnapshot<MarketPricesPayload>("dane_sipsa_trm"),
          ]);
          const configuredFarmZone = buildFarmZoneRef(settings);

            if (
              !options?.forceRefresh &&
              existing &&
              !isSnapshotExpired(existing) &&
              isSameFarmZone(existing.payload.configuredFarmZone, configuredFarmZone)
            ) {
              return existing;
            }

            const periodLabel = "Último periodo disponible";
            const zone = resolveZoneWithFallback({ ...configuredFarmZone, periodLabel });
            const department = zone.matchedDepartment || settings["farm.department"] || "Promedio Nacional";

            let trmCopPerUsd = 4280;
            let trmDate = new Date().toISOString().slice(0, 10);
            let trmOk = false;
            let sipsaOk = false;
            const sipsaSampleRows: MarketPricesPayload["sipsaSampleRows"] = [];
            const errors: string[] = [];

            if (syncConfig.syncEnabled) {
              const [trmRes, sipsaRes] = await Promise.all([
                fetchJsonWithTimeout<Array<{ valor?: string; vigenciadesde?: string }>>(
                  "https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC",
                  3800,
                ),
                fetchJsonWithTimeout<Array<Record<string, unknown>>>(
                  "https://www.datos.gov.co/resource/2pnw-mmge.json?$limit=40",
                  3800,
                ),
              ]);

              if (trmRes.ok && Array.isArray(trmRes.data) && trmRes.data[0]?.valor) {
                const parsedTrm = Number(trmRes.data[0].valor);
                if (Number.isFinite(parsedTrm) && parsedTrm > 1000) {
                  trmCopPerUsd = Number(parsedTrm.toFixed(2));
                  trmDate = String(trmRes.data[0].vigenciadesde || trmDate).slice(0, 10);
                  trmOk = true;
                }
              } else if (!trmRes.ok) {
                errors.push(`TRM: ${trmRes.error}`);
              }

              if (sipsaRes.ok && Array.isArray(sipsaRes.data) && sipsaRes.data.length > 0) {
                sipsaOk = true;
                for (const row of sipsaRes.data) {
                  const prod = String(row.producto || row.arti_nombre || row.nombre || "").trim();
                  const priceRaw = Number(row.promedio || row.precio_promedio || row.promediokg || row.valor || 0);
                  const market = String(row.fuente || row.mercado || row.ciudad || "Central SIPSA").trim();
                  if (prod && Number.isFinite(priceRaw) && priceRaw > 0) {
                    sipsaSampleRows.push({
                      product: prod,
                      market,
                      avgPriceCop: Math.round(priceRaw),
                      unit: String(row.unidad || "kg"),
                    });
                  }
                  if (sipsaSampleRows.length >= 10) break;
                }
              } else if (!sipsaRes.ok) {
                errors.push(`SIPSA: ${sipsaRes.error}`);
              }
            }

            const trmFeedFactor = Math.max(0.9, Math.min(1.15, trmCopPerUsd / 4250));
            const regionalPrices = buildRegionalPricesTable(trmFeedFactor, periodLabel);
            const nationalRow = regionalPrices[regionalPrices.length - 1];

            // Resolución en cascada Local/Plaza directa -> Promedio regional -> Promedio nacional
            const normDept = normalizeText(department);
            const directHub =
              zone.coverageScope === "nacional"
                ? undefined
                : regionalPrices.find(
                  (r) =>
                    r.region !== "Nacional" &&
                    r.departments.some(
                      (d) => normalizeText(d) === normDept || (normDept && normalizeText(d).includes(normDept)),
                    ),
                );

            let mult = 1.0;
            let marketCoverageScope: ZoneCoverageScope = zone.coverageScope;
            let marketCoverageLabel = zone.coverageLabel;

            if (directHub) {
              mult = directHub.eggAaCopUnit / 490;
              marketCoverageScope = zone.coverageScope === "local" ? "local" : "regional";
              marketCoverageLabel =
                zone.coverageScope === "local"
                  ? `Zona local: ${zone.municipality.municipality}, ${department} (Plaza ${directHub.plaza})`
                  : `Promedio regional: ${department} (Plaza ${directHub.plaza} · ${periodLabel})`;
            } else if (zone.coverageScope !== "nacional") {
              const regionRows = regionalPrices.filter(
                (r) => r.region !== "Nacional" && normalizeText(r.region) === normalizeText(zone.matchedRegion),
              );
              if (regionRows.length > 0) {
                const avgEggAa = regionRows.reduce((s, r) => s + r.eggAaCopUnit, 0) / regionRows.length;
                mult = avgEggAa / 490;
                marketCoverageScope = "regional";
                marketCoverageLabel = `Promedio regional: Región ${zone.matchedRegion} (${periodLabel})`;
              } else {
                mult = nationalRow.eggAaCopUnit / 490;
                marketCoverageScope = "nacional";
                marketCoverageLabel = `Promedio nacional Colombia (${periodLabel})`;
              }
            } else {
              mult = nationalRow.eggAaCopUnit / 490;
              marketCoverageScope = "nacional";
              marketCoverageLabel = `Promedio nacional Colombia (${periodLabel})`;
            }

            const aaEggBase = Math.round(490 * mult);
            const bag40KgCop = Math.round(108000 * trmFeedFactor);
            const maizAmarilloKgCop = Math.round(1680 * trmFeedFactor);
            const tortaSoyaKgCop = Math.round(2950 * trmFeedFactor);

            const selectedZonePrices = {
              eggAaCopUnit: aaEggBase,
              eggACopUnit: Math.round(445 * mult),
              broilerLiveCopKg: Math.round(8600 * mult),
              broilerCarcassCopKg: Math.round(12400 * mult),
              cullHenCopUnit: Math.round(21000 * mult),
              rabbitCopKg: Math.round(26500 * mult),
              quailEggCopUnit: Math.round(170 * mult),
              cornYellowCopKg: maizAmarilloKgCop,
              soybeanMealCopKg: tortaSoyaKgCop,
              balancedFeed40KgCop: bag40KgCop,
            };

            const payload: MarketPricesPayload = {
              regionDepartment: department,
              coverageScope: marketCoverageScope,
              coverageLabel: marketCoverageLabel,
              periodLabel,
              configuredFarmZone,
              trmCopPerUsd,
              trmDate,
              eggs: {
                jumboUnitCop: Math.round(620 * mult),
                aaaUnitCop: Math.round(545 * mult),
                aaUnitCop: aaEggBase,
                aUnitCop: Math.round(445 * mult),
                bUnitCop: Math.round(390 * mult),
                aaTray30Cop: aaEggBase * 30,
                quailEggUnitCop: Math.round(170 * mult),
              },
              meat: {
                polloCanalKgCop: Math.round(12400 * mult),
                polloPieKgCop: Math.round(8600 * mult),
                gallinaDescarteUnitCop: Math.round(21000 * mult),
                patoCanalKgCop: Math.round(19500 * mult),
                conejoCanalKgCop: Math.round(26500 * mult),
                cuyPieUnitCop: Math.round(36000 * mult),
                cuyCanalKgCop: Math.round(32000 * mult),
              },
              feed: {
                maizAmarilloKgCop,
                tortaSoyaKgCop,
                concentrado40KgBagCop: bag40KgCop,
                concentradoKgCop: Math.round(bag40KgCop / 40),
              },
              selectedZonePrices,
              regionalPrices,
              sipsaSampleRows,
              note: trmOk || sipsaOk
      ? `Sincronizado con fuentes oficiales (${trmOk ? "TRM SFC" : "TRM respaldo"}${sipsaOk ? " + DANE SIPSA" : ""}) · ${marketCoverageLabel}.`
              : `Referencia ${marketCoverageLabel} (respaldo local SIPSA/FENAVI).`,
          };

          const status: "ok" | "fallback" = trmOk || sipsaOk ? "ok" : "fallback";

          return saveExternalSnapshot({
            sourceKey: "dane_sipsa_trm",
            wave: 1,
            status,
            providerName: "DANE SIPSA + TRM Oficial Colombia",
            sourceUrl: "https://www.datos.gov.co/resource/32sa-8pi3.json",
            payload,
            summary: `${marketCoverageLabel} · Huevo AA: $${payload.eggs.aaUnitCop} · Pollo canal: $${payload.meat.polloCanalKgCop.toLocaleString("es-CO")}/kg · TRM: $${trmCopPerUsd.toLocaleString("es-CO")}`,
            ttlHours: syncConfig.marketTtlHours,
            lastError: errors.length > 0 ? errors.join(" | ") : null,
          });
        }

        export async function applyMarketPricesToSpeciesCatalog(): Promise<{
          updatedCount: number;
          prices: MarketPricesPayload;
        }> {
          const farmId = getCurrentFarmId();
          const snapshot = await syncMarketPricesSnapshot({ forceRefresh: true });
          const p = snapshot.payload;

          const updatesBySpecies: Record<string, { eggPrice?: string; price: string; feedCostPerKg: string }> = {
            gallina: { eggPrice: String(p.eggs.aaUnitCop), price: String(p.meat.gallinaDescarteUnitCop), feedCostPerKg: String(p.feed.concentradoKgCop) },
            pollo: { price: String(p.meat.polloCanalKgCop), feedCostPerKg: String(p.feed.concentradoKgCop) },
            codorniz: { eggPrice: String(p.eggs.quailEggUnitCop), price: String(Math.round(p.eggs.quailEggUnitCop * 24)), feedCostPerKg: String(Math.round(p.feed.concentradoKgCop * 1.15)) },
            pato: { eggPrice: String(Math.round(p.eggs.aaUnitCop * 1.5)), price: String(p.meat.patoCanalKgCop), feedCostPerKg: String(p.feed.concentradoKgCop) },
            conejo: { price: String(p.meat.conejoCanalKgCop), feedCostPerKg: String(Math.round(p.feed.concentradoKgCop * 0.85)) },
            cuy: { price: String(p.meat.cuyPieUnitCop), feedCostPerKg: String(Math.round(p.feed.concentradoKgCop * 0.72)) },
          };

          const rows = await db
            .select()
            .from(catalogos)
            .where(eq(catalogos.category, "params_especie"));

          let updatedCount = 0;
          const processedValues = new Set<string>();
          for (const row of rows) {
            if (processedValues.has(row.value)) continue;
            const sp = (row.tipo || "").toLowerCase();
            const specUpdate = updatesBySpecies[sp];
            if (!specUpdate) continue;
            processedValues.add(row.value);

            // Si pertenece a esta granja actualizamos directo; si es catálogo base compartido, clonamos a la granja para respetar RLS.
            const existingOwn = rows.find(
              (r) => r.farmId === farmId && r.category === "params_especie" && r.value === row.value,
            );
            if (existingOwn) {
              await db
                .update(catalogos)
                .set({
                  eggPrice: specUpdate.eggPrice ?? existingOwn.eggPrice,
                  price: specUpdate.price,
                  feedCostPerKg: specUpdate.feedCostPerKg,
                })
                .where(and(eq(catalogos.id, existingOwn.id), eq(catalogos.farmId, farmId)));
              updatedCount++;
            } else if (row.farmId !== farmId) {
              await db
                .insert(catalogos)
                .values({
                  farmId,
                  category: "params_especie",
                  value: row.value,
                  tipo: row.tipo,
                  units: row.units,
                  minWeeks: row.minWeeks,
                  maxWeeks: row.maxWeeks,
                  expectedEggsPerHen: row.expectedEggsPerHen,
                  dailyFeedG: row.dailyFeedG,
                  targetWeightKg: row.targetWeightKg,
                  feedConversionRatio: row.feedConversionRatio,
                  systemType: row.systemType,
                  description: row.description,
                  sortOrder: row.sortOrder,
                  isActive: row.isActive,
                  eggPrice: specUpdate.eggPrice ?? row.eggPrice,
                  price: specUpdate.price,
                  feedCostPerKg: specUpdate.feedCostPerKg,
                })
                .onConflictDoNothing();
              updatedCount++;
            }
          }

          return { updatedCount, prices: p };
        }

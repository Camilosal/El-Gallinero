import {
  getEggStorageThresholds,
  getExternalSyncConfig,
  getSettings,
  updateSettings,
} from "@/lib/settings";
import {
  fetchJsonWithTimeout,
  fetchSipsaCityPricesWithTimeout,
  saveExternalObservations,
  getExternalSnapshot,
  isSnapshotExpired,
  saveExternalSnapshot,
  type StoredExternalSnapshot,
} from "./snapshot-store";
import { createHash } from "node:crypto";
import { fetchLatestSipsaDailyWorkbook, parseSipsaDailyWorkbook } from "./wave6-dane-files";

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
  recordId: string;
  productCode: string;
  product: string;
  city: string;
  capturedAt: string;
  averagePriceCop: number;
  unit: string | null;
}

export interface MarketPricesPayload extends Record<string, unknown> {
  schemaVersion: number;
  regionDepartment: string;
  sourceStatus: { sipsa: "ok" | "fallback"; trm: "ok" | "fallback" };
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
  sipsaSampleRows: RegionalMarketBenchmarkRow[];
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
            existing.payload.schemaVersion === 2 &&
            !isSnapshotExpired(existing) &&
            isSameFarmZone(existing.payload.configuredFarmZone, configuredFarmZone)
          ) {
            return existing;
          }

          const endpoint = process.env.SIPSA_SOAP_URL || "http://appweb.dane.gov.co:9001/sipsaWS/SrvSipsaUpraBeanService";
          const trmUrl = "https://www.datos.gov.co/resource/32sa-8pi3.json?$limit=1&$order=vigenciadesde%20DESC";
          const zone = resolveZoneWithFallback({ ...configuredFarmZone, periodLabel: "Último dato SIPSA disponible" });
          const errors: string[] = [];
          let observations: RegionalMarketBenchmarkRow[] = [];
          let sipsaOk = false;
          let trmCopPerUsd = 0;
          let trmDate = "";
          let trmOk = false;
          let sipsaProviderName = "DANE SIPSA vía servicio web";
          let sipsaSourceUrl = endpoint;

          if (syncConfig.syncEnabled) {
            const [sipsaRes, trmRes] = await Promise.all([
              fetchSipsaCityPricesWithTimeout(endpoint, 10000),
              fetchJsonWithTimeout<Array<{ valor?: string; vigenciadesde?: string }>>(trmUrl, 12000),
            ]);
            if (sipsaRes.ok && sipsaRes.data.length > 0) {
              sipsaOk = true;
              observations = sipsaRes.data
                .sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt))
                .slice(0, 1000)
                .map((row) => ({
                  recordId: row.recordId,
                  productCode: row.productCode,
                  product: row.product,
                  city: row.city,
                  capturedAt: row.capturedAt,
                  averagePriceCop: row.averagePriceCop,
                  unit: null,
                }));
              await saveExternalObservations(
                sipsaRes.data.map((row) => ({
                  sourceKey: "dane_sipsa_trm",
                  observationKey: `sipsa-${row.recordId}`,
                  observedAt: new Date(row.capturedAt),
                  value: row.averagePriceCop,
                  unit: null,
                  providerName: "DANE SIPSA, promedio de precio por ciudad",
                  sourceUrl: endpoint,
                  dimensions: { city: row.city, product: row.product, productCode: row.productCode },
                  metadata: { createdAt: row.createdAt },
                })),
              );
            } else {
              const apiError = sipsaRes.ok ? "SIPSA respondió sin observaciones utilizables" : sipsaRes.error;
              try {
                const publication = await fetchLatestSipsaDailyWorkbook();
                const dailyObservations = parseSipsaDailyWorkbook(publication.bytes);
                const fileName = decodeURIComponent(new URL(publication.url).pathname.split("/").at(-1) || "anexo.xlsx");
                const checksumSha256 = createHash("sha256").update(publication.bytes).digest("hex");
                await saveExternalObservations(dailyObservations.map((row) => ({
                  sourceKey: "dane_sipsa_trm",
                  observationKey: `sipsa-p-${createHash("sha256").update(JSON.stringify([row.period, row.market, row.product])).digest("hex")}`,
                  observedAt: new Date(`${row.period}T00:00:00.000Z`),
                  value: row.priceCopKg,
                  unit: "COP/kg",
                  providerName: "DANE SIPSA-P · boletín diario XLSX",
                  sourceUrl: publication.url,
                  dimensions: {
                    period: row.period,
                    market: row.market,
                    product: row.product,
                    category: row.category,
                    variationRatio: row.variationRatio,
                    sourceType: "SIPSA-P",
                  },
                  metadata: { sourceFile: fileName, checksumSha256, parserVersion: "dane-openxml-v1" },
                })));
                sipsaOk = true;
                observations = dailyObservations.slice(0, 1000).map((row) => ({
                  recordId: `sipsa-p-${row.period}-${row.market}-${row.product}`,
                  productCode: "",
                  product: row.product,
                  city: row.market,
                  capturedAt: `${row.period}T00:00:00.000Z`,
                  averagePriceCop: row.priceCopKg,
                  unit: "COP/kg",
                }));
                sipsaProviderName = "DANE SIPSA-P · boletín diario oficial XLSX";
                sipsaSourceUrl = publication.url;
              } catch (fileError) {
                const message = fileError instanceof Error ? fileError.message : "error desconocido al procesar el XLSX";
                errors.push(`SIPSA API: ${apiError}; archivo oficial: ${message}`);
              }
            }

            if (trmRes.ok && Array.isArray(trmRes.data) && trmRes.data[0]?.valor) {
              const parsedTrm = Number(trmRes.data[0].valor);
              if (Number.isFinite(parsedTrm) && parsedTrm > 1000) {
                trmCopPerUsd = Number(parsedTrm.toFixed(2));
                trmDate = String(trmRes.data[0].vigenciadesde || "").slice(0, 10);
                trmOk = Boolean(trmDate);
                if (trmOk) {
                  await saveExternalObservations([{
                    sourceKey: "dane_sipsa_trm",
                    observationKey: `trm-${trmDate}`,
                    observedAt: new Date(trmDate),
                    value: trmCopPerUsd,
                    unit: "COP/USD",
                    providerName: "Superintendencia Financiera de Colombia, TRM",
                    sourceUrl: trmUrl,
                    dimensions: { indicator: "TRM" },
                    metadata: {},
                  }]);
                }
              }
            }
            if (!trmOk) errors.push(`TRM: ${trmRes.ok ? "dato ausente o inválido" : trmRes.error}`);
          }

          if (!sipsaOk && existing?.payload.schemaVersion === 2) {
            observations = existing.payload.sipsaSampleRows || [];
          }
          if (!trmOk && existing?.payload.schemaVersion === 2) {
            trmCopPerUsd = existing.payload.trmCopPerUsd || 0;
            trmDate = existing.payload.trmDate || "";
          }

          const capturedDates = observations.map((row) => row.capturedAt.slice(0, 10)).filter(Boolean).sort();
          const periodLabel = capturedDates.at(-1) || "Sin observaciones SIPSA";
          const normalizedCity = normalizeText(configuredFarmZone.city);
          const cityMatch = observations.some((row) => normalizeText(row.city) === normalizedCity && normalizedCity);
          const coverageScope: ZoneCoverageScope = cityMatch ? "local" : "nacional";
          const coverageLabel = cityMatch
            ? `SIPSA por ciudad: ${configuredFarmZone.city} · dato más reciente ${periodLabel}`
            : `Observaciones SIPSA disponibles por ciudad · dato más reciente ${periodLabel}`;
          const emptyPrices = {
            jumboUnitCop: 0, aaaUnitCop: 0, aaUnitCop: 0, aUnitCop: 0, bUnitCop: 0,
            aaTray30Cop: 0, quailEggUnitCop: 0,
          };
          const emptyMeat = {
            polloCanalKgCop: 0, polloPieKgCop: 0, gallinaDescarteUnitCop: 0, patoCanalKgCop: 0,
            conejoCanalKgCop: 0, cuyPieUnitCop: 0, cuyCanalKgCop: 0,
          };
          const emptyFeed = {
            maizAmarilloKgCop: 0, tortaSoyaKgCop: 0, concentrado40KgBagCop: 0, concentradoKgCop: 0,
          };
          const payload: MarketPricesPayload = {
            schemaVersion: 2,
            regionDepartment: configuredFarmZone.department || "Colombia",
            coverageScope,
            coverageLabel,
            periodLabel,
            configuredFarmZone,
            sourceStatus: { sipsa: sipsaOk ? "ok" : "fallback", trm: trmOk ? "ok" : "fallback" },
            trmCopPerUsd,
            trmDate,
            eggs: emptyPrices,
            meat: emptyMeat,
            feed: emptyFeed,
            selectedZonePrices: {
              eggAaCopUnit: 0, eggACopUnit: 0, broilerLiveCopKg: 0, broilerCarcassCopKg: 0,
              cullHenCopUnit: 0, rabbitCopKg: 0, quailEggCopUnit: 0, cornYellowCopKg: 0,
              soybeanMealCopKg: 0, balancedFeed40KgCop: 0,
            },
            regionalPrices: observations,
            sipsaSampleRows: observations,
            note: "SIPSA entrega observaciones de producto y ciudad, pero este servicio no informa unidad comercial ni categoría operativa para todos los productos. Los valores se muestran como observaciones y no se convierten en precios maestros ni se usan como costos calculados. La TRM se consulta por separado.",
          };
          const status = sipsaOk && trmOk ? "ok" : "fallback";
          const summary = `${observations.length} observaciones SIPSA · ${trmOk ? `TRM ${trmDate}: $${trmCopPerUsd.toLocaleString("es-CO")}` : "TRM pendiente"}`;
          return saveExternalSnapshot({
            sourceKey: "dane_sipsa_trm",
            wave: 1,
            status,
            providerName: `${sipsaProviderName} + TRM SFC`,
            sourceUrl: sipsaSourceUrl,
            payload,
            summary,
            ttlHours: syncConfig.marketTtlHours,
            lastError: errors.length > 0 ? errors.join(" | ") : null,
          });
        }

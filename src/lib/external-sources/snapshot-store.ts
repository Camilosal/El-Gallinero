import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { externalDataSnapshots, externalSourceObservations } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";

export type ExternalSourceKey =
  | "divipola_dane"
  | "open_meteo"
  | "dane_sipsa_trm"
  | "dane_sipsa_i"
  | "dane_price_indices"
  | "dane_labor_geih"
  | "banrep_sdmx"
  | "ideam_hydro_alerts"
  | "standards_normative_feed"
  | "ica_vademecum_alerts"
  | "colombia_tax_holidays"
  | "iot_telemetry_bridge";

export type ExternalSnapshotStatus = "ok" | "fallback" | "error" | "manual";

export interface StoredExternalSnapshot<T = Record<string, unknown>> {
  id: string;
  sourceKey: ExternalSourceKey | string;
  wave: number;
  status: ExternalSnapshotStatus | string;
  syncMode: string;
  providerName: string;
  sourceUrl: string | null;
  scopeKey: string;
  payload: T;
  summary: string | null;
  fetchedAt: Date;
  expiresAt: Date | null;
  lastError: string | null;
}

export interface ExternalObservationInput {
  sourceKey: string;
  observationKey: string;
  observedAt: Date;
  value: number;
  unit?: string | null;
  providerName: string;
  sourceUrl?: string | null;
  dimensions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 3500,
  maxBytes = 8_000_000,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "ElCorralOpenSource/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const contentLength = Number(res.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      void res.body?.cancel().catch(() => undefined);
      return { ok: false, error: "Respuesta supera el límite de " + maxBytes + " bytes" };
    }
    if (!res.body) return { ok: false, error: "La fuente respondió sin contenido" };
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let totalBytes = 0;
    let body = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, error: "Respuesta supera el límite de " + maxBytes + " bytes" };
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    return { ok: true, data: JSON.parse(body) as T };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de red";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTextWithTimeout(
  url: string,
  timeoutMs = 10000,
  maxBytes = 8_000_000,
): Promise<{ ok: true; data: string } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "text/csv, text/plain;q=0.9, */*;q=0.1", "User-Agent": "IwaGranja/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      void response.body?.cancel().catch(() => undefined);
      return { ok: false, error: `Respuesta supera el límite de ${maxBytes} bytes` };
    }
    if (!response.body) return { ok: false, error: "La fuente respondió sin contenido" };
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let totalBytes = 0;
    let data = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, error: `Respuesta supera el límite de ${maxBytes} bytes` };
      }
      data += decoder.decode(value, { stream: true });
    }
    data += decoder.decode();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchBytesWithTimeout(
  url: string,
  timeoutMs = 20000,
  maxBytes = 20_000_000,
): Promise<{ ok: true; data: Uint8Array } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream;q=0.9, */*;q=0.1", "User-Agent": "IwaGranja/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      void response.body?.cancel().catch(() => undefined);
      return { ok: false, error: `Archivo supera el límite de ${maxBytes} bytes` };
    }
    if (!response.body) return { ok: false, error: "La fuente respondió sin contenido" };
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, error: `Archivo supera el límite de ${maxBytes} bytes` };
      }
      chunks.push(value);
    }
    const data = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error de red" };
  } finally {
    clearTimeout(timer);
  }
}

export interface SipsaCityPriceObservation {
  city: string;
  productCode: string;
  capturedAt: string;
  createdAt: string;
  averagePriceCop: number;
  product: string;
  recordId: string;
}

function decodeXmlText(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .trim();
}

function xmlField(block: string, field: string): string {
  const match = block.match(new RegExp(`<(?:(?:[\\w.-]+):)?${field}\\b[^>]*>([\\s\\S]*?)<\\/(?:(?:[\\w.-]+):)?${field}\\s*>`, "i"));
  return match ? decodeXmlText(match[1].replace(/<[^>]+>/g, "")) : "";
}

export function parseSipsaCityPriceXml(xml: string): SipsaCityPriceObservation[] {
  if (/<(?:[\w.-]+:)?Fault\b/i.test(xml)) {
    throw new Error("DANE SIPSA respondió con un error SOAP");
  }
  const rows: SipsaCityPriceObservation[] = [];
  const returnBlocks = xml.match(/<(?:[\w.-]+:)?return\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?return\s*>/gi) || [];
  for (const block of returnBlocks) {
    const averagePriceCop = Number(xmlField(block, "precioPromedio"));
    const row: SipsaCityPriceObservation = {
      city: xmlField(block, "ciudad"),
      productCode: xmlField(block, "codProducto"),
      capturedAt: xmlField(block, "fechaCaptura"),
      createdAt: xmlField(block, "fechaCreacion"),
      averagePriceCop,
      product: xmlField(block, "producto"),
      recordId: xmlField(block, "regId"),
    };
    if (
      row.product &&
      row.city &&
      row.recordId &&
      Number.isFinite(averagePriceCop) &&
      averagePriceCop > 0 &&
      !Number.isNaN(Date.parse(row.capturedAt))
    ) {
      rows.push(row);
    }
  }
  if (rows.length === 0 && /<soap:Body\b|<env:Body\b|<soap12:Body\b/i.test(xml)) {
    throw new Error("La respuesta SIPSA no contiene observaciones con campos válidos");
  }
  return rows;
}

export async function fetchSipsaCityPricesWithTimeout(
  endpoint = process.env.SIPSA_SOAP_URL || "http://appweb.dane.gov.co:9001/sipsaWS/SrvSipsaUpraBeanService",
  timeoutMs = 10000,
): Promise<{ ok: true; data: SipsaCityPriceObservation[] } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const envelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:tns="http://servicios.sipsa.co.gov.dane/">
  <soap12:Header/>
  <soap12:Body><tns:promediosSipsaCiudad/></soap12:Body>
</soap12:Envelope>`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/soap+xml, text/xml",
        "Content-Type": "application/soap+xml; charset=utf-8",
        "User-Agent": "IwaGranja/1.0 (DANE SIPSA connector)",
      },
      body: envelope,
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}` };
    const maxBytes = 12_000_000;
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      void response.body?.cancel().catch(() => undefined);
      return { ok: false, error: "Respuesta SIPSA supera el tamaño máximo permitido" };
    }
    if (!response.body) return { ok: false, error: "Respuesta SIPSA sin contenido" };
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let totalBytes = 0;
    let xml = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, error: "Respuesta SIPSA supera el tamaño máximo permitido" };
      }
      xml += decoder.decode(value, { stream: true });
    }
    xml += decoder.decode();
    return { ok: true, data: parseSipsaCityPriceXml(xml) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de red";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

export async function saveExternalObservations(inputs: ExternalObservationInput[]): Promise<number> {
  if (inputs.length === 0) return 0;
  if (inputs.length > 5000) {
    throw new Error("La escritura admite hasta 5.000 observaciones por lote; divida el lote antes de guardar");
  }
  const farmId = getCurrentFarmId();
  const uniqueInputs = new Map<string, ExternalObservationInput>();
  for (const row of inputs) {
    if (
      !Number.isFinite(row.value) || Math.abs(row.value) >= 1_000_000_000_000 ||
      !Number.isFinite(row.observedAt.getTime()) ||
      !row.sourceKey.trim() || row.sourceKey.length > 60 ||
      !row.observationKey.trim() || row.observationKey.length > 200 ||
      row.unit != null && row.unit.length > 60 ||
      !row.providerName.trim() || row.providerName.length > 120 ||
      row.sourceUrl != null && row.sourceUrl.length > 500
    ) {
      throw new Error("Observación externa inválida: verifique valor, periodo y límites del esquema");
    }
    const key = JSON.stringify([row.sourceKey, row.observationKey]);
    if (!uniqueInputs.has(key)) uniqueInputs.set(key, row);
  }
  const rows = [...uniqueInputs.values()].map((row) => ({
      farmId,
      sourceKey: row.sourceKey,
      observationKey: row.observationKey.slice(0, 200),
      observedAt: row.observedAt,
      value: String(row.value),
      unit: row.unit ?? null,
      providerName: row.providerName,
      sourceUrl: row.sourceUrl ?? null,
      dimensions: row.dimensions ?? {},
      metadata: row.metadata ?? {},
      ingestedAt: new Date(),
    }));
  if (rows.length === 0) return 0;
  await db
    .insert(externalSourceObservations)
    .values(rows)
    .onConflictDoUpdate({
      target: [externalSourceObservations.farmId, externalSourceObservations.sourceKey, externalSourceObservations.observationKey],
      set: {
        observedAt: sql`excluded.observed_at`,
        value: sql`excluded.value`,
        unit: sql`excluded.unit`,
        providerName: sql`excluded.provider_name`,
        sourceUrl: sql`excluded.source_url`,
        dimensions: sql`excluded.dimensions`,
        metadata: sql`excluded.metadata`,
        ingestedAt: new Date(),
      },
    });
  return rows.length;
}

export async function listExternalObservations(
  sourceKey: string,
  limit = 100,
): Promise<Array<typeof externalSourceObservations.$inferSelect>> {
  const farmId = getCurrentFarmId();
  try {
    return await db
      .select()
      .from(externalSourceObservations)
      .where(and(eq(externalSourceObservations.farmId, farmId), eq(externalSourceObservations.sourceKey, sourceKey)))
      .orderBy(desc(externalSourceObservations.observedAt))
      .limit(Math.max(1, Math.min(5000, Math.floor(limit))));
  } catch {
    return [];
  }
}

export async function getExternalSnapshot<T extends Record<string, unknown>>(
  sourceKey: ExternalSourceKey,
  scopeKey = "global",
): Promise<StoredExternalSnapshot<T> | null> {
  const farmId = getCurrentFarmId();
  try {
    const [row] = await db
      .select()
      .from(externalDataSnapshots)
      .where(
        and(
          eq(externalDataSnapshots.farmId, farmId),
          eq(externalDataSnapshots.sourceKey, sourceKey),
          eq(externalDataSnapshots.scopeKey, scopeKey),
        ),
      )
      .limit(1);
    if (!row) return null;
    return {
      ...row,
      payload: (row.payload || {}) as T,
    };
  } catch {
    return null;
  }
}

export async function listExternalSnapshots(): Promise<StoredExternalSnapshot[]> {
  const farmId = getCurrentFarmId();
  try {
    const rows = await db
      .select()
      .from(externalDataSnapshots)
      .where(eq(externalDataSnapshots.farmId, farmId))
      .orderBy(externalDataSnapshots.wave, desc(externalDataSnapshots.fetchedAt));
    return rows.map((row) => ({
      ...row,
      payload: (row.payload || {}) as Record<string, unknown>,
    }));
  } catch {
    return [];
  }
}

export function isSnapshotExpired(snapshot: StoredExternalSnapshot | null | undefined): boolean {
  if (!snapshot) return true;
  if (!snapshot.expiresAt) return false;
  return new Date(snapshot.expiresAt).getTime() <= Date.now();
}

export async function saveExternalSnapshot<T extends Record<string, unknown>>(input: {
  sourceKey: ExternalSourceKey;
  wave: number;
  status: ExternalSnapshotStatus;
  syncMode?: "auto" | "manual";
  providerName: string;
  sourceUrl?: string | null;
  scopeKey?: string;
  payload: T;
  summary: string;
  ttlHours: number;
  lastError?: string | null;
}): Promise<StoredExternalSnapshot<T>> {
  const farmId = getCurrentFarmId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + Math.max(1, input.ttlHours) * 3600 * 1000);
  const scopeKey = input.scopeKey || "global";

  try {
    const [saved] = await db
      .insert(externalDataSnapshots)
      .values({
        farmId,
        sourceKey: input.sourceKey,
        wave: input.wave,
        status: input.status,
        syncMode: input.syncMode || "auto",
        providerName: input.providerName,
        sourceUrl: input.sourceUrl ?? null,
        scopeKey,
        payload: input.payload,
        summary: input.summary,
        fetchedAt: now,
        expiresAt,
        lastError: input.lastError ?? null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [externalDataSnapshots.farmId, externalDataSnapshots.sourceKey, externalDataSnapshots.scopeKey],
        set: {
          wave: input.wave,
          status: input.status,
          syncMode: input.syncMode || "auto",
          providerName: input.providerName,
          sourceUrl: input.sourceUrl ?? null,
          payload: input.payload,
          summary: input.summary,
          fetchedAt: now,
          expiresAt,
          lastError: input.lastError ?? null,
          updatedAt: now,
        },
      })
      .returning();

    return {
      ...saved,
      payload: (saved.payload || input.payload) as T,
    };
  } catch {
    return {
      id: `memory-${input.sourceKey}-${scopeKey}`,
      sourceKey: input.sourceKey,
      wave: input.wave,
      status: input.status,
      syncMode: input.syncMode || "auto",
      providerName: input.providerName,
      sourceUrl: input.sourceUrl ?? null,
      scopeKey,
      payload: input.payload,
      summary: input.summary,
      fetchedAt: now,
      expiresAt,
      lastError: input.lastError ?? null,
    };
  }
}

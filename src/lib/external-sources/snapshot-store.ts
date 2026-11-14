import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { externalDataSnapshots } from "@/db/schema";
import { getCurrentFarmId } from "@/db/tenant-context";

export type ExternalSourceKey =
  | "divipola_dane"
  | "open_meteo"
  | "dane_sipsa_trm"
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

export async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs = 3500,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json", "User-Agent": "ElGallineroOpenSource/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de red";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
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
  wave: 1 | 2 | 3;
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

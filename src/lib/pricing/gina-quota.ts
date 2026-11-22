import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { ginaUsageEvents } from "@/db/schema";
import type { PricingPlanKey } from "./types";
import type { PlanEntitlements } from "./entitlements";

export type GinaModality = "message" | "audio" | "attachment";

export interface GinaUsageCounts {
  messages: number;
  audios: number;
  attachments: number;
}

export interface GinaQuotaLimits extends GinaUsageCounts {
  maxAudioSeconds: number;
  rollover: boolean;
}

export interface GinaQuotaSnapshot {
  plan: PricingPlanKey;
  cycleStart: string;
  cycleResetsAt: string;
  limits: GinaQuotaLimits;
  used: GinaUsageCounts;
  pending: GinaUsageCounts;
  remaining: GinaUsageCounts;
}

export type GinaReservationResult =
  | { allowed: true; eventId: string; quota: GinaQuotaSnapshot }
  | {
      allowed: false;
      code: "GINA_QUOTA_EXCEEDED" | "GINA_REQUEST_IN_PROGRESS" | "GINA_REQUEST_ALREADY_PROCESSED" | "GINA_REQUEST_ID_REUSED";
      error: string;
      quota: GinaQuotaSnapshot;
    };

function getCycleStart(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value || "1970";
  const month = parts.find((part) => part.type === "month")?.value || "01";
  return `${year}-${month}-01`;
}

function nextCycleDate(cycleStart: string): string {
  const date = new Date(`${cycleStart}T00:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function zeroCounts(): GinaUsageCounts {
  return { messages: 0, audios: 0, attachments: 0 };
}

function ginaLimits(entitlements: PlanEntitlements): GinaQuotaLimits {
  return {
    messages: entitlements.gina.messagesPerMonth,
    audios: entitlements.gina.audiosPerMonth,
    attachments: entitlements.gina.attachmentsPerMonth,
    maxAudioSeconds: entitlements.gina.maxAudioSeconds,
    rollover: entitlements.gina.rollover,
  };
}

function requestUnits(modality: GinaModality): GinaUsageCounts {
  return {
    messages: 1,
    audios: modality === "audio" ? 1 : 0,
    attachments: modality === "attachment" ? 1 : 0,
  };
}

export function canConsumeGinaQuota(
  used: GinaUsageCounts,
  limits: GinaUsageCounts,
  modality: GinaModality,
): boolean {
  const requested = requestUnits(modality);
  return used.messages + requested.messages <= limits.messages &&
    used.audios + requested.audios <= limits.audios &&
    used.attachments + requested.attachments <= limits.attachments;
}

function makeSnapshot(
  plan: PricingPlanKey,
  cycleStart: string,
  limits: GinaQuotaLimits,
  used: GinaUsageCounts,
  pending: GinaUsageCounts = zeroCounts(),
): GinaQuotaSnapshot {
  const consumedAndPending = {
    messages: used.messages + pending.messages,
    audios: used.audios + pending.audios,
    attachments: used.attachments + pending.attachments,
  };
  return {
    plan,
    cycleStart,
    cycleResetsAt: nextCycleDate(cycleStart),
    limits,
    used,
    pending,
    remaining: {
      messages: Math.max(0, limits.messages - consumedAndPending.messages),
      audios: Math.max(0, limits.audios - consumedAndPending.audios),
      attachments: Math.max(0, limits.attachments - consumedAndPending.attachments),
    },
  };
}

function countsFromRow(row: { messages?: number | null; audios?: number | null; attachments?: number | null } | undefined): GinaUsageCounts {
  return {
    messages: Number(row?.messages || 0),
    audios: Number(row?.audios || 0),
    attachments: Number(row?.attachments || 0),
  };
}

async function readCounts(
  client: typeof db | any,
  farmId: string,
  userId: string,
  cycleStart: string,
): Promise<{ used: GinaUsageCounts; pending: GinaUsageCounts }> {
  const [row] = await client
    .select({
      usedMessages: sql<number>`coalesce(sum(case when ${ginaUsageEvents.status} = 'consumed' then ${ginaUsageEvents.messageUnits} else 0 end), 0)::int`,
      usedAudios: sql<number>`coalesce(sum(case when ${ginaUsageEvents.status} = 'consumed' then ${ginaUsageEvents.audioUnits} else 0 end), 0)::int`,
      usedAttachments: sql<number>`coalesce(sum(case when ${ginaUsageEvents.status} = 'consumed' then ${ginaUsageEvents.attachmentUnits} else 0 end), 0)::int`,
      pendingMessages: sql<number>`coalesce(sum(case when ${ginaUsageEvents.status} = 'reserved' then ${ginaUsageEvents.messageUnits} else 0 end), 0)::int`,
      pendingAudios: sql<number>`coalesce(sum(case when ${ginaUsageEvents.status} = 'reserved' then ${ginaUsageEvents.audioUnits} else 0 end), 0)::int`,
      pendingAttachments: sql<number>`coalesce(sum(case when ${ginaUsageEvents.status} = 'reserved' then ${ginaUsageEvents.attachmentUnits} else 0 end), 0)::int`,
    })
    .from(ginaUsageEvents)
    .where(and(
      eq(ginaUsageEvents.farmId, farmId),
      eq(ginaUsageEvents.userId, userId),
      eq(ginaUsageEvents.cycleStart, cycleStart),
      inArray(ginaUsageEvents.status, ["reserved", "consumed"]),
    ));

  return {
    used: countsFromRow({ messages: row?.usedMessages, audios: row?.usedAudios, attachments: row?.usedAttachments }),
    pending: countsFromRow({ messages: row?.pendingMessages, audios: row?.pendingAudios, attachments: row?.pendingAttachments }),
  };
}

function quotaMessage(modality: GinaModality, quota: GinaQuotaSnapshot): string {
  const item = modality === "message" ? "consultas" : modality === "audio" ? "audios" : "adjuntos";
  return `Alcanzaste el cupo mensual de ${item} de Gina en el plan ${quota.plan === "free" ? "Gratis" : quota.plan === "producer" ? "Productor" : "Organización"}. Se renueva el ${quota.cycleResetsAt}. Los registros normales de la granja siguen disponibles.`;
}

export async function getGinaQuotaSnapshot(input: {
  farmId: string;
  userId: string;
  entitlements: PlanEntitlements;
  now?: Date;
}): Promise<GinaQuotaSnapshot> {
  const cycleStart = getCycleStart(input.now);
  const { used, pending } = await readCounts(db, input.farmId, input.userId, cycleStart);
  return makeSnapshot(input.entitlements.plan, cycleStart, ginaLimits(input.entitlements), used, pending);
}

export async function reserveGinaUsage(input: {
  farmId: string;
  userId: string;
  entitlements: PlanEntitlements;
  modality: GinaModality;
  requestId?: string | null;
  requestFingerprint: string;
  now?: Date;
}): Promise<GinaReservationResult> {
  const cycleStart = getCycleStart(input.now);
  const limits = ginaLimits(input.entitlements);
  const requestId = String(input.requestId || randomUUID()).trim().slice(0, 100);
  const idempotencyKey = createHash("sha256")
    .update(`${input.userId}\0${cycleStart}\0${requestId}`)
    .digest("hex");
  const requestHash = createHash("sha256")
    .update(`${input.modality}\0${input.requestFingerprint}`)
    .digest("hex");
  const now = input.now || new Date();
  const staleReservationCutoff = new Date(now.getTime() - 15 * 60 * 1000);

  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`gina-quota:${input.farmId}:${input.userId}:${cycleStart}`}))`);
    await tx.update(ginaUsageEvents)
      .set({ status: "void", updatedAt: now })
      .where(and(
        eq(ginaUsageEvents.farmId, input.farmId),
        eq(ginaUsageEvents.userId, input.userId),
        eq(ginaUsageEvents.cycleStart, cycleStart),
        eq(ginaUsageEvents.status, "reserved"),
        lt(ginaUsageEvents.createdAt, staleReservationCutoff),
      ));

    const [existing] = await tx.select().from(ginaUsageEvents)
      .where(and(eq(ginaUsageEvents.farmId, input.farmId), eq(ginaUsageEvents.idempotencyKey, idempotencyKey)))
      .limit(1);
    if (existing && existing.requestHash !== requestHash) {
      const counts = await readCounts(tx, input.farmId, input.userId, cycleStart);
      const quota = makeSnapshot(input.entitlements.plan, cycleStart, limits, counts.used, counts.pending);
      return { allowed: false, code: "GINA_REQUEST_ID_REUSED", error: "Esta solicitud ya se usó con un contenido distinto. Inténtalo de nuevo.", quota };
    }
    if (existing?.status === "consumed") {
      const counts = await readCounts(tx, input.farmId, input.userId, cycleStart);
      const quota = makeSnapshot(input.entitlements.plan, cycleStart, limits, counts.used, counts.pending);
      return { allowed: false, code: "GINA_REQUEST_ALREADY_PROCESSED", error: "Esta solicitud ya fue procesada. Revisa el resultado antes de volver a enviarla.", quota };
    }
    if (existing?.status === "reserved") {
      const counts = await readCounts(tx, input.farmId, input.userId, cycleStart);
      const quota = makeSnapshot(input.entitlements.plan, cycleStart, limits, counts.used, counts.pending);
      return { allowed: false, code: "GINA_REQUEST_IN_PROGRESS", error: "Esta solicitud de Gina sigue en proceso.", quota };
    }

    const counts = await readCounts(tx, input.farmId, input.userId, cycleStart);
    const usedAndPending: GinaUsageCounts = {
      messages: counts.used.messages + counts.pending.messages,
      audios: counts.used.audios + counts.pending.audios,
      attachments: counts.used.attachments + counts.pending.attachments,
    };
    if (!canConsumeGinaQuota(usedAndPending, limits, input.modality)) {
      const quota = makeSnapshot(input.entitlements.plan, cycleStart, limits, counts.used, counts.pending);
      return { allowed: false, code: "GINA_QUOTA_EXCEEDED", error: quotaMessage(input.modality, quota), quota };
    }

    const units = requestUnits(input.modality);
    const eventId = existing?.id || randomUUID();
    if (existing) {
      await tx.update(ginaUsageEvents).set({
        status: "reserved",
        cycleStart,
        modality: input.modality,
        messageUnits: units.messages,
        audioUnits: units.audios,
        attachmentUnits: units.attachments,
        createdAt: now,
        consumedAt: null,
        updatedAt: now,
      }).where(eq(ginaUsageEvents.id, eventId));
    } else {
      await tx.insert(ginaUsageEvents).values({
        id: eventId,
        farmId: input.farmId,
        userId: input.userId,
        idempotencyKey,
        requestHash,
        cycleStart,
        modality: input.modality,
        messageUnits: units.messages,
        audioUnits: units.audios,
        attachmentUnits: units.attachments,
        status: "reserved",
        createdAt: now,
        updatedAt: now,
      });
    }
    const quota = makeSnapshot(input.entitlements.plan, cycleStart, limits, counts.used, {
      messages: counts.pending.messages + units.messages,
      audios: counts.pending.audios + units.audios,
      attachments: counts.pending.attachments + units.attachments,
    });
    return { allowed: true, eventId, quota };
  });
}

export async function finishGinaUsage(eventId: string, consumed: boolean): Promise<void> {
  const now = new Date();
  await db.update(ginaUsageEvents).set({
    status: consumed ? "consumed" : "void",
    consumedAt: consumed ? now : null,
    updatedAt: now,
  }).where(and(eq(ginaUsageEvents.id, eventId), eq(ginaUsageEvents.status, "reserved")));
}

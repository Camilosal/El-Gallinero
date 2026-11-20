import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { transcribeAudioBlob } from "@/lib/agent/stt";
import { createHash } from "node:crypto";
import { getSessionUser } from "@/lib/auth";
import { getCurrentFarmId } from "@/db/tenant-context";
import { getFarmSubscriptionStatus } from "@/lib/subscription";
import { finishGinaUsage, getGinaQuotaSnapshot, reserveGinaUsage } from "@/lib/pricing/gina-quota";

export const dynamic = "force-dynamic";

/** POST /api/asistente/transcribir — transcribe una nota de voz en español si hay proveedor STT configurado. */
export const POST = withApiHandler(async (req: NextRequest) => {
  const formData = await req.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Archivo de audio requerido" }, { status: 400 });
  }
  const durationInput = Number(formData?.get("durationSec"));
  if (!Number.isFinite(durationInput) || durationInput <= 0 || durationInput > 3600) {
    return NextResponse.json({ error: "No se pudo validar la duración de la nota de voz." }, { status: 400 });
  }
  const durationSec = Math.ceil(durationInput);
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const farmId = (user as { farmId?: string | null }).farmId || getCurrentFarmId();
  const subscription = await getFarmSubscriptionStatus(farmId);
  if (durationSec > subscription.entitlements.gina.maxAudioSeconds) {
    return NextResponse.json({
      error: `El plan ${subscription.planName} permite audios de hasta ${subscription.entitlements.gina.maxAudioSeconds} segundos.`,
      code: "GINA_AUDIO_TOO_LONG",
      maxAudioSeconds: subscription.entitlements.gina.maxAudioSeconds,
    }, { status: 413 });
  }
  const requestFingerprint = createHash("sha256")
    .update(Buffer.from(await audio.arrayBuffer()))
    .digest("hex");
  const reservation = await reserveGinaUsage({
    farmId,
    userId: user.id,
    entitlements: subscription.entitlements,
    modality: "audio",
    requestId: req.headers.get("x-gina-request-id"),
    requestFingerprint,
  });
  if (!reservation.allowed) {
    const status = reservation.code === "GINA_QUOTA_EXCEEDED" ? 429 : 409;
    return NextResponse.json({ error: reservation.error, code: reservation.code, quota: reservation.quota }, { status });
  }

  try {
    const result = await transcribeAudioBlob(audio);
    if (!result.configured || result.error) {
      await finishGinaUsage(reservation.eventId, false);
      return NextResponse.json(
        { configured: result.configured, error: result.error },
        { status: result.status },
      );
    }
    await finishGinaUsage(reservation.eventId, true);
    const quota = await getGinaQuotaSnapshot({ farmId, userId: user.id, entitlements: subscription.entitlements });
    return NextResponse.json({ configured: true, text: result.text || "", ginaQuota: quota });
  } catch (error) {
    await finishGinaUsage(reservation.eventId, false).catch(() => undefined);
    throw error;
  }
});

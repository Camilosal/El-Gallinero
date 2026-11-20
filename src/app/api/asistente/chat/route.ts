import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getAgentConfig } from "@/lib/agent/config";
import { AgentNotConfiguredError, runAgentTurn } from "@/lib/agent/runtime";
import { getCurrentFarmId } from "@/db/tenant-context";
import { getFarmSubscriptionStatus } from "@/lib/subscription";
import { finishGinaUsage, getGinaQuotaSnapshot, reserveGinaUsage } from "@/lib/pricing/gina-quota";

export const dynamic = "force-dynamic";

/** POST /api/asistente/chat — un turno de conversación con el asistente. */
export const POST = withApiHandler(async (req: NextRequest) => {
  if (!getAgentConfig()) {
    return NextResponse.json(
      {
        error: "El asistente no está configurado. Agrega ASSISTANT_AI_API_KEY en el servidor.",
        configured: false,
      },
      { status: 503 },
    );
  }

  const body = await safeParseJson(req);
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const message = String(body.message || "").trim();
  if (!message) return NextResponse.json({ error: "Escribe una consulta para Gina." }, { status: 400 });

  const farmId = (user as { farmId?: string | null }).farmId || getCurrentFarmId();
  const subscription = await getFarmSubscriptionStatus(farmId);
  const reservation = await reserveGinaUsage({
    farmId,
    userId: user.id,
    entitlements: subscription.entitlements,
    modality: "message",
    requestId: req.headers.get("x-gina-request-id") || req.headers.get("x-client-mutation-id"),
    requestFingerprint: `${String(body.conversationId || "")}\0${message}`,
  });
  if (!reservation.allowed) {
    const status = reservation.code === "GINA_QUOTA_EXCEEDED" ? 429 : 409;
    return NextResponse.json(
      { error: reservation.error, code: reservation.code, quota: reservation.quota },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await runAgentTurn({
      userId: user.id,
      userName: user.name || user.username,
      conversationId: body.conversationId ? String(body.conversationId) : null,
      message,
      cookie: req.headers.get("cookie"),
      requestOrigin: req.nextUrl.origin,
    });
    await finishGinaUsage(reservation.eventId, true);
    const quota = await getGinaQuotaSnapshot({ farmId, userId: user.id, entitlements: subscription.entitlements });
    return NextResponse.json({ configured: true, ...result, ginaQuota: quota });
  } catch (error) {
    await finishGinaUsage(reservation.eventId, false).catch(() => undefined);
    if (error instanceof AgentNotConfiguredError) {
      return NextResponse.json({ error: error.message, configured: false }, { status: 503 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error del asistente" },
      { status: 400 },
    );
  }
});

import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { farms } from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { withErrorHandler } from "@/lib/api-handler";
import { buildDailyBriefing } from "@/lib/agent/proactive";

export const dynamic = "force-dynamic";

// C1: mismo patrón de seguridad que /api/cron/fuentes-externas.
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || "";
  const actual = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "El agente proactivo programado no está configurado" }, { status: 503 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const farmRows = await db.select({ id: farms.id }).from(farms);
  const farmIds = [...new Set([DEFAULT_FARM_ID, ...farmRows.map((row) => row.id)])];
  let created = 0;
  let existing = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const farmId of farmIds) {
    try {
      const result = await runWithFarmContext(farmId, async () => {
        const built = await buildDailyBriefing();
        if (built.created) {
          // C2: entrega saliente por Telegram; degrada sin token/chats sin fallar el cron.
          const { deliverBriefingViaTelegram } = await import("@/lib/telegram");
          await deliverBriefingViaTelegram(built.briefing).catch((error) => {
            console.error("[cron/agente-proactivo] Entrega Telegram fallida:", error);
          });
        }
        return built;
      });
      if (result.created) created += 1;
      else existing += 1;
    } catch (error) {
      failed += 1;
      errors.push(`${farmId}: ${error instanceof Error ? error.message : "Error desconocido"}`.slice(0, 300));
    }
  }

  return NextResponse.json(
    {
      ok: failed === 0,
      farmsProcessed: farmIds.length,
      briefingsCreated: created,
      briefingsExisting: existing,
      failures: failed,
      errors: errors.slice(0, 5),
    },
    { status: failed === 0 ? 200 : 207 },
  );
});
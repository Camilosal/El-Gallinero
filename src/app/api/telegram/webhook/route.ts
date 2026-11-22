import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/api-handler";
import { processTelegramUpdate, type TelegramUpdate } from "@/lib/agent/telegram-channel";

export const dynamic = "force-dynamic";

/**
 * C3: webhook del bot de Telegram. Ruta pública (sin sesión) protegida por
 * X-Telegram-Bot-Api-Secret-Token contra TELEGRAM_WEBHOOK_SECRET.
 */
function isAuthorized(req: NextRequest): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET || "";
  const actual = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (!expected || !actual) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "El canal Telegram no está configurado" }, { status: 503 });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  if (!update || typeof update !== "object") {
    return NextResponse.json({ error: "Update inválido" }, { status: 400 });
  }

  const result = await processTelegramUpdate(update);
  return NextResponse.json(result, { status: result.status });
});
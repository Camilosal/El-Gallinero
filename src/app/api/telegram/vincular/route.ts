import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramChats } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { isTelegramConfigured } from "@/lib/telegram";
import { createPairingCode } from "@/lib/agent/telegram-channel";

export const dynamic = "force-dynamic";

// C3: vinculación de chats de Telegram al usuario de la sesión.
export const GET = withApiHandler(async () => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const chats = await db
    .select({
      id: telegramChats.id,
      chatId: telegramChats.chatId,
      status: telegramChats.status,
      linkedAt: telegramChats.linkedAt,
      lastSeenAt: telegramChats.lastSeenAt,
    })
    .from(telegramChats)
    .where(eq(telegramChats.userId, user.id));

  return NextResponse.json({ configured: isTelegramConfigured(), chats });
});

export const POST = withApiHandler(async () => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (!isTelegramConfigured()) {
    return NextResponse.json(
      { error: "El canal Telegram no está configurado en el servidor (falta TELEGRAM_BOT_TOKEN)." },
      { status: 503 },
    );
  }

  const pairing = await createPairingCode(user.id, user.farmId);
  return NextResponse.json({ ...pairing, ttlMinutes: 10 });
});

export const DELETE = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await safeParseJson(req);
  const id = body && typeof body === "object" ? String(body.id || "").trim() : "";
  if (!id) return NextResponse.json({ error: "El id del chat es requerido" }, { status: 400 });

  const [chat] = await db
    .select()
    .from(telegramChats)
    .where(and(eq(telegramChats.id, id), eq(telegramChats.userId, user.id)))
    .limit(1);
  if (!chat) return NextResponse.json({ error: "Chat no encontrado para este usuario" }, { status: 404 });

  await db.update(telegramChats).set({ status: "revocado" }).where(eq(telegramChats.id, chat.id));
  return NextResponse.json({ ok: true, id: chat.id, status: "revocado" });
});
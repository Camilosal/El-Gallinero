import crypto from "node:crypto";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiActions, appSettings, telegramChats, users } from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import { todayColombiaIso } from "@/lib/date-validation";
import {
  answerCallbackQuery,
  confirmationKeyboard,
  downloadTelegramVoice,
  editMessageReplyMarkup,
  escapeTelegramHtml,
  getTelegramFilePath,
  sendTelegramChatAction,
  sendTelegramMessage,
} from "@/lib/telegram";
import { AgentNotConfiguredError, cancelAction, confirmAction, runAgentTurn } from "./runtime";
import { isAgentConfigured } from "./config";
import { formatSituationalBrief, getLiveSituationalSnapshot } from "./situational";
import { buildDailyBriefing, listBriefings } from "./proactive";
import { transcribeAudioBlob } from "./stt";
import { withEphemeralSession } from "./ephemeral-session";

/**
 * C3: Telegram como canal de entrada bidireccional al agente.
 *
 * - Cada chat se vincula a UN usuario (código de pairing de un solo uso, 10 min).
 * - El chat hereda rol/RBAC del usuario: las herramientas llaman la API interna
 *   con una sesión efímera de ese usuario, igual que el widget web.
 * - Confirmaciones remotas con el mismo piso duro (teclado inline ✅/❌).
 * - Comandos deterministas /resumen /parte /estado /ayuda sin LLM.
 * - Auditoría: origin "telegram" + chat_id en ai_actions.
 */

export interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; first_name?: string };
    text?: string;
    voice?: { file_id: string; mime_type?: string };
  };
  callback_query?: {
    id: string;
    data?: string;
    from?: { id: number };
    message?: { message_id: number; chat: { id: number } };
  };
}

export interface ChannelResult {
  status: number;
  handled: boolean;
  action?: string;
  error?: string;
}

const PAIRING_PREFIX = "telegram.pairing.v1.";
const PAIRING_TTL_MS = 10 * 60 * 1000;
const CONVERSATIONS_KEY = "telegram.conversations.v1";
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_MESSAGES = 20;

const rateLimitBuckets = new Map<number, number[]>();

export function __resetTelegramRateLimitsForTests() {
  rateLimitBuckets.clear();
}

function checkRateLimit(chatId: number): boolean {
  const now = Date.now();
  const bucket = (rateLimitBuckets.get(chatId) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (bucket.length >= RATE_LIMIT_MAX_MESSAGES) {
    rateLimitBuckets.set(chatId, bucket);
    return false;
  }
  bucket.push(now);
  rateLimitBuckets.set(chatId, bucket);
  return true;
}

// ─── Pairing ───

export async function createPairingCode(userId: string, farmId: string): Promise<{ code: string; expiresAt: string }> {
  const code = crypto.randomBytes(4).toString("hex").toUpperCase();
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  await runWithFarmContext(farmId, async () => {
    // Limpieza oportunista de códigos expirados de la granja.
    const rows = await db.select().from(appSettings).where(like(appSettings.key, `${PAIRING_PREFIX}%`));
    for (const row of rows) {
      try {
        const parsed = JSON.parse(row.value);
        if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() < Date.now()) {
          await db.delete(appSettings).where(eq(appSettings.id, row.id));
        }
      } catch {
        await db.delete(appSettings).where(eq(appSettings.id, row.id));
      }
    }
    await db.insert(appSettings).values({
      key: `${PAIRING_PREFIX}${code}`,
      value: JSON.stringify({ userId, farmId, expiresAt: expiresAt.toISOString(), usedAt: null }),
      updatedBy: userId,
    });
  });
  return { code, expiresAt: expiresAt.toISOString() };
}

export type PairingFailure = "codigo_invalido" | "codigo_expirado" | "codigo_usado";

export async function consumePairingCode(
  rawCode: string,
  chatId: number,
): Promise<{ ok: true; userId: string; farmId: string } | { ok: false; reason: PairingFailure }> {
  const code = String(rawCode || "").trim().toUpperCase();
  if (!code) return { ok: false, reason: "codigo_invalido" };

  // Sin contexto de granja: el código puede venir de cualquier granja y el
  // webhook aún no sabe a cuál pertenece (consulta como superusuario).
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, `${PAIRING_PREFIX}${code}`))
    .limit(1);
  if (!row) return { ok: false, reason: "codigo_invalido" };

  let parsed: { userId: string; farmId: string; expiresAt: string; usedAt: string | null };
  try {
    parsed = JSON.parse(row.value);
  } catch {
    return { ok: false, reason: "codigo_invalido" };
  }
  if (parsed.usedAt) return { ok: false, reason: "codigo_usado" };
  if (!parsed.expiresAt || new Date(parsed.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "codigo_expirado" };
  }

  // Marcado de un solo uso atómico: si otro webhook lo consumió primero, falla.
  const [claimed] = await db
    .update(appSettings)
    .set({ value: JSON.stringify({ ...parsed, usedAt: new Date().toISOString() }), updatedAt: new Date() })
    .where(and(eq(appSettings.id, row.id), sql`(${appSettings.value}::jsonb ->> 'usedAt') IS NULL`))
    .returning();
  if (!claimed) return { ok: false, reason: "codigo_usado" };

  await db
    .insert(telegramChats)
    .values({ farmId: parsed.farmId, chatId, userId: parsed.userId, status: "activo" })
    .onConflictDoUpdate({
      target: telegramChats.chatId,
      set: { farmId: parsed.farmId, userId: parsed.userId, status: "activo", linkedAt: new Date(), lastSeenAt: new Date() },
    });

  return { ok: true, userId: parsed.userId, farmId: parsed.farmId };
}

// ─── Estado del vínculo ───

interface LinkedChat {
  id: string;
  chatId: number;
  userId: string;
  farmId: string;
  status: string;
  linkedAt: Date;
}

async function findChat(chatId: number): Promise<LinkedChat | null> {
  const [row] = await db.select().from(telegramChats).where(eq(telegramChats.chatId, chatId)).limit(1);
  return row || null;
}

async function getLinkedUser(userId: string) {
  const [row] = await db
    .select({ id: users.id, name: users.name, username: users.username, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row || null;
}

const PAIRING_INSTRUCTIONS =
  "🔗 Este chat aún no está vinculado a IwaGranja.\n\n" +
  "1. Entra a Configuración → Módulos → Canal Telegram en la app.\n" +
  "2. Pulsa «Generar código» (dura 10 minutos y es de un solo uso).\n" +
  "3. Envíame aquí: /start CODIGO\n\n" +
  "El chat quedará vinculado a TU usuario, con tu rol y permisos.";

// ─── Sesión efímera y conversación por chat ───

async function readStoredConversation(chat: LinkedChat): Promise<string | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, CONVERSATIONS_KEY)).limit(1);
  if (!row) return null;
  try {
    const map = JSON.parse(row.value) as Record<string, string>;
    return map[String(chat.chatId)] || null;
  } catch {
    return null;
  }
}

async function storeConversation(chat: LinkedChat, conversationId: string) {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, CONVERSATIONS_KEY)).limit(1);
  let map: Record<string, string> = {};
  try {
    map = row ? JSON.parse(row.value) : {};
  } catch {
    map = {};
  }
  map[String(chat.chatId)] = conversationId;
  const value = JSON.stringify(map);
  await db
    .insert(appSettings)
    .values({ key: CONVERSATIONS_KEY, value })
    .onConflictDoUpdate({ target: [appSettings.farmId, appSettings.key], set: { value, updatedAt: new Date() } });
}

// ─── Puente al agente ───

async function runTelegramAgentTurn(chat: LinkedChat, text: string): Promise<void> {
  await sendTelegramChatAction(chat.chatId, "typing");
  if (!isAgentConfigured()) {
    await sendTelegramMessage(
      chat.chatId,
      "🤖 Gina no está configurada en este servidor (falta la clave del asistente). Habla con el administrador de la granja.",
    );
    return;
  }

  await runWithFarmContext(chat.farmId, async () => {
    const user = await getLinkedUser(chat.userId);
    if (!user) {
      await sendTelegramMessage(chat.chatId, "⚠️ El usuario vinculado ya no existe. Genera un nuevo código de vinculación.");
      return;
    }
    const conversationId = await readStoredConversation(chat);
    const turnStart = new Date(Date.now() - 5_000);
    try {
      const result = await withEphemeralSession(chat.userId, chat.farmId, (cookie) =>
        runAgentTurn({
          userId: chat.userId,
          userName: user.name || user.username,
          conversationId,
          message: text,
          cookie,
          requestOrigin: process.env.APP_URL || undefined,
          origin: "telegram",
        }),
      );
      await storeConversation(chat, result.conversationId);

      // Auditoría C3: toda acción del turno queda con origin telegram + chat_id.
      await db
        .update(aiActions)
        .set({ chatId: chat.chatId })
        .where(
          and(
            eq(aiActions.conversationId, result.conversationId),
            eq(aiActions.userId, chat.userId),
            sql`${aiActions.createdAt} >= ${turnStart}`,
          ),
        );

      if (result.reply?.trim()) {
        await sendTelegramMessage(chat.chatId, escapeTelegramHtml(result.reply.trim()));
      }
      const freshPending = result.pendingActions.filter((a) => new Date(a.createdAt).getTime() >= turnStart.getTime());
      for (const action of freshPending) {
        await sendTelegramMessage(
          chat.chatId,
          `⚠️ <b>Acción pendiente de confirmación</b>\n${escapeTelegramHtml(action.summary)}`,
          { replyMarkup: confirmationKeyboard(action.id) },
        );
      }
    } catch (error) {
      const message =
        error instanceof AgentNotConfiguredError
          ? "🤖 Gina no está configurada en este servidor. Habla con el administrador."
          : `⚠️ No pude procesar tu mensaje: ${error instanceof Error ? error.message : "error desconocido"}`;
      await sendTelegramMessage(chat.chatId, escapeTelegramHtml(message));
    }
  });
}

// ─── Comandos deterministas (sin LLM) ───

async function handleCommand(chat: LinkedChat, command: string): Promise<void> {
  await runWithFarmContext(chat.farmId, async () => {
    if (command === "/resumen") {
      const snapshot = await getLiveSituationalSnapshot();
      const text = snapshot
        ? `📊 <b>Resumen de tu granja</b>\n\n${escapeTelegramHtml(formatSituationalBrief(snapshot))}`
        : "No pude leer el estado de la granja en este momento.";
      await sendTelegramMessage(chat.chatId, text);
      return;
    }
    if (command === "/parte") {
      const todayIso = todayColombiaIso();
      const briefings = await listBriefings(10);
      let briefing = briefings.find((b) => b.kind === "diario" && b.briefingDate === todayIso);
      if (!briefing) briefing = (await buildDailyBriefing({ narrate: false })).briefing;
      const findings = briefing.payload?.findings || [];
      const bullets = findings.map((f) => `• ${f.title}: ${f.detail}`).join("\n");
      const text = [`🐔 <b>Parte diario · ${escapeTelegramHtml(briefing.briefingDate)}</b>`, escapeTelegramHtml(briefing.narrative || ""), escapeTelegramHtml(bullets)]
        .filter(Boolean)
        .join("\n\n");
      await sendTelegramMessage(chat.chatId, text);
      return;
    }
    if (command === "/estado") {
      const user = await getLinkedUser(chat.userId);
      const text =
        `🔗 <b>Vínculo activo</b>\n\n` +
        `Usuario: ${escapeTelegramHtml(user?.name || user?.username || "desconocido")}\n` +
        `Rol: ${escapeTelegramHtml(user?.role || "sin rol")}\n` +
        `Vinculado desde: ${chat.linkedAt.toISOString().slice(0, 10)}\n\n` +
        `Este chat hereda los permisos de ese usuario. Usa /desvincular para cortarlo.`;
      await sendTelegramMessage(chat.chatId, text);
      return;
    }
    // /ayuda y cualquier otro comando desconocido
    await sendTelegramMessage(
      chat.chatId,
      "🤖 <b>Soy Gina, tu asistente de granja</b>\n\n" +
        "• Escríbeme o mándame notas de voz: registro huevos, alimento, mortalidad, ventas y más (las escrituras sensibles siempre piden confirmación).\n" +
        "• /resumen — estado actual de la granja\n" +
        "• /parte — parte diario de hoy\n" +
        "• /estado — vínculo y rol de este chat\n" +
        "• /desvincular — corta el vínculo de este chat\n" +
        "• /ayuda — este mensaje",
    );
  });
}

// ─── Callbacks de confirmación ───

async function handleCallbackQuery(update: TelegramUpdate): Promise<ChannelResult> {
  const cq = update.callback_query!;
  const chatId = cq.message?.chat?.id;
  if (!chatId) return { status: 200, handled: false, action: "callback_sin_chat" };

  const chat = await findChat(chatId);
  if (!chat || chat.status !== "activo") {
    await answerCallbackQuery(cq.id, "Este chat ya no está vinculado. Genera un nuevo código en la app.", true);
    return { status: 403, handled: true, action: "chat_revocado" };
  }

  const match = /^(confirm|cancel):([0-9a-fA-F-]{36})$/.exec(cq.data || "");
  if (!match) {
    await answerCallbackQuery(cq.id);
    return { status: 200, handled: true, action: "callback_ignorado" };
  }
  const verb = match[1];
  const actionId = match[2];

  return runWithFarmContext(chat.farmId, async () => {
    const [action] = await db.select().from(aiActions).where(eq(aiActions.id, actionId)).limit(1);
    // El chat solo puede confirmar acciones de SU usuario vinculado.
    if (!action || action.userId !== chat.userId) {
      await answerCallbackQuery(cq.id, "No autorizado: esta acción no pertenece al usuario de este chat.", true);
      return { status: 403, handled: true, action: "callback_no_autorizado" };
    }
    if (action.status !== "pending") {
      await answerCallbackQuery(cq.id, "La acción ya fue procesada.");
      if (cq.message) await editMessageReplyMarkup(chatId, cq.message.message_id, { inline_keyboard: [] });
      return { status: 200, handled: true, action: "ya_procesada" };
    }

    const user = await getLinkedUser(chat.userId);
    if (verb === "cancel") {
      await cancelAction({ userId: chat.userId, actionId, reason: "Cancelada desde Telegram" });
      await answerCallbackQuery(cq.id, "Acción cancelada");
      if (cq.message) await editMessageReplyMarkup(chatId, cq.message.message_id, { inline_keyboard: [] });
      await sendTelegramMessage(chatId, `❌ Cancelada: ${escapeTelegramHtml(action.summary)}`);
      return { status: 200, handled: true, action: "cancelada" };
    }

    try {
      const execution = await withEphemeralSession(chat.userId, chat.farmId, (cookie) =>
        confirmAction({
          userId: chat.userId,
          userName: user?.name || user?.username || "Usuario",
          actionId,
          cookie,
          requestOrigin: process.env.APP_URL || undefined,
          origin: "telegram",
        }),
      );
      await answerCallbackQuery(cq.id, "Acción confirmada");
      if (cq.message) await editMessageReplyMarkup(chatId, cq.message.message_id, { inline_keyboard: [] });
      await sendTelegramMessage(chatId, `✅ ${escapeTelegramHtml(execution.message)}`);
      return { status: 200, handled: true, action: "confirmada" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "error desconocido";
      await answerCallbackQuery(cq.id, "No se pudo ejecutar la acción", true);
      await sendTelegramMessage(chatId, `⚠️ ${escapeTelegramHtml(message)}`);
      return { status: 200, handled: true, action: "error_confirmacion", error: message };
    }
  });
}

// ─── Voz ───

async function handleVoice(chat: LinkedChat, fileId: string): Promise<void> {
  await sendTelegramChatAction(chat.chatId, "typing");
  const filePath = await getTelegramFilePath(fileId);
  if (!filePath) {
    await sendTelegramMessage(chat.chatId, "⚠️ No pude descargar tu nota de voz. Intenta de nuevo o escríbeme el texto.");
    return;
  }
  const audio = await downloadTelegramVoice(filePath);
  if (!audio) {
    await sendTelegramMessage(chat.chatId, "⚠️ No pude descargar tu nota de voz. Intenta de nuevo o escríbeme el texto.");
    return;
  }
  const stt = await transcribeAudioBlob(audio);
  if (!stt.configured) {
    await sendTelegramMessage(
      chat.chatId,
      "🎙️ Recibí tu nota de voz, pero la transcripción automática no está configurada en este servidor. Escríbeme el texto y lo registro igual.",
    );
    return;
  }
  if (stt.error) {
    await sendTelegramMessage(chat.chatId, `⚠️ ${escapeTelegramHtml(stt.error)}`);
    return;
  }
  if (!stt.text?.trim()) {
    await sendTelegramMessage(chat.chatId, "🎙️ No alcancé a entender la nota de voz. ¿Me la repites o me escribes el texto?");
    return;
  }
  await runTelegramAgentTurn(chat, stt.text.trim());
}

// ─── Entrada principal ───

export async function processTelegramUpdate(update: TelegramUpdate): Promise<ChannelResult> {
  if (update.callback_query) return handleCallbackQuery(update);

  const message = update.message;
  if (!message?.chat?.id) return { status: 200, handled: false, action: "update_no_soportado" };
  const chatId = message.chat.id;

  if (!checkRateLimit(chatId)) {
    await sendTelegramMessage(chatId, "⏳ Demasiados mensajes seguidos. Espera un minuto y sigo atendiéndote.");
    return { status: 200, handled: true, action: "rate_limit" };
  }

  const text = (message.text || "").trim();
  const chat = await findChat(chatId);

  // /start <código> vincula (o re-vincula) el chat a ESE usuario.
  if (/^\/start(@\w+)?(\s|$)/i.test(text)) {
    const code = text.replace(/^\/start(@\w+)?\s*/i, "").trim();
    if (!code) {
      await sendTelegramMessage(chatId, PAIRING_INSTRUCTIONS);
      return { status: 200, handled: true, action: "instrucciones_pairing" };
    }
    const paired = await consumePairingCode(code, chatId);
    if (!paired.ok) {
      const reasonText =
        paired.reason === "codigo_expirado"
          ? "El código expiró (dura 10 minutos)."
          : paired.reason === "codigo_usado"
            ? "Ese código ya fue usado (es de un solo uso)."
            : "No reconozco ese código.";
      await sendTelegramMessage(chatId, `⚠️ ${reasonText} Genera uno nuevo en Configuración → Módulos → Canal Telegram.`);
      return { status: 200, handled: true, action: `pairing_${paired.reason}` };
    }
    await sendTelegramMessage(
      chatId,
      "✅ ¡Chat vinculado! Ya puedes hablarme o enviarme notas de voz. Usa /ayuda para ver qué puedo hacer. Las acciones sensibles siempre te pedirán confirmación.",
    );
    return { status: 200, handled: true, action: "vinculado" };
  }

  if (!chat || chat.status !== "activo") {
    await sendTelegramMessage(
      chatId,
      chat
        ? "🔒 El vínculo de este chat fue revocado. Genera un nuevo código en la app y envíame /start CODIGO."
        : PAIRING_INSTRUCTIONS,
    );
    return { status: 200, handled: true, action: chat ? "chat_revocado" : "no_vinculado" };
  }

  await db.update(telegramChats).set({ lastSeenAt: new Date() }).where(eq(telegramChats.id, chat.id));

  if (/^\/desvincular(@\w+)?\s*$/i.test(text)) {
    await db.update(telegramChats).set({ status: "revocado" }).where(eq(telegramChats.id, chat.id));
    await sendTelegramMessage(chatId, "🔒 Vínculo revocado. Este chat ya no puede operar en la granja. Genera un nuevo código cuando quieras volver.");
    return { status: 200, handled: true, action: "desvinculado" };
  }

  const commandMatch = /^\/(resumen|parte|estado|ayuda)(@\w+)?\s*$/i.exec(text);
  if (commandMatch) {
    await handleCommand(chat, `/${commandMatch[1].toLowerCase()}`);
    return { status: 200, handled: true, action: `comando_${commandMatch[1].toLowerCase()}` };
  }

  if (message.voice?.file_id) {
    await handleVoice(chat, message.voice.file_id);
    return { status: 200, handled: true, action: "voz" };
  }

  if (!text) return { status: 200, handled: false, action: "mensaje_no_soportado" };
  if (text.startsWith("/")) {
    await handleCommand(chat, "/ayuda");
    return { status: 200, handled: true, action: "comando_desconocido" };
  }

  await runTelegramAgentTurn(chat, text);
  return { status: 200, handled: true, action: "agente" };
}
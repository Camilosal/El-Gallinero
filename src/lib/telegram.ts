import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentBriefings, telegramChats } from "@/db/schema";
import { SITE_URL } from "@/lib/seo";
import type { BriefingRow } from "@/lib/agent/proactive";

/**
 * Cliente ligero de la Bot API de Telegram (C2 saliente; C3 lo extiende).
 *
 * Configuración opcional con el mismo patrón de STT/Vision en agent/config.ts:
 * sin TELEGRAM_BOT_TOKEN la app funciona igual y la entrega degrada al texto
 * compartible, sin errores ni reintentos infinitos.
 */

export interface TelegramConfig {
  botToken: string;
  apiBaseUrl: string;
}

export function getTelegramConfig(): TelegramConfig | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  if (!token) return null;
  return {
    botToken: token,
    apiBaseUrl: `https://api.telegram.org/bot${token}`,
  };
}

export function isTelegramConfigured(): boolean {
  return getTelegramConfig() !== null;
}

export const TELEGRAM_MESSAGE_MAX_LENGTH = 4096;

/** Escapa HTML para parse_mode=HTML (formato seguro, sin Markdown inyectable). */
export function escapeTelegramHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Trocea textos largos respetando el límite de 4096 caracteres por mensaje. */
export function splitTelegramMessage(text: string, maxLength = TELEGRAM_MESSAGE_MAX_LENGTH): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLength) {
    let cut = rest.lastIndexOf("\n", maxLength);
    if (cut < maxLength * 0.5) cut = maxLength;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n+/, "");
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export interface TelegramSendResult {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
}

interface TelegramApiOptions {
  parseMode?: "HTML";
  replyMarkup?: unknown;
  disableNotification?: boolean;
}

async function callTelegramApi(
  method: string,
  payload: Record<string, unknown>,
): Promise<TelegramSendResult> {
  const config = getTelegramConfig();
  if (!config) return { ok: false, skipped: true, reason: "sin_token" };
  try {
    const res = await fetch(`${config.apiBaseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!res.ok || !data?.ok) {
      return { ok: false, reason: data?.description || `http_${res.status}` };
    }
    return { ok: true };
  } catch (error) {
    // Un solo intento por mensaje: sin reintentos infinitos (plan C2 step 3).
    return { ok: false, reason: error instanceof Error ? error.message.slice(0, 200) : "error_desconocido" };
  }
}

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  options: TelegramApiOptions = {},
): Promise<TelegramSendResult> {
  const chunks = splitTelegramMessage(text);
  for (const chunk of chunks) {
    const result = await callTelegramApi("sendMessage", {
      chat_id: chatId,
      text: chunk,
      parse_mode: options.parseMode ?? "HTML",
      disable_web_page_preview: true,
      ...(options.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
      ...(options.disableNotification ? { disable_notification: true } : {}),
    });
    if (!result.ok) return result;
  }
  return { ok: true };
}

export async function sendTelegramChatAction(chatId: number, action = "typing"): Promise<TelegramSendResult> {
  return callTelegramApi("sendChatAction", { chat_id: chatId, action });
}

export interface ActiveTelegramChat {
  id: string;
  chatId: number;
  userId: string;
}

export async function listActiveTelegramChats(): Promise<ActiveTelegramChat[]> {
  const rows = await db
    .select({ id: telegramChats.id, chatId: telegramChats.chatId, userId: telegramChats.userId })
    .from(telegramChats)
    .where(eq(telegramChats.status, "activo"));
  return rows;
}

function deepLink(href?: string): string | null {
  if (!href || !href.startsWith("/")) return null;
  return `${SITE_URL}${href}`;
}

/** Texto HTML del briefing: viñetas priorizadas + enlaces profundos a la app. */
export function renderBriefingTelegramText(briefing: BriefingRow): string {
  const payload = briefing.payload;
  const findings = payload?.findings || [];
  const header =
    payload?.kind === "anomalia"
      ? `🚨 <b>Gina detectó una anomalía</b> (${escapeTelegramHtml(briefing.briefingDate)})`
      : `🐔 <b>Gina te informa</b> · ${escapeTelegramHtml(briefing.briefingDate)}`;
  const lines: string[] = [header];
  if (briefing.narrative?.trim()) {
    lines.push(escapeTelegramHtml(briefing.narrative.trim()));
  }
  for (const finding of findings) {
    const icon = finding.severity === "critical" ? "🔴" : finding.severity === "warning" ? "🟠" : "🔵";
    let line = `${icon} <b>${escapeTelegramHtml(finding.title)}</b>: ${escapeTelegramHtml(finding.detail)}`;
    const link = deepLink(finding.href);
    if (link) line += `\n👉 <a href="${escapeTelegramHtml(link)}">Abrir en IwaGranja</a>`;
    lines.push(line);
  }
  if (findings.length === 0) lines.push("Todo en orden por hoy. 👍");
  lines.push(`\n📋 Resumen completo: <a href="${SITE_URL}/inicio">app.iwage.co/inicio</a>`);
  return lines.join("\n\n");
}

export interface BriefingDeliveryResult {
  delivered: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Entrega un briefing a los chats vinculados de la granja activa.
 * Rate limit: 1 briefing diario por chat (idempotencia por payload) y las
 * anomalías solo se entregan si traen hallazgos críticos.
 */
export async function deliverBriefingViaTelegram(briefing: BriefingRow): Promise<BriefingDeliveryResult> {
  if (!isTelegramConfigured()) return { delivered: 0, skipped: true, reason: "sin_token" };

  const payload = (briefing.payload || {}) as unknown as Record<string, unknown>;
  const deliveredVia = Array.isArray(payload.deliveredVia) ? (payload.deliveredVia as string[]) : [];
  if (deliveredVia.includes("telegram")) {
    return { delivered: 0, skipped: true, reason: "ya_entregado" };
  }
  if (briefing.kind === "anomalia") {
    const findings = briefing.payload?.findings || [];
    if (!findings.some((f) => f.severity === "critical")) {
      return { delivered: 0, skipped: true, reason: "anomalia_no_critica" };
    }
  }

  const chats = await listActiveTelegramChats();
  if (chats.length === 0) return { delivered: 0, skipped: true, reason: "sin_chats" };

  const text = renderBriefingTelegramText(briefing);
  const deliveredChatIds: number[] = [];
  for (const chat of chats) {
    const result = await sendTelegramMessage(chat.chatId, text);
    if (result.ok) deliveredChatIds.push(chat.chatId);
    else console.warn(`[telegram] Entrega fallida a chat ${chat.chatId}: ${result.reason || "desconocido"}`);
  }

  if (deliveredChatIds.length > 0) {
    await db
      .update(agentBriefings)
      .set({
        payload: {
          ...payload,
          deliveredVia: [...deliveredVia, "telegram"],
          telegramChatIds: deliveredChatIds,
        },
      })
      .where(eq(agentBriefings.id, briefing.id));
  }

  return { delivered: deliveredChatIds.length, skipped: false };
}

// ─── C3: canal bidireccional ───

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

export interface TelegramInlineKeyboard {
  inline_keyboard: TelegramInlineButton[][];
}

export function confirmationKeyboard(actionId: string): TelegramInlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "✅ Confirmar", callback_data: `confirm:${actionId}` },
        { text: "❌ Cancelar", callback_data: `cancel:${actionId}` },
      ],
    ],
  };
}

/** Registra el webhook del bot con secret_token (scripts/telegram-setup.mjs). */
export async function setTelegramWebhook(url: string, secretToken: string): Promise<TelegramSendResult> {
  return callTelegramApi("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false): Promise<TelegramSendResult> {
  return callTelegramApi("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    ...(text ? { text: text.slice(0, 200) } : {}),
    show_alert: showAlert,
  });
}

export async function editMessageReplyMarkup(
  chatId: number,
  messageId: number,
  replyMarkup: TelegramInlineKeyboard | { inline_keyboard: [] },
): Promise<TelegramSendResult> {
  return callTelegramApi("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

/** getFile → file_path para descargar notas de voz. */
export async function getTelegramFilePath(fileId: string): Promise<string | null> {
  const config = getTelegramConfig();
  if (!config) return null;
  try {
    const res = await fetch(`${config.apiBaseUrl}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok || !data?.ok) return null;
    return typeof data.result?.file_path === "string" ? data.result.file_path : null;
  } catch {
    return null;
  }
}

/** Descarga el archivo de voz desde el CDN de Telegram como Blob (máx. 20 MB). */
export async function downloadTelegramVoice(filePath: string): Promise<Blob | null> {
  const config = getTelegramConfig();
  if (!config) return null;
  try {
    const res = await fetch(`https://api.telegram.org/file/bot${config.botToken}/${filePath}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0 || blob.size > 20 * 1024 * 1024) return null;
    return blob;
  } catch {
    return null;
  }
}
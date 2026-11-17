#!/usr/bin/env node
/**
 * C3: registra el webhook del bot de Telegram con secret_token.
 *
 * Uso:
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... APP_URL=https://app.iwage.co \
 *     node scripts/telegram-setup.mjs
 *
 * Opciones:
 *   --delete   elimina el webhook (vuelve a modo getUpdates, útil en desarrollo)
 */

const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
const secret = (process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
const appUrl = (process.env.APP_URL || process.env.TELEGRAM_WEBHOOK_URL || "").trim().replace(/\/+$/, "");
const deleteMode = process.argv.includes("--delete");

if (!token) {
  console.error("[telegram-setup] Falta TELEGRAM_BOT_TOKEN.");
  process.exit(1);
}

const apiBase = `https://api.telegram.org/bot${token}`;

async function callApi(method, payload) {
  const res = await fetch(`${apiBase}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    throw new Error(`${method} falló: ${data?.description || `HTTP ${res.status}`}`);
  }
  return data.result;
}

try {
  if (deleteMode) {
    await callApi("deleteWebhook", { drop_pending_updates: true });
    console.log("[telegram-setup] Webhook eliminado.");
  } else {
    if (!secret) {
      console.error("[telegram-setup] Falta TELEGRAM_WEBHOOK_SECRET (obligatorio para el webhook seguro).");
      process.exit(1);
    }
    if (!appUrl || !appUrl.startsWith("https://")) {
      console.error("[telegram-setup] Falta APP_URL pública con HTTPS (ej. https://app.iwage.co).");
      process.exit(1);
    }
    const webhookUrl = `${appUrl}/api/telegram/webhook`;
    await callApi("setWebhook", {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    const info = await callApi("getWebhookInfo", {});
    console.log(`[telegram-setup] Webhook registrado: ${webhookUrl}`);
    console.log(`[telegram-setup] URL confirmada por Telegram: ${info.url}`);
    if (info.last_error_message) {
      console.warn(`[telegram-setup] Último error reportado por Telegram: ${info.last_error_message}`);
    }
  }
} catch (error) {
  console.error("[telegram-setup] Error:", error instanceof Error ? error.message : error);
  process.exit(1);
}
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "@/db";
import {
  agentBriefings,
  agentMemories,
  aiActions,
  aiConversations,
  aiMessages,
  appSettings,
  farms,
  sessions,
  telegramChats,
  users,
} from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import { todayColombiaIso } from "@/lib/date-validation";
import { getSessionUser } from "@/lib/auth";
import { callLlm } from "@/lib/agent/llm";
import {
  __resetTelegramRateLimitsForTests,
  createPairingCode,
  processTelegramUpdate,
} from "@/lib/agent/telegram-channel";
import { POST as webhookPOST } from "@/app/api/telegram/webhook/route";
import { GET as cierreGET, POST as cierrePOST } from "@/app/api/operaciones/cierre-diario/route";

const hoisted = vi.hoisted(() => ({
  llmQueue: [] as any[],
  apiCalls: [] as Array<{ method: string; path: string; body?: any }>,
  apiResponses: {} as Record<string, any>,
  realApiRoutes: {} as Record<string, (req: any) => Promise<Response>>,
  botCalls: [] as Array<{ method: string; body: any }>,
  sttText: "registra 30 huevos hoy",
}));

vi.mock("@/lib/agent/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/llm")>();
  return {
    ...actual,
    callLlm: vi.fn(async () => {
      return hoisted.llmQueue.shift() ?? { role: "assistant", content: "Entendido, quedó registrado.", tool_calls: [] };
    }),
  };
});

vi.mock("@/lib/agent/internal-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/internal-api")>();
  const invoke = async (method: string, path: string, body?: any) => {
    hoisted.apiCalls.push({ method, path, body });
    const key = path.split("?")[0];
    const handler = hoisted.realApiRoutes[key];
    if (handler) {
      // Modo "real": la herramienta llama la ruta verdadera con la sesión del
      // usuario vinculado, exercising el RBAC real del servidor.
      const res = await handler(
        new Request(`http://localhost${path}`, {
          method,
          headers: body ? { "Content-Type": "application/json" } : {},
          body: body ? JSON.stringify(body) : undefined,
        }),
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new actual.InternalApiError(data?.error || `Error HTTP ${res.status}`, res.status, data);
      return data;
    }
    return hoisted.apiResponses[key] ?? { ok: true };
  };
  return {
    ...actual,
    InternalApiClient: vi.fn().mockImplementation(function (this: any) {
      this.get = (path: string) => invoke("GET", path);
      this.post = (path: string, body: any) => invoke("POST", path, body);
      this.put = (path: string, body: any) => invoke("PUT", path, body);
    }),
  };
});

const farmId = crypto.randomUUID();
const ownerUserId = crypto.randomUUID();
const operarioUserId = crypto.randomUUID();
const chatA = 920_000_000 + Math.floor(Math.random() * 1_000_000);
const chatB = chatA + 1;
const chatC = chatA + 2;
const chatD = chatA + 3;
const todayIso = todayColombiaIso();
const envBackup: Record<string, string | undefined> = {};
let updateSeq = 1000;

function jsonRes(data: any) {
  return { ok: true, status: 200, json: async () => data } as any;
}

const fetchMock = vi.fn(async (url: any, init: any) => {
  const u = String(url);
  const body = init?.body && typeof init.body === "string" ? JSON.parse(init.body) : null;
  if (u.includes("api.telegram.org/bot")) {
    const method = u.split("/").pop()!;
    hoisted.botCalls.push({ method, body });
    if (method === "getFile") return jsonRes({ ok: true, result: { file_path: "voice/file_0.oga" } });
    if (method === "getWebhookInfo") return jsonRes({ ok: true, result: { url: u } });
    return jsonRes({ ok: true, result: { message_id: hoisted.botCalls.length } });
  }
  if (u.startsWith("https://api.telegram.org/file/")) {
    return { ok: true, status: 200, blob: async () => new Blob(["fake-audio"], { type: "audio/ogg" }) } as any;
  }
  if (u.includes("/audio/transcriptions")) return jsonRes({ text: hoisted.sttText });
  throw new Error(`fetch inesperado en test telegram: ${u}`);
});

function toolCall(name: string, args: Record<string, unknown>, id = "call_1") {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } } as any;
}

function msg(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  updateSeq += 1;
  return processTelegramUpdate({
    update_id: updateSeq,
    message: { message_id: updateSeq, chat: { id: chatId }, from: { id: 1 }, text, ...extra },
  } as any);
}

function callback(chatId: number, data: string, messageId = 50) {
  updateSeq += 1;
  return processTelegramUpdate({
    update_id: updateSeq,
    callback_query: { id: `cq-${updateSeq}`, data, from: { id: 1 }, message: { message_id: messageId, chat: { id: chatId } } },
  } as any);
}

async function linkChat(chatId: number, userId: string) {
  const { code } = await createPairingCode(userId, farmId);
  return msg(chatId, `/start ${code}`);
}

function webhookRequest(secret: string | null, update: any): any {
  return new Request("http://localhost/api/telegram/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(secret ? { "X-Telegram-Bot-Api-Secret-Token": secret } : {}),
    },
    body: JSON.stringify(update),
  });
}

function lastSendMessage() {
  return [...hoisted.botCalls].reverse().find((c) => c.method === "sendMessage");
}

async function getChat(chatId: number) {
  const [row] = await db.select().from(telegramChats).where(eq(telegramChats.chatId, chatId)).limit(1);
  return row || null;
}

describe("C3 · Telegram como canal bidireccional del agente", () => {
  beforeAll(async () => {
    for (const key of [
      "ASSISTANT_AI_API_KEY",
      "DEEPSEEK_API_KEY",
      "ASSISTANT_JEV_ROUTING",
      "TELEGRAM_BOT_TOKEN",
      "TELEGRAM_WEBHOOK_SECRET",
      "ASSISTANT_STT_API_KEY",
      "OPENAI_API_KEY",
      "GEMINI_API_KEY",
    ]) {
      envBackup[key] = process.env[key];
    }
    process.env.ASSISTANT_AI_API_KEY = "test-key-telegram";
    process.env.ASSISTANT_JEV_ROUTING = "false";
    process.env.TELEGRAM_BOT_TOKEN = "123456:token-prueba-c3";
    process.env.TELEGRAM_WEBHOOK_SECRET = "secreto-webhook-c3";
    process.env.ASSISTANT_STT_API_KEY = "stt-key-prueba";
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    vi.stubGlobal("fetch", fetchMock);

    await db.insert(farms).values({ id: farmId, slug: `finca-c3-${farmId.slice(0, 8)}`, name: "Finca Prueba C3" });
    await runWithFarmContext(farmId, async () => {
      await db.insert(users).values([
        { id: ownerUserId, username: `dueno-c3-${farmId.slice(0, 8)}`, passwordHash: "x", name: "Dueña C3", role: "propietario" },
        { id: operarioUserId, username: `operario-c3-${farmId.slice(0, 8)}`, passwordHash: "x", name: "Operario C3", role: "operario" },
      ]);
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await runWithFarmContext(farmId, async () => {
      for (const uid of [ownerUserId, operarioUserId]) {
        const convs = await db.select({ id: aiConversations.id }).from(aiConversations).where(eq(aiConversations.userId, uid));
        const convIds = convs.map((c) => c.id);
        if (convIds.length > 0) await db.delete(aiMessages).where(inArray(aiMessages.conversationId, convIds));
        await db.delete(aiActions).where(eq(aiActions.userId, uid));
        await db.delete(aiConversations).where(eq(aiConversations.userId, uid));
        await db.delete(agentMemories).where(eq(agentMemories.userId, uid));
        await db.delete(sessions).where(eq(sessions.userId, uid));
        await db.delete(telegramChats).where(eq(telegramChats.userId, uid));
      }
      await db.delete(agentBriefings);
      await db.delete(appSettings).where(like(appSettings.key, "telegram.%"));
      await db.delete(users).where(inArray(users.id, [ownerUserId, operarioUserId]));
    });
    await db.delete(farms).where(eq(farms.id, farmId));
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => {
    hoisted.llmQueue.length = 0;
    hoisted.apiCalls.length = 0;
    hoisted.botCalls.length = 0;
    hoisted.realApiRoutes = {};
    vi.mocked(callLlm).mockClear();
    __resetTelegramRateLimitsForTests();
  });

  it("pairing: código expirado y reutilizado se rechazan; el válido vincula el chat a ESE usuario", async () => {
    // Código expirado (TTL vencido manipulado en appSettings).
    const expired = await createPairingCode(ownerUserId, farmId);
    await runWithFarmContext(farmId, async () => {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.key, `telegram.pairing.v1.${expired.code}`)).limit(1);
      const parsed = JSON.parse(row.value);
      parsed.expiresAt = new Date(Date.now() - 60_000).toISOString();
      await db.update(appSettings).set({ value: JSON.stringify(parsed) }).where(eq(appSettings.id, row.id));
    });
    const expiredResult = await msg(chatA, `/start ${expired.code}`);
    expect(expiredResult.action).toBe("pairing_codigo_expirado");
    expect(await getChat(chatA)).toBeNull();

    // Código válido: vincula al usuario que lo generó.
    const valid = await linkChat(chatA, ownerUserId);
    expect(valid.action).toBe("vinculado");
    const chat = await getChat(chatA);
    expect(chat?.userId).toBe(ownerUserId);
    expect(chat?.farmId).toBe(farmId);
    expect(chat?.status).toBe("activo");

    // Un solo uso: el mismo código consumido en otro chat se rechaza.
    const { code: singleUse } = await createPairingCode(ownerUserId, farmId);
    const firstUse = await msg(chatD, `/start ${singleUse}`);
    expect(firstUse.action).toBe("vinculado");
    const secondUse = await msg(chatB + 10, `/start ${singleUse}`);
    expect(secondUse.action).toBe("pairing_codigo_usado");
    expect(await getChat(chatB + 10)).toBeNull();

    const invalid = await msg(chatB + 11, "/start NOEXISTE");
    expect(invalid.action).toBe("pairing_codigo_invalido");
  });

  it("chat no vinculado solo recibe instrucciones de pairing (sin LLM)", async () => {
    const fresh = chatA + 20;
    const result = await msg(fresh, "hola Gina, registra 30 huevos");
    expect(result.action).toBe("no_vinculado");
    expect(callLlm).not.toHaveBeenCalled();
    expect(lastSendMessage()?.body.text).toContain("Configuración → Módulos");
    expect(await getChat(fresh)).toBeNull();
  });

  it("webhook: header secreto inválido → 401; sin secreto configurado → 503; válido procesa", async () => {
    const update = { update_id: 1, message: { message_id: 1, chat: { id: chatA + 21 }, text: "hola" } };
    const bad = await webhookPOST(webhookRequest("secreto-equivocado", update));
    expect(bad.status).toBe(401);
    const missing = await webhookPOST(webhookRequest(null, update));
    expect(missing.status).toBe(401);

    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const unconfigured = await webhookPOST(webhookRequest("secreto-webhook-c3", update));
    expect(unconfigured.status).toBe(503);
    process.env.TELEGRAM_WEBHOOK_SECRET = "secreto-webhook-c3";

    const ok = await webhookPOST(webhookRequest("secreto-webhook-c3", update));
    expect(ok.status).toBe(200);
    const body = await ok.json();
    expect(body.handled).toBe(true);
    expect(body.action).toBe("no_vinculado");
  });

  it("comandos deterministas /resumen /parte /estado /ayuda responden sin LLM", async () => {
    await linkChat(chatD, ownerUserId);
    hoisted.botCalls.length = 0;

    const resumen = await msg(chatD, "/resumen");
    expect(resumen.action).toBe("comando_resumen");
    expect(lastSendMessage()?.body.text).toContain("Resumen");

    const parte = await msg(chatD, "/parte");
    expect(parte.action).toBe("comando_parte");
    expect(lastSendMessage()?.body.text).toContain("Parte diario");

    const estado = await msg(chatD, "/estado");
    expect(estado.action).toBe("comando_estado");
    expect(lastSendMessage()?.body.text).toContain("propietario");

    const ayuda = await msg(chatD, "/ayuda");
    expect(ayuda.action).toBe("comando_ayuda");
    expect(lastSendMessage()?.body.text).toContain("Soy Gina");

    expect(callLlm).not.toHaveBeenCalled();
  });

  it("venta por Telegram queda pendiente hasta pulsar Confirmar; auditoría origin telegram + chat_id", async () => {
    hoisted.llmQueue.push(
      {
        role: "assistant",
        content: null,
        tool_calls: [toolCall("registrar_venta_huevos", { items: [{ tamano: "A", cantidad: 30, precio_unitario: 400 }], comprador: "Tienda C3" })],
      },
      { role: "assistant", content: "Te dejo la venta pendiente de confirmación.", tool_calls: [] },
    );
    const result = await msg(chatA, "Vende 30 huevos A a 400 a la tienda");
    expect(result.action).toBe("agente");

    // El piso duro impide ejecutar sin confirmación: ningún POST a la API interna.
    expect(hoisted.apiCalls.some((c) => c.method === "POST")).toBe(false);
    const [action] = await runWithFarmContext(farmId, () =>
      db.select().from(aiActions).where(and(eq(aiActions.userId, ownerUserId), eq(aiActions.status, "pending"))).limit(1),
    );
    expect(action.toolName).toBe("registrar_venta_huevos");
    expect(action.status).toBe("pending");
    expect(action.origin).toBe("telegram");
    expect(action.chatId).toBe(chatA);

    // Tarjeta con teclado inline ✅/❌ entregada al chat.
    const card = hoisted.botCalls.find((c) => c.method === "sendMessage" && c.body?.reply_markup);
    expect(card?.body.reply_markup.inline_keyboard[0][0].callback_data).toBe(`confirm:${action.id}`);
    expect(card?.body.reply_markup.inline_keyboard[0][1].callback_data).toBe(`cancel:${action.id}`);

    // Confirmación remota → ejecuta con la sesión del usuario vinculado.
    const confirmed = await callback(chatA, `confirm:${action.id}`);
    expect(confirmed.action).toBe("confirmada");
    expect(hoisted.apiCalls.some((c) => c.method === "POST" && c.path.includes("/ventas"))).toBe(true);
    const [executed] = await runWithFarmContext(farmId, () =>
      db.select().from(aiActions).where(eq(aiActions.id, action.id)).limit(1),
    );
    expect(executed.status).toBe("executed");
    expect(executed.origin).toBe("telegram");
    expect(hoisted.botCalls.some((c) => c.method === "answerCallbackQuery")).toBe(true);
    expect(hoisted.botCalls.some((c) => c.method === "editMessageReplyMarkup" && c.body?.reply_markup?.inline_keyboard?.length === 0)).toBe(true);
    expect(lastSendMessage()?.body.text).toContain("✅");
  });

  it("acción pendiente creada por otro canal (MCP/API) confirmada por callback de Telegram estampa chat_id y origin telegram", async () => {
    await linkChat(chatD, ownerUserId);
    hoisted.llmQueue.push(
      {
        role: "assistant",
        content: null,
        tool_calls: [toolCall("registrar_venta_huevos", { items: [{ tamano: "A", cantidad: 12, precio_unitario: 500 }], comprador: "Tienda C3 cross" })],
      },
      { role: "assistant", content: "Venta pendiente.", tool_calls: [] },
    );
    await msg(chatD, "Vende 12 huevos A a 500");
    const [action] = await runWithFarmContext(farmId, () =>
      db.select().from(aiActions).where(and(eq(aiActions.userId, ownerUserId), eq(aiActions.status, "pending"))).limit(1),
    );
    expect(action.toolName).toBe("registrar_venta_huevos");

    // Simula que la acción la propuso un agente externo (API v1 / MCP): sin chat_id
    // y con origin external_agent. El callback de Telegram debe completar la auditoría.
    await runWithFarmContext(farmId, () =>
      db.update(aiActions).set({ chatId: null, origin: "external_agent" }).where(eq(aiActions.id, action.id)),
    );

    const confirmed = await callback(chatD, `confirm:${action.id}`);
    expect(confirmed.action).toBe("confirmada");
    const [executed] = await runWithFarmContext(farmId, () =>
      db.select().from(aiActions).where(eq(aiActions.id, action.id)).limit(1),
    );
    expect(executed.status).toBe("executed");
    expect(executed.origin).toBe("telegram");
    expect(executed.chatId).toBe(chatD);
  });

  it("callback de otro chat → 403 y la acción sigue pendiente; cancelar desde el chat dueño sí funciona", async () => {
    await linkChat(chatB, operarioUserId);
    hoisted.llmQueue.push(
      {
        role: "assistant",
        content: null,
        tool_calls: [toolCall("registrar_venta_huevos", { items: [{ tamano: "B", cantidad: 12, precio_unitario: 350 }] }, "call_2")],
      },
      { role: "assistant", content: "Pendiente de confirmación.", tool_calls: [] },
    );
    await msg(chatA, "Vende 12 huevos B");
    const [action] = await runWithFarmContext(farmId, () =>
      db.select().from(aiActions).where(and(eq(aiActions.userId, ownerUserId), eq(aiActions.status, "pending"))).limit(1),
    );
    expect(action.status).toBe("pending");

    const foreign = await callback(chatB, `confirm:${action.id}`);
    expect(foreign.status).toBe(403);
    expect(foreign.action).toBe("callback_no_autorizado");
    const [stillPending] = await runWithFarmContext(farmId, () =>
      db.select().from(aiActions).where(eq(aiActions.id, action.id)).limit(1),
    );
    expect(stillPending.status).toBe("pending");

    const cancelled = await callback(chatA, `cancel:${action.id}`);
    expect(cancelled.action).toBe("cancelada");
    const [cancelledRow] = await runWithFarmContext(farmId, () =>
      db.select().from(aiActions).where(eq(aiActions.id, action.id)).limit(1),
    );
    expect(cancelledRow.status).toBe("cancelled");
  });

  it("operario vinculado intenta cierre diario → rechazo RBAC real inmediato sin crear acción pendiente", async () => {
    hoisted.realApiRoutes["/api/operaciones/cierre-diario"] = async (req: any) =>
      req.method === "GET" ? cierreGET(req) : cierrePOST(req);
    vi.mocked(getSessionUser).mockResolvedValue({
      id: operarioUserId,
      username: `operario-c3-${farmId.slice(0, 8)}`,
      name: "Operario C3",
      role: "operario",
      farmId,
    } as any);

    hoisted.llmQueue.push(
      { role: "assistant", content: null, tool_calls: [toolCall("registrar_cierre_diario", { fecha: todayIso }, "call_3")] },
      { role: "assistant", content: "No tienes permisos para cerrar el día; corresponde a gerencia o propietario.", tool_calls: [] },
    );
    await msg(chatB, "cierra el día de hoy");
    const cierreCalls = hoisted.apiCalls.filter((c) => c.path.startsWith("/api/operaciones/cierre-diario"));
    expect(cierreCalls.some((c) => c.method === "GET")).toBe(true);
    expect(cierreCalls.some((c) => c.method === "POST")).toBe(false);

    const actions = await runWithFarmContext(farmId, () =>
      db
        .select()
        .from(aiActions)
        .where(and(eq(aiActions.userId, operarioUserId), eq(aiActions.toolName, "registrar_cierre_diario"))),
    );
    expect(actions).toHaveLength(1);
    expect(actions[0]?.status).toBe("failed");
    expect(actions[0]?.error).toMatch(/permiso|gerencia|cerrar/i);
    expect(lastSendMessage()?.body.text).toContain("permisos");

    vi.mocked(getSessionUser).mockResolvedValue({
      id: "test-user",
      username: "test",
      name: "Test User",
      role: "admin",
      farmId: "00000000-0000-0000-0000-000000000001",
    } as any);
  });

  it("nota de voz con STT mockeado llega al agente; sin STT responde mensaje claro", async () => {
    const result = await msg(chatA, "", { voice: { file_id: "voice-123", mime_type: "audio/ogg" } });
    expect(result.action).toBe("voz");
    expect(hoisted.botCalls.some((c) => c.method === "getFile")).toBe(true);
    const llmCalls = vi.mocked(callLlm).mock.calls;
    const userMessages = llmCalls.flatMap((call) => (call[0] as any[]).filter((m) => m.role === "user"));
    expect(userMessages.some((m) => m.content === hoisted.sttText)).toBe(true);

    // Sin proveedor STT: mensaje claro de limitación, nunca silencio ni LLM.
    delete process.env.ASSISTANT_STT_API_KEY;
    hoisted.botCalls.length = 0;
    vi.mocked(callLlm).mockClear();
    const noStt = await msg(chatA, "", { voice: { file_id: "voice-456" } });
    expect(noStt.action).toBe("voz");
    expect(callLlm).not.toHaveBeenCalled();
    expect(lastSendMessage()?.body.text).toContain("transcripción automática no está configurada");
    process.env.ASSISTANT_STT_API_KEY = "stt-key-prueba";
  });

  it("/desvincular revoca el vínculo y corta el canal; un código nuevo lo reactiva", async () => {
    const result = await msg(chatD, "/desvincular");
    expect(result.action).toBe("desvinculado");
    expect((await getChat(chatD))?.status).toBe("revocado");

    const afterRevoke = await msg(chatD, "registra 30 huevos");
    expect(afterRevoke.action).toBe("chat_revocado");
    expect(callLlm).not.toHaveBeenCalled();

    const revokedCallback = await callback(chatD, "confirm:00000000-0000-0000-0000-000000000000");
    expect(revokedCallback.status).toBe(403);

    const relinked = await linkChat(chatD, ownerUserId);
    expect(relinked.action).toBe("vinculado");
    expect((await getChat(chatD))?.status).toBe("activo");
  });

  it("rate limit: más de 20 mensajes por minuto en un chat se frenan", async () => {
    const fresh = chatA + 30;
    let last: any = null;
    for (let i = 0; i < 21; i += 1) last = await msg(fresh, `mensaje ${i}`);
    expect(last.action).toBe("rate_limit");
    expect(lastSendMessage()?.body.text).toContain("Demasiados mensajes");
    __resetTelegramRateLimitsForTests();
  });

  it("updates no soportados se ignoran sin errores", async () => {
    const edited = await processTelegramUpdate({ update_id: 999, edited_message: { chat: { id: chatA }, text: "hola" } } as any);
    expect(edited.handled).toBe(false);
    const photo = await msg(chatA, "", { photo: [{ file_id: "x" }] } as any);
    expect(photo.handled).toBe(false);
    expect(callLlm).not.toHaveBeenCalled();
  });
});
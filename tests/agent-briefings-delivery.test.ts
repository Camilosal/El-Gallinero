import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentBriefings, farms, telegramChats, users } from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import { addDaysIso, todayColombiaIso } from "@/lib/date-validation";
import { buildDailyBriefing, markBriefingRead } from "@/lib/agent/proactive";
import type { BriefingFinding, BriefingRow } from "@/lib/agent/proactive";
import {
  deliverBriefingViaTelegram,
  escapeTelegramHtml,
  listActiveTelegramChats,
  splitTelegramMessage,
} from "@/lib/telegram";
import { buildBriefingPushPayload } from "@/lib/briefing-push";
import { GET as briefingsGET, POST as briefingsPOST } from "@/app/api/asistente/briefings/route";
import { getSessionUser } from "@/lib/auth";
import { mockRequest, parseJson } from "./helpers";

const farmId = crypto.randomUUID();
const userId = crypto.randomUUID();
const todayIso = todayColombiaIso();
const activeChatId = 910_000_000 + Math.floor(Math.random() * 1_000_000);
const revokedChatId = activeChatId + 1;
const envBackup: Record<string, string | undefined> = {};

const fetchCalls: Array<{ url: string; body: any }> = [];
const fetchMock = vi.fn(async (url: any, init: any) => {
  fetchCalls.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
  return {
    ok: true,
    status: 200,
    json: async () => ({ ok: true, result: { message_id: fetchCalls.length } }),
  } as any;
});

const sensitiveFinding: BriefingFinding = {
  code: "prueba_sensible",
  severity: "critical",
  title: "Mortalidad disparada en Galpón 3",
  detail: "500 aves muertas hoy, valor estimado $12.345.678",
  href: "/produccion/mortalidad",
};

let dailyBriefing: BriefingRow;

function getBriefingRow(id: string) {
  return runWithFarmContext(farmId, async () => {
    const [row] = await db.select().from(agentBriefings).where(eq(agentBriefings.id, id)).limit(1);
    return row;
  });
}

describe("C2 · entrega de briefings: inbox, push y Telegram saliente", () => {
  beforeAll(async () => {
    for (const key of ["TELEGRAM_BOT_TOKEN", "ASSISTANT_AI_API_KEY", "DEEPSEEK_API_KEY"]) {
      envBackup[key] = process.env[key];
    }
    delete process.env.ASSISTANT_AI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.TELEGRAM_BOT_TOKEN;
    vi.stubGlobal("fetch", fetchMock);
    // withApiHandler acota las rutas al farmId de la sesión: apuntamos a la granja aislada.
    vi.mocked(getSessionUser).mockResolvedValue({
      id: userId,
      username: `usuario-c2-${farmId.slice(0, 8)}`,
      name: "Usuario C2",
      role: "propietario",
      farmId,
    } as any);

    await db.insert(farms).values({ id: farmId, slug: `finca-c2-${farmId.slice(0, 8)}`, name: "Finca Prueba C2" });
    await runWithFarmContext(farmId, async () => {
      await db.insert(users).values({
        id: userId,
        username: `usuario-c2-${farmId.slice(0, 8)}`,
        passwordHash: "test-hash-not-used",
        name: "Usuario C2",
        role: "propietario",
      });
      const result = await buildDailyBriefing({ extraFindings: [sensitiveFinding] });
      dailyBriefing = result.briefing;
    });
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    await runWithFarmContext(farmId, async () => {
      await db.delete(telegramChats).where(eq(telegramChats.userId, userId));
      await db.delete(agentBriefings);
      await db.delete(users).where(eq(users.id, userId));
    });
    await db.delete(farms).where(eq(farms.id, farmId));
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("GET lista briefings con no-leídos y POST marcar leído es idempotente", async () => {
    const listRes = await runWithFarmContext(farmId, () =>
      briefingsGET(mockRequest("http://localhost/api/asistente/briefings?limit=5")),
    );
    expect(listRes.status).toBe(200);
    const list = await parseJson(listRes);
    expect(list.briefings.some((b: any) => b.id === dailyBriefing.id)).toBe(true);
    expect(list.unreadCount).toBeGreaterThanOrEqual(1);

    const first = await runWithFarmContext(farmId, () =>
      briefingsPOST(mockRequest("http://localhost/api/asistente/briefings", { method: "POST", body: { id: dailyBriefing.id } })),
    );
    expect(first.status).toBe(200);
    const firstBody = await parseJson(first);
    expect(firstBody.briefing.readAt).toBeTruthy();

    const second = await runWithFarmContext(farmId, () =>
      briefingsPOST(mockRequest("http://localhost/api/asistente/briefings", { method: "POST", body: { id: dailyBriefing.id } })),
    );
    const secondBody = await parseJson(second);
    // Idempotente: COALESCE conserva la marca original, no la reescribe.
    expect(new Date(secondBody.briefing.readAt).getTime()).toBe(new Date(firstBody.briefing.readAt).getTime());

    const direct = await runWithFarmContext(farmId, () => markBriefingRead(dailyBriefing.id));
    expect(direct?.readAt?.getTime()).toBe(new Date(firstBody.briefing.readAt).getTime());

    const missing = await runWithFarmContext(farmId, () =>
      briefingsPOST(mockRequest("http://localhost/api/asistente/briefings", { method: "POST", body: {} })),
    );
    expect(missing.status).toBe(400);
    const notFound = await runWithFarmContext(farmId, () =>
      briefingsPOST(mockRequest("http://localhost/api/asistente/briefings", { method: "POST", body: { id: crypto.randomUUID() } })),
    );
    expect(notFound.status).toBe(404);
  });

  it("sin TELEGRAM_BOT_TOKEN degrada sin llamar a la Bot API", async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    fetchCalls.length = 0;
    const result = await runWithFarmContext(farmId, () => deliverBriefingViaTelegram(dailyBriefing));
    expect(result).toEqual({ delivered: 0, skipped: true, reason: "sin_token" });
    expect(fetchCalls.length).toBe(0);
  });

  it("con token pero sin chats vinculados degrada sin errores", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456:token-prueba-c2";
    fetchCalls.length = 0;
    const past = await runWithFarmContext(farmId, () =>
      buildDailyBriefing({ todayIso: addDaysIso(todayIso, -3) }),
    );
    const result = await runWithFarmContext(farmId, () => deliverBriefingViaTelegram(past.briefing));
    expect(result).toEqual({ delivered: 0, skipped: true, reason: "sin_chats" });
    expect(fetchCalls.length).toBe(0);
  });

  it("envía el briefing a chats activos (no revocados) con enlaces profundos y registra delivered_via", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456:token-prueba-c2";
    await runWithFarmContext(farmId, async () => {
      await db.insert(telegramChats).values([
        { chatId: activeChatId, userId, status: "activo" },
        { chatId: revokedChatId, userId, status: "revocado" },
      ]);
    });
    const active = await runWithFarmContext(farmId, () => listActiveTelegramChats());
    expect(active.map((c) => c.chatId)).toEqual([activeChatId]);

    fetchCalls.length = 0;
    const result = await runWithFarmContext(farmId, () => deliverBriefingViaTelegram(dailyBriefing));
    expect(result.delivered).toBe(1);
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0].url).toContain("https://api.telegram.org/bot123456:token-prueba-c2/sendMessage");
    expect(fetchCalls[0].body.chat_id).toBe(activeChatId);
    expect(fetchCalls[0].body.parse_mode).toBe("HTML");
    expect(fetchCalls[0].body.text).toContain(sensitiveFinding.title);
    expect(fetchCalls[0].body.text).toContain("/produccion/mortalidad");

    const row = await getBriefingRow(dailyBriefing.id);
    const payload = row.payload as any;
    expect(payload.deliveredVia).toContain("telegram");
    expect(payload.telegramChatIds).toEqual([activeChatId]);
  });

  it("rate limit: reenviar el mismo briefing no vuelve a llamar a Telegram", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456:token-prueba-c2";
    const refreshed = await runWithFarmContext(farmId, async () => {
      const [row] = await db.select().from(agentBriefings).where(eq(agentBriefings.id, dailyBriefing.id)).limit(1);
      return {
        ...dailyBriefing,
        payload: row.payload as any,
      };
    });
    fetchCalls.length = 0;
    const result = await runWithFarmContext(farmId, () => deliverBriefingViaTelegram(refreshed));
    expect(result).toEqual({ delivered: 0, skipped: true, reason: "ya_entregado" });
    expect(fetchCalls.length).toBe(0);
  });

  it("anomalías solo se entregan si son críticas", async () => {
    process.env.TELEGRAM_BOT_TOKEN = "123456:token-prueba-c2";
    const infoAnomaly = await runWithFarmContext(farmId, () =>
      buildDailyBriefing({
        kind: "anomalia",
        todayIso: addDaysIso(todayIso, -2),
        extraFindings: [{ code: "info", severity: "info", title: "Aviso leve", detail: "Sin urgencia" }],
      }),
    );
    fetchCalls.length = 0;
    const skipped = await runWithFarmContext(farmId, () => deliverBriefingViaTelegram(infoAnomaly.briefing));
    expect(skipped.reason).toBe("anomalia_no_critica");
    expect(fetchCalls.length).toBe(0);

    const criticalAnomaly = await runWithFarmContext(farmId, () =>
      buildDailyBriefing({
        kind: "anomalia",
        todayIso: addDaysIso(todayIso, -1),
        extraFindings: [sensitiveFinding],
      }),
    );
    const delivered = await runWithFarmContext(farmId, () => deliverBriefingViaTelegram(criticalAnomaly.briefing));
    expect(delivered.delivered).toBe(1);
    expect(fetchCalls.length).toBe(1);
  });

  it("el payload push solo lleva título genérico + conteo, nunca datos sensibles", () => {
    const payload = buildBriefingPushPayload(3);
    expect(payload.title).toBe("Gina te informa");
    expect(payload.body).toContain("3");
    expect(payload.url).toBe("/inicio");
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(sensitiveFinding.title);
    expect(serialized).not.toContain(sensitiveFinding.detail);
    expect(serialized).not.toContain("500");
    expect(serialized).not.toContain("12.345.678");

    // El sanitizador del Service Worker aplica la misma regla aunque el payload llegue sucio.
    const swSource = fs.readFileSync(path.resolve(process.cwd(), "public/sw.js"), "utf8");
    const match = swSource.match(/function sanitizeBriefingPushPayload[\s\S]*?\n}/);
    expect(match).toBeTruthy();
    const sanitize = new Function(`return ${match![0]}`)() as (raw: unknown) => any;
    const dirty = sanitize({
      unreadCount: 2,
      title: sensitiveFinding.title,
      body: sensitiveFinding.detail,
      findings: [sensitiveFinding],
      narrative: "Mortalidad disparada",
    });
    expect(dirty.title).toBe("Gina te informa");
    expect(dirty.url).toBe("/inicio");
    expect(JSON.stringify(dirty)).not.toContain("Mortalidad");
    expect(JSON.stringify(dirty)).not.toContain("12.345.678");
    expect(dirty.body).toContain("2");
  });

  it("trocea mensajes de más de 4096 caracteres y escapa HTML", () => {
    const long = Array.from({ length: 200 }, (_, i) => `Línea ${i} del parte diario con detalle de la granja.`).join("\n");
    expect(long.length).toBeGreaterThan(4096);
    const chunks = splitTelegramMessage(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(4096);
    expect(chunks.join("\n").replace(/\n+/g, "\n")).toContain("Línea 199");

    expect(escapeTelegramHtml('<b>&"x"</b>')).toBe("&lt;b&gt;&amp;\"x\"&lt;/b&gt;");
    expect(splitTelegramMessage("corto")).toEqual(["corto"]);
  });
});
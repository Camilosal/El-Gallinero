import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agentMemories, aiActions, aiConversations, aiMessages, users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { mockRequest, parseJson } from "./helpers";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import { callLlm } from "@/lib/agent/llm";
import { runAgentTurn } from "@/lib/agent/runtime";
import { buildSystemPrompt } from "@/lib/agent/prompt";
import {
  DELEGATION_POLICY_SETTING_KEY,
  HARD_FLOOR_TOOL_NAMES,
  defaultDelegationPolicy,
  delegationToolViews,
  describeDelegationPolicy,
  effectiveRequiresConfirmation,
  getDelegationPolicy,
  isHardFloorTool,
  sanitizeDelegationPolicy,
  saveDelegationPolicy,
} from "@/lib/agent/delegation";
import { updateSettings } from "@/lib/settings";
import { GET as delegacionGET, PUT as delegacionPUT } from "@/app/api/asistente/delegacion/route";

// El LLM se simula con guiones de tool_calls; la API interna del agente se
// reemplaza por un cliente falso para no depender de un servidor HTTP levantado.
const hoisted = vi.hoisted(() => ({
  apiCalls: [] as { method: string; path: string; body?: unknown }[],
}));

vi.mock("@/lib/agent/llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/llm")>();
  return { ...actual, callLlm: vi.fn() };
});

vi.mock("@/lib/agent/internal-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/internal-api")>();
  return {
    ...actual,
    InternalApiClient: vi.fn().mockImplementation(function () {
      return {
        get: vi.fn(async (path: string) => {
          hoisted.apiCalls.push({ method: "GET", path });
          return {};
        }),
        post: vi.fn(async (path: string, body: unknown) => {
          hoisted.apiCalls.push({ method: "POST", path, body });
          return { ok: true, id: "fake-created-id" };
        }),
        put: vi.fn(async (path: string, body: unknown) => {
          hoisted.apiCalls.push({ method: "PUT", path, body });
          return { ok: true };
        }),
      };
    }),
  };
});

function toolCall(name: string, args: Record<string, unknown>, id = "call_1") {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } } as any;
}

function writeTools() {
  return AGENT_TOOLS.filter((tool) => tool.kind === "write");
}

describe("B3 · política de delegación y piso duro (lógica pura)", () => {
  it("el piso duro es inviolable aunque la política pida auto en todas las herramientas", () => {
    const allAuto: Record<string, string> = {};
    for (const tool of writeTools()) allAuto[tool.name] = "auto";
    const sanitized = sanitizeDelegationPolicy(allAuto);
    for (const name of HARD_FLOOR_TOOL_NAMES) {
      expect(isHardFloorTool(name)).toBe(true);
      expect(sanitized[name]).toBe("confirm");
      expect(effectiveRequiresConfirmation(name, sanitized)).toBe(true);
      expect(effectiveRequiresConfirmation(name, allAuto as any)).toBe(true);
    }
    // Las ventas, el dinero y los cierres están cubiertos por el piso duro.
    for (const name of [
      "registrar_venta_huevos",
      "registrar_venta_animales",
      "registrar_gasto",
      "registrar_ingreso",
      "registrar_pago_personal",
      "registrar_cierre_diario",
    ]) {
      expect(HARD_FLOOR_TOOL_NAMES).toContain(name);
    }
  });

  it("la política recomendada reproduce el comportamiento histórico del asistente", () => {
    const defaults = defaultDelegationPolicy();
    for (const tool of writeTools()) {
      const expected = tool.requiresConfirmation || isHardFloorTool(tool.name) ? "confirm" : "auto";
      expect(defaults[tool.name]).toBe(expected);
      expect(effectiveRequiresConfirmation(tool.name, defaults)).toBe(expected === "confirm");
    }
    // registrar_presupuesto es delegable (no está en el piso duro) pero parte en confirm.
    expect(isHardFloorTool("registrar_presupuesto")).toBe(false);
    expect(defaults.registrar_presupuesto).toBe("confirm");
  });

  it("sanea claves y valores desconocidos sin romper la política", () => {
    const sanitized = sanitizeDelegationPolicy({
      registrar_presupuesto: "auto",
      herramienta_inexistente: "auto",
      registrar_mortalidad: "valor_invalido",
      registrar_venta_huevos: "auto",
    });
    expect(sanitized.registrar_presupuesto).toBe("auto");
    expect(sanitized.registrar_venta_huevos).toBe("confirm");
    expect("herramienta_inexistente" in sanitized).toBe(false);
    expect(sanitized.registrar_mortalidad).toBe("auto"); // default de herramienta rutinaria
    expect(sanitizeDelegationPolicy(null)).toEqual(defaultDelegationPolicy());
    expect(sanitizeDelegationPolicy("texto")).toEqual(defaultDelegationPolicy());
  });

  it("describeDelegationPolicy y delegationToolViews exponen la política para prompt y UI", () => {
    const policy = sanitizeDelegationPolicy({ registrar_presupuesto: "auto" });
    const description = describeDelegationPolicy(policy);
    expect(description).toContain("registrar_presupuesto");
    expect(description).toContain("delegated_auto");
    expect(description).toContain("registrar_venta_huevos");

    const views = delegationToolViews(policy);
    expect(views.length).toBe(writeTools().length);
    const presupuesto = views.find((v) => v.name === "registrar_presupuesto")!;
    expect(presupuesto.hardFloor).toBe(false);
    expect(presupuesto.effectiveMode).toBe("auto");
    const venta = views.find((v) => v.name === "registrar_venta_huevos")!;
    expect(venta.hardFloor).toBe(true);
    expect(venta.effectiveMode).toBe("confirm");
  });
});

describe("B3 · runtime del agente con política de delegación", () => {
  const tempUserId = crypto.randomUUID();
  const tempUsername = `deleg_test_${tempUserId.slice(0, 8)}`;
  const envBackup: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of ["ASSISTANT_AI_API_KEY", "ASSISTANT_JEV_ROUTING"]) {
      envBackup[key] = process.env[key];
    }
    process.env.ASSISTANT_AI_API_KEY = "test-key-delegation";
    process.env.ASSISTANT_JEV_ROUTING = "false";
    await db.insert(users).values({
      id: tempUserId,
      username: tempUsername,
      passwordHash: "test-hash-not-used",
      name: "Operador Delegación",
      role: "admin",
    });
  });

  afterAll(async () => {
    const convs = await db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(eq(aiConversations.userId, tempUserId));
    const convIds = convs.map((c) => c.id);
    if (convIds.length > 0) {
      await db.delete(aiMessages).where(inArray(aiMessages.conversationId, convIds));
    }
    await db.delete(aiActions).where(eq(aiActions.userId, tempUserId));
    await db.delete(aiConversations).where(eq(aiConversations.userId, tempUserId));
    await db.delete(agentMemories).where(eq(agentMemories.userId, tempUserId));
    await db.delete(users).where(eq(users.id, tempUserId));
    await updateSettings([{ key: DELEGATION_POLICY_SETTING_KEY, value: "{}" }]);
    for (const [key, value] of Object.entries(envBackup)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("escritura delegable en auto se ejecuta sin tarjeta y queda auditada como delegated_auto", async () => {
    await saveDelegationPolicy({ registrar_presupuesto: "auto" });
    hoisted.apiCalls.length = 0;
    vi.mocked(callLlm)
      .mockResolvedValueOnce({
        role: "assistant",
        content: null,
        tool_calls: [
          toolCall("registrar_presupuesto", {
            nombre: "Presupuesto Prueba B3",
            desde: "2027-01-01",
            hasta: "2027-12-31",
            rubros: [{ categoria: "alimento", meta_mensual: 100000 }],
          }),
        ],
      } as any)
      .mockResolvedValueOnce({ role: "assistant", content: "Presupuesto creado.", tool_calls: [] } as any);

    const result = await runAgentTurn({
      userId: tempUserId,
      userName: "Operador Delegación",
      message: "Crea el presupuesto de alimento del próximo año",
      cookie: null,
    });

    expect(result.pendingActions.length).toBe(0);
    const [action] = await db
      .select()
      .from(aiActions)
      .where(eq(aiActions.userId, tempUserId))
      .orderBy(aiActions.createdAt);
    expect(action.toolName).toBe("registrar_presupuesto");
    expect(action.status).toBe("executed");
    expect(action.origin).toBe("delegated_auto");
    expect(hoisted.apiCalls.some((c) => c.method === "POST" && c.path === "/api/presupuestos")).toBe(true);
  });

  it("intento de auto en una venta queda pending_confirmation: el piso duro prevalece", async () => {
    await saveDelegationPolicy({ registrar_venta_huevos: "auto" });
    const policy = await getDelegationPolicy();
    expect(policy.registrar_venta_huevos).toBe("confirm");
    hoisted.apiCalls.length = 0;
    vi.mocked(callLlm)
      .mockResolvedValueOnce({
        role: "assistant",
        content: null,
        tool_calls: [
          toolCall("registrar_venta_huevos", {
            items: [{ tamano: "A", cantidad: 30, precio_unitario: 400 }],
            comprador: "Tienda La Esquina",
          }),
        ],
      } as any)
      .mockResolvedValueOnce({ role: "assistant", content: "Quedó pendiente de confirmación.", tool_calls: [] } as any);

    const result = await runAgentTurn({
      userId: tempUserId,
      userName: "Operador Delegación",
      message: "Vende 30 huevos A a la tienda",
      cookie: null,
    });

    expect(result.pendingActions.length).toBe(1);
    expect(result.pendingActions[0].toolName).toBe("registrar_venta_huevos");
    const actions = await db
      .select()
      .from(aiActions)
      .where(eq(aiActions.userId, tempUserId));
    const venta = actions.find((a) => a.toolName === "registrar_venta_huevos")!;
    expect(venta.status).toBe("pending");
    expect(venta.origin).toBe("assistant");
    // Ninguna venta se ejecutó por la API interna.
    expect(hoisted.apiCalls.some((c) => c.method === "POST")).toBe(false);
  });

  it("escritura rutinaria auto por defecto se ejecuta sin tarjeta con origen assistant", async () => {
    await updateSettings([{ key: DELEGATION_POLICY_SETTING_KEY, value: "{}" }]);
    hoisted.apiCalls.length = 0;
    vi.mocked(callLlm)
      .mockResolvedValueOnce({
        role: "assistant",
        content: null,
        tool_calls: [toolCall("registrar_perdida_huevos", { cantidad: 4, razon: "rotos" })],
      } as any)
      .mockResolvedValueOnce({ role: "assistant", content: "Pérdida registrada.", tool_calls: [] } as any);

    const result = await runAgentTurn({
      userId: tempUserId,
      userName: "Operador Delegación",
      message: "Se rompieron 4 huevos",
      cookie: null,
    });

    expect(result.pendingActions.length).toBe(0);
    const actions = await db
      .select()
      .from(aiActions)
      .where(eq(aiActions.userId, tempUserId));
    const perdida = actions.find((a) => a.toolName === "registrar_perdida_huevos")!;
    expect(perdida.status).toBe("executed");
    expect(perdida.origin).toBe("assistant");
    expect(hoisted.apiCalls.some((c) => c.method === "POST" && c.path === "/api/perdidas-huevos")).toBe(true);
  });

  it("el prompt incluye la política en la cola dinámica sin tocar el núcleo estático (KV caching)", async () => {
    const policyA = sanitizeDelegationPolicy({ registrar_presupuesto: "auto" });
    const policyB = defaultDelegationPolicy();
    const promptA = await buildSystemPrompt("Operador Delegación", {
      delegationPolicy: describeDelegationPolicy(policyA),
    });
    const promptB = await buildSystemPrompt("Operador Delegación", {
      delegationPolicy: describeDelegationPolicy(policyB),
    });
    const marker = "## Política de delegación vigente";
    expect(promptA).toContain(marker);
    expect(promptB).toContain(marker);
    expect(promptA.split(marker)[0]).toBe(promptB.split(marker)[0]);
    expect(promptA).toContain("registrar_presupuesto");
  });
});

describe("B3 · API /api/asistente/delegacion (roles)", () => {
  const sessionBase = {
    id: "test-user",
    username: "test",
    name: "Test User",
    farmId: "00000000-0000-0000-0000-000000000001",
  };

  afterAll(async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ ...sessionBase, role: "admin" } as any);
    await updateSettings([{ key: DELEGATION_POLICY_SETTING_KEY, value: "{}" }]);
  });

  it("GET con admin devuelve política, vistas de herramientas, piso duro y canEdit", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ ...sessionBase, role: "admin" } as any);
    const res = await delegacionGET(mockRequest("http://localhost/api/asistente/delegacion"));
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(body.canEdit).toBe(true);
    expect(body.hardFloor).toEqual([...HARD_FLOOR_TOOL_NAMES]);
    expect(body.tools.length).toBe(writeTools().length);
    expect(body.tools.find((t: any) => t.name === "registrar_venta_huevos").hardFloor).toBe(true);
  });

  it("PUT por operario o gerente → 403 aunque tengan sesión válida", async () => {
    for (const role of ["operario", "gerente"]) {
      vi.mocked(getSessionUser).mockResolvedValue({ ...sessionBase, role } as any);
      const res = await delegacionPUT(
        mockRequest("http://localhost/api/asistente/delegacion", {
          method: "PUT",
          body: { policy: { registrar_presupuesto: "auto" } },
        }),
      );
      expect(res.status).toBe(403);
    }
    const policy = await getDelegationPolicy();
    expect(policy.registrar_presupuesto).toBe("confirm");
  });

  it("PUT por propietario guarda la política saneada y el reset restaura la recomendada", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({ ...sessionBase, role: "propietario" } as any);
    const res = await delegacionPUT(
      mockRequest("http://localhost/api/asistente/delegacion", {
        method: "PUT",
        body: { policy: { registrar_presupuesto: "auto", registrar_venta_huevos: "auto" } },
      }),
    );
    expect(res.status).toBe(200);
    const body = await parseJson(res);
    expect(body.policy.registrar_presupuesto).toBe("auto");
    expect(body.policy.registrar_venta_huevos).toBe("confirm");

    const resetRes = await delegacionPUT(
      mockRequest("http://localhost/api/asistente/delegacion", { method: "PUT", body: { reset: true } }),
    );
    expect(resetRes.status).toBe(200);
    const resetBody = await parseJson(resetRes);
    expect(resetBody.policy).toEqual(defaultDelegationPolicy());
  });
});
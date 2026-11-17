// D2: servidor MCP (Streamable HTTP, JSON-RPC 2.0) sobre el mismo ejecutor de D1.
// Handshake, lista filtrada por scope, consulta con contenido, venta pendiente
// de confirmación, token inválido/revocado y prohibición de escritura anónima.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, pool } from "@/db";
import { runPendingMigrations } from "@/db/migrate-prod";
import { aiActions, appSettings, exportTokens, farms, users } from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import { issueExportToken, revokeExportTokens } from "@/lib/export/auth";
import { getAgentTool } from "@/lib/agent/tools";
import { agentToolToMcpSchema } from "@/lib/agent/mcp";
import { __resetExternalRateLimitsForTests } from "@/lib/agent/external-api";

const mockedSessionUser = vi.hoisted(() => ({
  current: {
    id: "00000000-0000-0000-0000-000000000099",
    username: "admin",
    name: "Admin Test",
    role: "admin",
    farmId: "00000000-0000-0000-0000-000000000001",
  },
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSessionUser: vi.fn(async () => mockedSessionUser.current),
  };
});

const agentApi = vi.hoisted(() => ({
  calls: [] as { method: string; path: string; body?: unknown; cookie: string | null }[],
}));

vi.mock("@/lib/agent/internal-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent/internal-api")>();
  return {
    ...actual,
    InternalApiClient: vi.fn().mockImplementation(function (this: any, _baseUrl: string, cookie: string | null) {
      const invoke = async (method: string, path: string, body?: unknown) => {
        agentApi.calls.push({ method, path, body, cookie });
        const key = path.split("?")[0];
        if (method === "GET" && key === "/api/dashboard") {
          return { totalAnimals: 80, totalBirds: 80, species: [] };
        }
        if (method === "POST" && key === "/api/finanzas/finanzas/ventas") {
          return { ok: true, id: "venta-mcp-1" };
        }
        return { ok: true };
      };
      this.get = (path: string) => invoke("GET", path);
      this.post = (path: string, body?: unknown) => invoke("POST", path, body);
      this.put = (path: string, body?: unknown) => invoke("PUT", path, body);
    }),
  };
});

import { POST as mcpPost, GET as mcpGet } from "@/app/api/mcp/route";
import { POST as actionConfirmPost } from "@/app/api/asistente/acciones/[id]/confirmar/route";

describe("Bloque D2: servidor MCP sobre las mismas herramientas del agente", () => {
  const farmId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  let readWriteToken = "";
  let readWriteTokenId = "";
  let readOnlyToken = "";

  const rpc = (method: string, params?: Record<string, unknown>, token?: string, id: number | string = 1) =>
    new NextRequest("http://localhost:3000/api/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }),
    });

  const ventaArgs = {
    items: [{ tamano: "A", cantidad: 12, precio_unitario: 14000, presentacion: "docena", presentaciones: 1 }],
  };

  beforeAll(async () => {
    await runPendingMigrations(pool);
    await db.insert(farms).values({ id: farmId, slug: `mcp-${farmId.slice(0, 8)}`, name: "Granja MCP" });
    await runWithFarmContext(farmId, async () => {
      await db.insert(users).values({
        id: userId,
        username: `mcp_owner_${farmId.slice(0, 8)}`,
        passwordHash: "hash",
        name: "Propietario MCP",
        role: "propietario",
      });
      const tRW = await issueExportToken({
        createdBy: userId,
        name: "Cliente MCP Claude",
        scopes: ["agent:read", "agent:write"],
        expiresAt: new Date(Date.now() + 30 * 86400000),
        replacePrevious: false,
      });
      readWriteToken = tRW.token;
      readWriteTokenId = tRW.id;
      const tRO = await issueExportToken({
        createdBy: userId,
        name: "Cliente MCP solo lectura",
        scopes: ["agent:read"],
        replacePrevious: false,
      });
      readOnlyToken = tRO.token;
    });
  });

  beforeEach(() => {
    agentApi.calls.length = 0;
    __resetExternalRateLimitsForTests();
  });

  afterAll(async () => {
    await runWithFarmContext(farmId, async () => {
      await db.delete(aiActions).where(eq(aiActions.farmId, farmId));
      await db.delete(appSettings).where(eq(appSettings.farmId, farmId));
      await db.delete(users).where(eq(users.farmId, farmId));
    });
    await db.delete(exportTokens).where(eq(exportTokens.farmId, farmId));
    await db.delete(farms).where(eq(farms.id, farmId));
  });

  it("handshake initialize y notificación initialized", async () => {
    const res = await mcpPost(rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "claude", version: "1" } }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jsonrpc).toBe("2.0");
    expect(body.id).toBe(1);
    expect(body.result.protocolVersion).toBe("2025-03-26");
    expect(body.result.serverInfo.name).toBe("iwagranja");
    expect(body.result.capabilities.tools).toBeTruthy();
    expect(body.result.instructions).toContain("confirmar");

    const notif = await mcpPost(rpc("notifications/initialized"));
    expect(notif.status).toBe(202);

    const ping = await mcpPost(rpc("ping"));
    expect((await ping.json()).result).toEqual({});

    const getRes = await mcpGet();
    expect(getRes.status).toBe(405);
  });

  it("tools/list filtrado por scope, schemas derivados de AgentTool sin duplicar", async () => {
    const res = await mcpPost(rpc("tools/list", undefined, readWriteToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    const tools = body.result.tools as any[];
    expect(tools.length).toBeGreaterThan(10);

    const venta = tools.find((t) => t.name === "registrar_venta_huevos");
    expect(venta).toBeTruthy();
    expect(venta.description).toContain("ESCRITURA SENSIBLE");
    expect(venta.annotations.readOnlyHint).toBe(false);
    // El inputSchema es exactamente el declarado en AgentTool (una sola definición).
    const direct = agentToolToMcpSchema(getAgentTool("registrar_venta_huevos")!);
    expect(venta.inputSchema).toEqual(direct.inputSchema);
    expect(venta.inputSchema.required).toContain("items");

    const resumen = tools.find((t) => t.name === "consultar_resumen_granja");
    expect(resumen.annotations.readOnlyHint).toBe(true);

    // Token solo agent:read → únicamente consultas
    const roRes = await mcpPost(rpc("tools/list", undefined, readOnlyToken));
    const roTools = (await roRes.json()).result.tools as any[];
    expect(roTools.length).toBeGreaterThan(0);
    expect(roTools.every((t) => t.annotations.readOnlyHint === true)).toBe(true);

    // Sin token → error JSON-RPC; token inválido → error
    const anon = await mcpPost(rpc("tools/list"));
    expect(anon.status).toBe(401);
    expect((await anon.json()).error.code).toBe(-32001);
    const invalid = await mcpPost(rpc("tools/list", undefined, "glli_exp_token_falso_de_mas_de_20_caracteres"));
    expect(invalid.status).toBe(401);
    expect((await invalid.json()).error).toBeTruthy();
  });

  it("tools/call de consulta devuelve contenido MCP con los datos", async () => {
    const res = await mcpPost(rpc("tools/call", { name: "consultar_resumen_granja", arguments: {} }, readWriteToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.isError).toBe(false);
    expect(body.result.content[0].type).toBe("text");
    const payload = JSON.parse(body.result.content[0].text);
    expect(payload.status).toBe("ok");
    expect(payload.data.animales.total).toBe(80);
    expect(agentApi.calls.some((c) => c.path === "/api/dashboard")).toBe(true);
  });

  it("tools/call de venta devuelve acción pendiente y se confirma con el mismo token", async () => {
    const res = await mcpPost(rpc("tools/call", { name: "registrar_venta_huevos", arguments: ventaArgs }, readWriteToken));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.isError).toBe(false);
    const payload = JSON.parse(body.result.content[0].text);
    expect(payload.status).toBe("pending_confirmation");
    expect(payload.actionId).toBeTruthy();
    // No se ejecutó la venta todavía
    expect(agentApi.calls.some((c) => c.method === "POST" && c.path.includes("/ventas"))).toBe(false);

    const action = await runWithFarmContext(farmId, async () => {
      const [row] = await db.select().from(aiActions).where(eq(aiActions.id, payload.actionId)).limit(1);
      return row;
    });
    expect(action.status).toBe("pending");
    expect(action.origin).toBe("external_agent");
    expect(action.tokenId).toBe(readWriteTokenId);

    // Confirmación vía REST con el mismo token (el cliente MCP no tiene herramienta de confirmación propia)
    const confirmRes = await actionConfirmPost(
      new NextRequest(`http://localhost:3000/api/asistente/acciones/${payload.actionId}/confirmar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${readWriteToken}` },
      }),
      { params: Promise.resolve({ id: payload.actionId }) },
    );
    expect(confirmRes.status).toBe(200);
    expect(agentApi.calls.some((c) => c.method === "POST" && c.path === "/api/finanzas/finanzas/ventas")).toBe(true);
  });

  it("sin escritura anónima ni token inválido/revocado; solo lectura no puede mutar", async () => {
    const anon = await mcpPost(rpc("tools/call", { name: "registrar_venta_huevos", arguments: ventaArgs }));
    expect(anon.status).toBe(401);
    expect((await anon.json()).error.message).toContain("anónima");

    const invalid = await mcpPost(rpc("tools/call", { name: "registrar_venta_huevos", arguments: ventaArgs }, "glli_exp_token_falso_de_mas_de_20_caracteres"));
    expect(invalid.status).toBe(401);

    const roWrite = await mcpPost(rpc("tools/call", { name: "registrar_venta_huevos", arguments: ventaArgs }, readOnlyToken));
    expect(roWrite.status).toBe(403);

    // Token revocado corta también el canal MCP
    const issued = await runWithFarmContext(farmId, () =>
      issueExportToken({
        createdBy: userId,
        name: "MCP a revocar",
        scopes: ["agent:read", "agent:write"],
        expiresAt: new Date(Date.now() + 30 * 86400000),
        replacePrevious: false,
      }),
    );
    await runWithFarmContext(farmId, () => revokeExportTokens(issued.id));
    const revoked = await mcpPost(rpc("tools/call", { name: "consultar_resumen_granja", arguments: {} }, issued.token));
    expect(revoked.status).toBe(401);
    expect(agentApi.calls.length).toBe(0);
  });

  it("errores de protocolo: método desconocido, JSON inválido y parámetros faltantes", async () => {
    const unknown = await mcpPost(rpc("resources/list"));
    expect((await unknown.json()).error.code).toBe(-32601);

    const badJson = await mcpPost(
      new NextRequest("http://localhost:3000/api/mcp", { method: "POST", body: "{no json" }),
    );
    expect((await badJson.json()).error.code).toBe(-32700);

    const missingArgs = await mcpPost(rpc("tools/call", { name: "consultar_resumen_granja" }, readWriteToken));
    expect((await missingArgs.json()).error.code).toBe(-32602);

    const unknownTool = await mcpPost(rpc("tools/call", { name: "no_existe", arguments: {} }, readWriteToken));
    expect(unknownTool.status).toBe(404);
    expect((await unknownTool.json()).error).toBeTruthy();
  });
});
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, pool } from "@/db";
import { runPendingMigrations } from "@/db/migrate-prod";
import {
  aiActions,
  appSettings,
  contacts,
  exportTokens,
  farmLocations,
  farms,
  feedInventory,
  feedMovements,
  supplyInventory,
  transactions,
  users,
} from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import {
  DEFAULT_TOKEN_SCOPES,
  issueExportToken,
  normalizeTokenScopes,
  resolveExportToken,
  revokeExportTokens,
} from "@/lib/export/auth";

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

// D1: las herramientas del agente llaman la API interna con la sesión efímera
// del usuario delegante. Mockeamos el cliente para registrar método/ruta/cookie
// y devolver respuestas enlatadas (sin HTTP real).
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
          return { totalAnimals: 120, totalBirds: 120, species: [] };
        }
        if (method === "POST" && key === "/api/finanzas/finanzas/ventas") {
          return { ok: true, id: "venta-externa-1" };
        }
        return { ok: true };
      };
      this.get = (path: string) => invoke("GET", path);
      this.post = (path: string, body?: unknown) => invoke("POST", path, body);
      this.put = (path: string, body?: unknown) => invoke("PUT", path, body);
    }),
  };
});

import { GET as manifestGet } from "@/app/api/v1/integrations/manifest/route";
import { GET as transactionsGet } from "@/app/api/v1/integrations/transactions/route";
import { GET as inventoryGet } from "@/app/api/v1/integrations/inventory/route";
import { GET as movementsGet } from "@/app/api/v1/integrations/inventory/movements/route";
import { GET as contactsGet } from "@/app/api/v1/integrations/contacts/route";
import { GET as costCentersGet } from "@/app/api/v1/integrations/cost-centers/route";
import { GET as mappingGet, PUT as mappingPut } from "@/app/api/configuracion/integraciones/route";
import { GET as exportGet } from "@/app/api/export/route";
import { GET as tokenGet, POST as tokenPost } from "@/app/api/export/token/route";
import { GET as agentToolsGet } from "@/app/api/v1/agent/tools/route";
import { POST as agentToolPost } from "@/app/api/v1/agent/tools/[name]/route";
import { POST as actionConfirmPost } from "@/app/api/asistente/acciones/[id]/confirmar/route";
import { POST as actionCancelPost } from "@/app/api/asistente/acciones/[id]/cancelar/route";
import { __resetExternalRateLimitsForTests } from "@/lib/agent/external-api";

async function cleanupIntegrationFarm(farmId: string) {
  await runWithFarmContext(farmId, async () => {
    await db.delete(feedMovements).where(eq(feedMovements.farmId, farmId));
    await db.delete(feedInventory).where(eq(feedInventory.farmId, farmId));
    await db.delete(supplyInventory).where(eq(supplyInventory.farmId, farmId));
    await db.delete(transactions).where(eq(transactions.farmId, farmId));
    await db.delete(contacts).where(eq(contacts.farmId, farmId));
    await db.delete(farmLocations).where(eq(farmLocations.farmId, farmId));
    await db.delete(appSettings).where(eq(appSettings.farmId, farmId));
    await db.delete(users).where(eq(users.farmId, farmId));
  });
  await db.delete(exportTokens).where(eq(exportTokens.farmId, farmId));
  await db.delete(farms).where(eq(farms.id, farmId));
}

describe("Bloque B: API de conectores ERP (SIIGO, Alegra, Odoo, Zoho) y export JSON", () => {
  const farmAId = crypto.randomUUID();
  const farmBId = crypto.randomUUID();
  let fullTokenA = "";
  let financeOnlyTokenA = "";
  let expiredTokenA = "";

  beforeAll(async () => {
    await runPendingMigrations(pool);

    await db.insert(farms).values([
      { id: farmAId, slug: `erp-a-${farmAId.slice(0, 8)}`, name: "Granja ERP Alfa" },
      { id: farmBId, slug: `erp-b-${farmBId.slice(0, 8)}`, name: "Granja ERP Beta" },
    ]);

    await runWithFarmContext(farmAId, async () => {
      const [userA] = await db
        .insert(users)
        .values({
          id: mockedSessionUser.current.id,
          username: `erp_admin_${farmAId.slice(0, 8)}`,
          passwordHash: "hash",
          name: "Admin ERP Test",
          role: "admin",
        })
        .returning({ id: users.id });
      expect(userA.id).toBe(mockedSessionUser.current.id);

      const [locA] = await db
        .insert(farmLocations)
        .values({ code: "GALP-A1", name: "Galpón Alfa 1", type: "galpon" })
        .returning();

      await db.insert(transactions).values([
        {
          date: "2026-11-10",
          type: "ingreso",
          category: "Venta de huevos",
          description: "Venta 10 cubetas AA Alfa",
          counterparty: "Tienda El Sol",
          amount: "180000",
          quantity: "10",
          unitPrice: "18000",
          unit: "cubeta",
          species: "gallina",
          locationId: locA.id,
          isCredit: false,
        },
        {
          date: "2026-11-12",
          type: "egreso",
          category: "Alimento",
          description: "Compra maíz amarillo Alfa",
          counterparty: "AgroInsumos del Norte",
          amount: "240000",
          quantity: "4",
          unitPrice: "60000",
          unit: "bulto",
          species: "pollo",
          isCredit: true,
        },
      ]);

      const [feedA] = await db
        .insert(feedInventory)
        .values({
          name: "Concentrado Ponedora Alfa",
          category: "Concentrado",
          feedType: "concentrado_comercial",
          unit: "kg",
          currentStock: "120",
          minStock: "40",
          costPerUnit: "2500",
        })
        .returning();

      await db.insert(feedMovements).values({
        feedId: feedA.id,
        quantity: "120",
        isEntry: true,
        movementType: "compra",
        species: "gallina",
        unitCost: "2500",
        locationId: locA.id,
        date: "2026-11-10",
        notes: "Ingreso inicial Alfa",
      });

      await db.insert(supplyInventory).values({
        name: "Vacuna Newcastle Alfa",
        category: "biologico",
        unit: "frasco",
        currentStock: "5",
        minStock: "2",
        costPerUnit: "18000",
      });

      await db.insert(contacts).values({
        name: "Tienda El Sol",
        role: "cliente",
        personType: "juridica",
        documentType: "NIT",
        documentNumber: "900123456-7",
        email: "compras@elsol.co",
        phone: "3105550101",
        city: "Medellín",
        department: "Antioquia",
        creditDays: 15,
      });

      const tFull = await issueExportToken({
        name: "SIIGO Principal",
        profile: "siigo",
        scopes: ["read:finance", "read:inventory", "read:contacts", "read:production"],
        replacePrevious: false,
      });
      fullTokenA = tFull.token;

      const tFin = await issueExportToken({
        name: "Solo Contable",
        profile: "alegra",
        scopes: ["read:finance"],
        replacePrevious: false,
      });
      financeOnlyTokenA = tFin.token;

      const tExp = await issueExportToken({
        name: "Expirado",
        profile: "generic",
        expiresAt: new Date(Date.now() - 60_000),
        replacePrevious: false,
      });
      expiredTokenA = tExp.token;
    });

    await runWithFarmContext(farmBId, async () => {
      await db.insert(transactions).values({
        date: "2026-11-11",
        type: "ingreso",
        category: "Venta de huevos",
        description: "Venta Confidencial Beta",
        amount: "999000",
      });
      await db.insert(contacts).values({
        name: "Cliente Secreto Beta",
        role: "cliente",
      });
    });
  });

  afterAll(async () => {
    mockedSessionUser.current.farmId = DEFAULT_FARM_ID;
    await cleanupIntegrationFarm(farmAId);
    await cleanupIntegrationFarm(farmBId);
  });

  it("rechaza tokens vencidos y valida alcances por endpoint (401/403)", async () => {
    expect(await resolveExportToken(expiredTokenA)).toBeNull();

    const expiredRes = await transactionsGet(
      new NextRequest("http://localhost:3000/api/v1/integrations/transactions", {
        headers: { Authorization: `Bearer ${expiredTokenA}` },
      }),
    );
    expect(expiredRes.status).toBe(401);

    // Token con solo read:finance accede a transactions y cost-centers, pero recibe 403 en inventory y contacts
    const okFin = await transactionsGet(
      new NextRequest("http://localhost:3000/api/v1/integrations/transactions", {
        headers: { "X-Export-Token": financeOnlyTokenA },
      }),
    );
    expect(okFin.status).toBe(200);

    const okCost = await costCentersGet(
      new NextRequest("http://localhost:3000/api/v1/integrations/cost-centers", {
        headers: { "X-Export-Token": financeOnlyTokenA },
      }),
    );
    expect(okCost.status).toBe(200);

    const forbiddenInv = await inventoryGet(
      new NextRequest("http://localhost:3000/api/v1/integrations/inventory", {
        headers: { "X-Export-Token": financeOnlyTokenA },
      }),
    );
    expect(forbiddenInv.status).toBe(403);

    const forbiddenContacts = await contactsGet(
      new NextRequest("http://localhost:3000/api/v1/integrations/contacts", {
        headers: { "X-Export-Token": financeOnlyTokenA },
      }),
    );
    expect(forbiddenContacts.status).toBe(403);
  });

  it("aisla datos por tenant y adapta formatos para SIIGO, Alegra, Odoo, Zoho y Genérico", async () => {
    mockedSessionUser.current.farmId = farmAId;
    const putRes = await mappingPut(
      new NextRequest("http://localhost:3000/api/configuracion/integraciones", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultProfile: "siigo",
          siigoDocumentCode: "FV",
          incomeAccountCode: "410510",
          costCentersBySpecies: { gallina: "CC-PONEDORAS-NORTE" },
        }),
      }),
    );
    expect(putRes.status).toBe(200);

    const savedGet = await (
      await mappingGet(new NextRequest("http://localhost:3000/api/configuracion/integraciones"))
    ).json();
    expect(savedGet.mapping.incomeAccountCode).toBe("410510");
    expect(savedGet.mapping.siigoDocumentCode).toBe("FV");

    // 1. Manifest
    const manRes = await manifestGet(
      new NextRequest("http://localhost:3000/api/v1/integrations/manifest", {
        headers: { Authorization: `Bearer ${fullTokenA}` },
      }),
    );
    expect(manRes.status).toBe(200);
    const man = await manRes.json();
    expect(man.farm.id).toBe(farmAId);
    expect(man.endpoints.length).toBeGreaterThanOrEqual(6);

    // 2. SIIGO transactions (con ubicación -> GALP-A1, PUC 410510)
    const siigoRes = await transactionsGet(
      new NextRequest("http://localhost:3000/api/v1/integrations/transactions?profile=siigo", {
        headers: { Authorization: `Bearer ${fullTokenA}` },
      }),
    );
    expect(siigoRes.status).toBe(200);
    const siigoBody = await siigoRes.json();
    expect(siigoBody.profile).toBe("siigo");
    expect(siigoBody.items.length).toBe(2);
    // Verifica que no aparezcan datos de Farm B
    expect(JSON.stringify(siigoBody.items)).not.toContain("Beta");
    const incomeSiigo = siigoBody.items.find((i: Record<string, unknown>) => i.movement_type === "ingreso");
    expect(incomeSiigo.voucher_type).toBe("FV");
    expect(incomeSiigo.account_credit).toBe("410510");
    expect(incomeSiigo.cost_center).toBe("GALP-A1");

    // 3. Alegra, Odoo, Zoho & paginación
    const alegraBody = await (
      await transactionsGet(
        new NextRequest("http://localhost:3000/api/v1/integrations/transactions?profile=alegra&limit=1&cursor=0", {
          headers: { Authorization: `Bearer ${fullTokenA}` },
        }),
      )
    ).json();
    expect(alegraBody.hasMore).toBe(true);
    expect(alegraBody.nextCursor).toBe("1");
    expect(alegraBody.items[0]).toHaveProperty("categoryAccount");

    const odooBody = await (
      await transactionsGet(
        new NextRequest("http://localhost:3000/api/v1/integrations/transactions?profile=odoo", {
          headers: { Authorization: `Bearer ${fullTokenA}` },
        }),
      )
    ).json();
    expect(["out_invoice", "in_invoice"]).toContain(odooBody.items[0].move_type);

    const zohoBody = await (
      await transactionsGet(
        new NextRequest("http://localhost:3000/api/v1/integrations/transactions?profile=zoho", {
          headers: { Authorization: `Bearer ${fullTokenA}` },
        }),
      )
    ).json();
    expect(["invoice", "bill"]).toContain(zohoBody.items[0].transaction_type);

    // 4. Inventory, Movements & Contacts
    const invBody = await (
      await inventoryGet(
        new NextRequest("http://localhost:3000/api/v1/integrations/inventory?profile=odoo", {
          headers: { Authorization: `Bearer ${fullTokenA}` },
        }),
      )
    ).json();
    expect(invBody.total).toBe(2);
    expect(invBody.items[0]).toHaveProperty("default_code");

    const movBody = await (
      await movementsGet(
        new NextRequest("http://localhost:3000/api/v1/integrations/inventory/movements?profile=generic", {
          headers: { Authorization: `Bearer ${fullTokenA}` },
        }),
      )
    ).json();
    expect(movBody.total).toBe(1);
    expect(movBody.items[0].sku).toContain("FEED-");

    const contactsBody = await (
      await contactsGet(
        new NextRequest("http://localhost:3000/api/v1/integrations/contacts?profile=siigo", {
          headers: { Authorization: `Bearer ${fullTokenA}` },
        }),
      )
    ).json();
    expect(contactsBody.total).toBe(1);
    expect(contactsBody.items[0].identification).toBe("900123456-7");
    expect(JSON.stringify(contactsBody.items)).not.toContain("Beta");

    // 5. /api/export?format=json incremental con paginación por cursor
    const jsonExportRes = await exportGet(
      new NextRequest(
        "http://localhost:3000/api/export?dataset=finanzas&format=json&from=2026-11-01&to=2026-11-30&limit=1&cursor=0",
        { headers: { "X-Export-Token": fullTokenA } },
      ),
    );
    expect(jsonExportRes.status).toBe(200);
    const jsonExport = await jsonExportRes.json();
    expect(jsonExport.object).toBe("export_records");
    expect(jsonExport.farmId).toBe(farmAId);
    expect(jsonExport.count).toBe(1);
    expect(jsonExport.hasMore).toBe(true);
    expect(jsonExport.nextCursor).toBe("1");
  });
});

describe("Bloque D1: API v1 de herramientas del agente con scopes de escritura", () => {
  const farmCId = crypto.randomUUID();
  const farmDId = crypto.randomUUID();
  const userCId = crypto.randomUUID();
  const userDId = crypto.randomUUID();
  let readWriteToken = "";
  let readWriteTokenId = "";
  let agentReadOnlyToken = "";
  let erpOnlyToken = "";
  let foreignToken = "";
  let noUserToken = "";

  const ventaArgs = {
    items: [{ tamano: "AA", cantidad: 30, precio_unitario: 15000, presentacion: "cubeta", presentaciones: 1 }],
    comprador: "Tienda El Sol",
  };

  const toolRequest = (name: string, token: string, args: unknown = {}) =>
    new NextRequest(`http://localhost:3000/api/v1/agent/tools/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ args }),
    });
  const toolParams = (name: string) => ({ params: Promise.resolve({ name }) });
  const actionParams = (id: string) => ({ params: Promise.resolve({ id }) });
  const confirmRequest = (id: string, token: string) =>
    new NextRequest(`http://localhost:3000/api/asistente/acciones/${id}/confirmar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  const cancelRequest = (id: string, token: string) =>
    new NextRequest(`http://localhost:3000/api/asistente/acciones/${id}/cancelar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  const getAction = (id: string) =>
    runWithFarmContext(farmCId, async () => {
      const [row] = await db.select().from(aiActions).where(eq(aiActions.id, id)).limit(1);
      return row;
    });

  beforeAll(async () => {
    await runPendingMigrations(pool);
    await db.insert(farms).values([
      { id: farmCId, slug: `agent-c-${farmCId.slice(0, 8)}`, name: "Granja Agente Gamma" },
      { id: farmDId, slug: `agent-d-${farmDId.slice(0, 8)}`, name: "Granja Agente Delta" },
    ]);

    await runWithFarmContext(farmCId, async () => {
      await db.insert(users).values({
        id: userCId,
        username: `agent_owner_${farmCId.slice(0, 8)}`,
        passwordHash: "hash",
        name: "Propietario Gamma",
        role: "propietario",
      });
      const tRW = await issueExportToken({
        createdBy: userCId,
        name: "Agente externo lectura+escritura",
        scopes: ["agent:read", "agent:write"],
        expiresAt: new Date(Date.now() + 30 * 86400000),
        replacePrevious: false,
      });
      readWriteToken = tRW.token;
      readWriteTokenId = tRW.id;
      const tRO = await issueExportToken({
        createdBy: userCId,
        name: "Agente externo solo lectura",
        scopes: ["agent:read"],
        replacePrevious: false,
      });
      agentReadOnlyToken = tRO.token;
      const tErp = await issueExportToken({
        createdBy: userCId,
        name: "ERP legacy sin agente",
        scopes: ["read:finance", "read:inventory"],
        replacePrevious: false,
      });
      erpOnlyToken = tErp.token;
      const tNoUser = await issueExportToken({
        createdBy: null,
        name: "Token sin usuario delegante",
        scopes: ["agent:read", "agent:write"],
        expiresAt: new Date(Date.now() + 30 * 86400000),
        replacePrevious: false,
      });
      noUserToken = tNoUser.token;
    });

    await runWithFarmContext(farmDId, async () => {
      await db.insert(users).values({
        id: userDId,
        username: `agent_other_${farmDId.slice(0, 8)}`,
        passwordHash: "hash",
        name: "Propietario Delta",
        role: "propietario",
      });
      const tForeign = await issueExportToken({
        createdBy: userDId,
        name: "Agente de otra granja",
        scopes: ["agent:read", "agent:write"],
        expiresAt: new Date(Date.now() + 30 * 86400000),
        replacePrevious: false,
      });
      foreignToken = tForeign.token;
    });
  });

  beforeEach(() => {
    agentApi.calls.length = 0;
    __resetExternalRateLimitsForTests();
  });

  afterAll(async () => {
    mockedSessionUser.current.farmId = DEFAULT_FARM_ID;
    for (const farmId of [farmCId, farmDId]) {
      await runWithFarmContext(farmId, async () => {
        await db.delete(aiActions).where(eq(aiActions.farmId, farmId));
        await db.delete(appSettings).where(eq(appSettings.farmId, farmId));
        await db.delete(users).where(eq(users.farmId, farmId));
      });
      await db.delete(exportTokens).where(eq(exportTokens.farmId, farmId));
      await db.delete(farms).where(eq(farms.id, farmId));
    }
  });

  it("manifiesto filtrado por scopes, con confirmación efectiva, piso duro y dominio Jev", async () => {
    // Token ERP legacy sin alcances de agente → 403
    const erpRes = await agentToolsGet(
      new NextRequest("http://localhost:3000/api/v1/agent/tools", {
        headers: { Authorization: `Bearer ${erpOnlyToken}` },
      }),
    );
    expect(erpRes.status).toBe(403);

    const rwRes = await agentToolsGet(
      new NextRequest("http://localhost:3000/api/v1/agent/tools", {
        headers: { Authorization: `Bearer ${readWriteToken}` },
      }),
    );
    expect(rwRes.status).toBe(200);
    const rw = await rwRes.json();
    expect(rw.object).toBe("agent_tools_manifest");
    const venta = rw.tools.find((t: any) => t.name === "registrar_venta_huevos");
    expect(venta).toBeTruthy();
    expect(venta.kind).toBe("write");
    expect(venta.requiresConfirmation).toBe(true);
    expect(venta.hardFloor).toBe(true);
    expect(venta.requiredScope).toBe("agent:write");
    expect(venta.jevDomains.length).toBeGreaterThan(0);
    expect(venta.parameters.required).toContain("items");
    expect(rw.tools.some((t: any) => t.name === "consultar_resumen_granja")).toBe(true);
    expect(rw.execution.confirmEndpoint).toContain("/confirmar");

    // Solo agent:read → únicamente consultas
    const roRes = await agentToolsGet(
      new NextRequest("http://localhost:3000/api/v1/agent/tools", {
        headers: { Authorization: `Bearer ${agentReadOnlyToken}` },
      }),
    );
    expect(roRes.status).toBe(200);
    const ro = await roRes.json();
    expect(ro.tools.length).toBeGreaterThan(0);
    expect(ro.tools.every((t: any) => t.kind === "read")).toBe(true);

    // El manifiesto de integraciones lista los endpoints nuevos
    const manRes = await manifestGet(
      new NextRequest("http://localhost:3000/api/v1/integrations/manifest", {
        headers: { Authorization: `Bearer ${readWriteToken}` },
      }),
    );
    const man = await manRes.json();
    expect(man.endpoints.some((e: any) => e.id === "agent-tools")).toBe(true);
    expect(man.endpoints.some((e: any) => e.id === "agent-tool-execute")).toBe(true);
    expect(man.endpoints.some((e: any) => e.id === "agent-action-confirm")).toBe(true);
  });

  it("token solo-lectura no puede POST escrituras y token ERP no puede consultar herramientas", async () => {
    const writeRes = await agentToolPost(toolRequest("registrar_venta_huevos", agentReadOnlyToken, ventaArgs), toolParams("registrar_venta_huevos"));
    expect(writeRes.status).toBe(403);

    const erpReadRes = await agentToolPost(toolRequest("consultar_resumen_granja", erpOnlyToken), toolParams("consultar_resumen_granja"));
    expect(erpReadRes.status).toBe(403);

    const unknownRes = await agentToolPost(toolRequest("herramienta_inexistente", readWriteToken), toolParams("herramienta_inexistente"));
    expect(unknownRes.status).toBe(404);
    expect(agentApi.calls.length).toBe(0);
  });

  it("consulta vía API se ejecuta con sesión efímera del usuario delegante", async () => {
    const res = await agentToolPost(toolRequest("consultar_resumen_granja", agentReadOnlyToken), toolParams("consultar_resumen_granja"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.data.animales.total).toBe(120);
    const call = agentApi.calls.find((c) => c.path === "/api/dashboard");
    expect(call).toBeTruthy();
    expect(call!.cookie).toContain("galli_session=");
  });

  it("escritura sensible devuelve 202 con actionId, no se ejecuta y queda auditada con origin y tokenId", async () => {
    const res = await agentToolPost(toolRequest("registrar_venta_huevos", readWriteToken, ventaArgs), toolParams("registrar_venta_huevos"));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.status).toBe("pending_confirmation");
    expect(body.actionId).toBeTruthy();
    expect(body.confirmEndpoint).toContain(body.actionId);
    // No se ejecutó ninguna escritura real
    expect(agentApi.calls.some((c) => c.method === "POST" && c.path.includes("/ventas"))).toBe(false);

    const action = await getAction(body.actionId);
    expect(action.status).toBe("pending");
    expect(action.origin).toBe("external_agent");
    expect(action.tokenId).toBe(readWriteTokenId);
    expect(action.farmId).toBe(farmCId);
    expect(action.userId).toBe(userCId);
    expect(action.summary).toContain("Vender");
  });

  it("confirmar con el mismo token ejecuta; token de otra granja no puede tocar la acción; cancelar funciona", async () => {
    const pendingRes = await agentToolPost(toolRequest("registrar_venta_huevos", readWriteToken, ventaArgs), toolParams("registrar_venta_huevos"));
    const { actionId } = await pendingRes.json();

    // Aislamiento: el token de la granja Delta jamás confirma acciones de Gamma
    const foreignRes = await actionConfirmPost(confirmRequest(actionId, foreignToken), actionParams(actionId));
    expect(foreignRes.status).toBe(400);
    expect((await getAction(actionId)).status).toBe("pending");

    const okRes = await actionConfirmPost(confirmRequest(actionId, readWriteToken), actionParams(actionId));
    expect(okRes.status).toBe(200);
    const okBody = await okRes.json();
    expect(okBody.ok).toBe(true);
    expect(agentApi.calls.some((c) => c.method === "POST" && c.path === "/api/finanzas/finanzas/ventas")).toBe(true);
    const executed = await getAction(actionId);
    expect(executed.status).toBe("executed");
    expect(executed.origin).toBe("external_agent");
    expect(executed.tokenId).toBe(readWriteTokenId);

    // Confirmar dos veces → error (ya procesada)
    const twiceRes = await actionConfirmPost(confirmRequest(actionId, readWriteToken), actionParams(actionId));
    expect(twiceRes.status).toBe(400);

    // Cancelar otra acción pendiente con el mismo token
    const pending2 = await (await agentToolPost(toolRequest("registrar_venta_huevos", readWriteToken, ventaArgs), toolParams("registrar_venta_huevos"))).json();
    const cancelRes = await actionCancelPost(cancelRequest(pending2.actionId, readWriteToken), actionParams(pending2.actionId));
    expect(cancelRes.status).toBe(200);
    expect((await getAction(pending2.actionId)).status).toBe("cancelled");
  });

  it("token revocado corta el canal: 401 al ejecutar y al confirmar", async () => {
    const issued = await runWithFarmContext(farmCId, () =>
      issueExportToken({
        createdBy: userCId,
        name: "Token a revocar",
        scopes: ["agent:read", "agent:write"],
        expiresAt: new Date(Date.now() + 30 * 86400000),
        replacePrevious: false,
      }),
    );
    const okRes = await agentToolPost(toolRequest("consultar_resumen_granja", issued.token), toolParams("consultar_resumen_granja"));
    expect(okRes.status).toBe(200);

    await runWithFarmContext(farmCId, () => revokeExportTokens(issued.id));

    const revokedRes = await agentToolPost(toolRequest("consultar_resumen_granja", issued.token), toolParams("consultar_resumen_granja"));
    expect(revokedRes.status).toBe(401);
    const revokedConfirm = await actionConfirmPost(confirmRequest(crypto.randomUUID(), issued.token), actionParams(crypto.randomUUID()));
    expect(revokedConfirm.status).toBe(401);
  });

  it("rate limit: 60 solicitudes por minuto por token", async () => {
    const issued = await runWithFarmContext(farmCId, () =>
      issueExportToken({
        createdBy: userCId,
        name: "Token rate limit",
        scopes: ["agent:read"],
        replacePrevious: false,
      }),
    );
    for (let i = 0; i < 60; i += 1) {
      const res = await agentToolPost(toolRequest("consultar_resumen_granja", issued.token), toolParams("consultar_resumen_granja"));
      expect(res.status).toBe(200);
    }
    const exceeded = await agentToolPost(toolRequest("consultar_resumen_granja", issued.token), toolParams("consultar_resumen_granja"));
    expect(exceeded.status).toBe(429);
  });

  it("agent:write exige expiración obligatoria de máximo 90 días y nunca se otorga por defecto", async () => {
    // Defaults legacy siguen siendo de solo lectura ERP
    expect(normalizeTokenScopes([])).toEqual(DEFAULT_TOKEN_SCOPES);
    expect(normalizeTokenScopes(["invalido"])).toEqual(DEFAULT_TOKEN_SCOPES);
    expect(DEFAULT_TOKEN_SCOPES).not.toContain("agent:write");

    await runWithFarmContext(farmCId, async () => {
      await expect(
        issueExportToken({ createdBy: userCId, scopes: ["agent:write"], replacePrevious: false }),
      ).rejects.toThrow(/expiración/);
      await expect(
        issueExportToken({
          createdBy: userCId,
          scopes: ["agent:write"],
          expiresAt: new Date(Date.now() + 120 * 86400000),
          replacePrevious: false,
        }),
      ).rejects.toThrow(/90 días/);
    });

    // Vía ruta HTTP con sesión de administración (el usuario debe existir en la
    // granja: export_tokens.created_by tiene FK a users).
    const originalSessionId = mockedSessionUser.current.id;
    mockedSessionUser.current.farmId = farmCId;
    mockedSessionUser.current.id = userCId;
    const postToken = (body: Record<string, unknown>) =>
      tokenPost(
        new NextRequest("http://localhost:3000/api/export/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    const sinExpiracion = await postToken({ action: "generate", replacePrevious: false, name: "Agente sin expiry", scopes: ["agent:write"] });
    expect(sinExpiracion.status).toBe(400);
    const largo = await postToken({ action: "generate", replacePrevious: false, name: "Agente 91 días", scopes: ["agent:write"], expiresInDays: 91 });
    expect(largo.status).toBe(400);
    const valido = await postToken({ action: "generate", replacePrevious: false, name: "Agente 90 días", scopes: ["agent:read", "agent:write"], expiresInDays: 90 });
    expect(valido.status).toBe(201);
    const validoBody = await valido.json();
    expect(validoBody.summary.scopes).toContain("agent:write");
    expect(validoBody.summary.expiresAt).toBeTruthy();

    const catalog = await (await tokenGet(new NextRequest("http://localhost:3000/api/export/token"))).json();
    expect(catalog.availableScopes).toContain("agent:read");
    expect(catalog.availableScopes).toContain("agent:write");
    expect(catalog.writeScopeMaxDays).toBe(90);
    mockedSessionUser.current.farmId = DEFAULT_FARM_ID;
    mockedSessionUser.current.id = originalSessionId;
  });

  it("token sin usuario delegante no puede ejecutar herramientas", async () => {
    const res = await agentToolPost(toolRequest("consultar_resumen_granja", noUserToken), toolParams("consultar_resumen_granja"));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("usuario delegante");
  });
});

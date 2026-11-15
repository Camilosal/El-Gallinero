import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, pool } from "@/db";
import { runPendingMigrations } from "@/db/migrate-prod";
import {
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
import { issueExportToken, resolveExportToken } from "@/lib/export/auth";

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

import { GET as manifestGet } from "@/app/api/v1/integrations/manifest/route";
import { GET as transactionsGet } from "@/app/api/v1/integrations/transactions/route";
import { GET as inventoryGet } from "@/app/api/v1/integrations/inventory/route";
import { GET as movementsGet } from "@/app/api/v1/integrations/inventory/movements/route";
import { GET as contactsGet } from "@/app/api/v1/integrations/contacts/route";
import { GET as costCentersGet } from "@/app/api/v1/integrations/cost-centers/route";
import { GET as mappingGet, PUT as mappingPut } from "@/app/api/configuracion/integraciones/route";
import { GET as exportGet } from "@/app/api/export/route";

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

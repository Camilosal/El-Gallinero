import { afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/db";
import {
  appSettings,
  billingPayments,
  farmSubscriptions,
  farms,
  users,
} from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";

const mockedSessionUser = vi.hoisted(() => ({
  current: {
    id: "00000000-0000-0000-0000-000000000099",
    username: "admin",
    name: "Super Admin Iwagé",
    role: "admin",
    farmId: "00000000-0000-0000-0000-000000000001",
    homeFarmId: "00000000-0000-0000-0000-000000000001",
  } as {
    id: string;
    username: string;
    name: string;
    role: string;
    farmId: string;
    homeFarmId?: string;
  } | null,
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSessionUser: vi.fn(async () => mockedSessionUser.current),
    switchUserSessionFarm: vi.fn(async (_userId: string, targetFarmId: string) => {
      if (mockedSessionUser.current) {
        mockedSessionUser.current = {
          ...mockedSessionUser.current,
          farmId: targetFarmId,
        };
      }
    }),
  };
});

import {
  canManagePlatformTenants,
  GET as getSuperAdminFarms,
  PATCH as patchSuperAdminFarms,
  POST as postSuperAdminFarms,
} from "@/app/api/superadmin/granjas/route";

describe("Super-Admin Panel de Granjas (Tenants) API", () => {
  const createdFarmIds: string[] = [];

  afterAll(async () => {
    for (const fId of createdFarmIds) {
      await runWithFarmContext(fId, async () => {
        await db.delete(appSettings).where(eq(appSettings.farmId, fId));
      });
      await db.delete(billingPayments).where(eq(billingPayments.farmId, fId));
      await db.delete(farmSubscriptions).where(eq(farmSubscriptions.farmId, fId));
      await db.delete(users).where(eq(users.farmId, fId));
      await db.delete(farms).where(eq(farms.id, fId));
    }
  });

  it("restringe el acceso a usuarios de granjas secundarias sin rol de Super-Admin (403)", async () => {
    mockedSessionUser.current = {
      id: "00000000-0000-0000-0000-000000000888",
      username: "propietario_otra_finca",
      name: "Propietario Externo",
      role: "propietario",
      farmId: "00000000-0000-0000-0000-000000000999",
      homeFarmId: "00000000-0000-0000-0000-000000000999",
    };

    expect(canManagePlatformTenants(mockedSessionUser.current)).toBe(false);

    const req = new NextRequest("http://localhost:3000/api/superadmin/granjas");
    const res = await getSuperAdminFarms(req);
    expect(res.status).toBe(403);
  });

  it("niega el panel a un admin local de una granja secundaria (aislamiento multi-tenant)", async () => {
    mockedSessionUser.current = {
      id: "00000000-0000-0000-0000-000000000777",
      username: "admin_finca_secundaria",
      name: "Admin Local",
      role: "admin",
      farmId: "00000000-0000-0000-0000-000000000999",
      homeFarmId: "00000000-0000-0000-0000-000000000999",
    };

    expect(canManagePlatformTenants(mockedSessionUser.current)).toBe(false);

    const req = new NextRequest("http://localhost:3000/api/superadmin/granjas");
    const res = await getSuperAdminFarms(req);
    expect(res.status).toBe(403);
  });

  it("permite al Super-Admin crear una nueva granja Llave en Mano, actualizar su plan/vencimiento y cambiar de contexto", async () => {
    mockedSessionUser.current = {
      id: "00000000-0000-0000-0000-000000000099",
      username: "admin",
      name: "Super Admin Iwagé",
      role: "admin",
      farmId: DEFAULT_FARM_ID,
      homeFarmId: DEFAULT_FARM_ID,
    };

    expect(canManagePlatformTenants(mockedSessionUser.current)).toBe(true);

    const uniqueSuffix = Date.now().toString().slice(-6);
    const ownerUsername = `admin_finca_${uniqueSuffix}`;

    // 1. Crear nueva granja (POST)
    const createReq = new NextRequest(
      "http://localhost:3000/api/superadmin/granjas",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmName: `Hacienda Avícola El Sol ${uniqueSuffix}`,
          municipality: "Fómeque, Cundinamarca",
          scale: "MEDIANO",
          planCode: "MEDIANO_MENSUAL",
          status: "active",
          durationDays: 30,
          maxUsers: 15,
          allyCode: "AGRO-FOMEQUE",
          qrSource: "KIT-CAMPO-2026",
          ownerName: "Don Carlos Restrepo",
          ownerUsername,
          ownerPassword: "PasswordSegura123!",
          registerManualPayment: true,
        }),
      },
    );

    const createRes = await postSuperAdminFarms(createReq);
    expect(createRes.status).toBe(201);
    const createdBody = await createRes.json();
    expect(createdBody.ok).toBe(true);
    expect(createdBody.farm.name).toContain("Hacienda Avícola El Sol");
    expect(createdBody.farm.scale).toBe("MEDIANO");
    expect(createdBody.farm.municipality).toBe("Fómeque, Cundinamarca");
    expect(createdBody.owner.username).toBe(ownerUsername);
    expect(createdBody.subscription.planCode).toBe("MEDIANO_MENSUAL");
    expect(createdBody.subscription.maxUsers).toBe(15);

    const newFarmId = createdBody.farm.id as string;
    createdFarmIds.push(newFarmId);

    // 2. Consultar inventario global (GET)
    const listReq = new NextRequest("http://localhost:3000/api/superadmin/granjas");
    const listRes = await getSuperAdminFarms(listReq);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.summary.totalFarms).toBeGreaterThanOrEqual(2);
    const foundFarm = listBody.farms.find(
      (f: { id: string }) => f.id === newFarmId,
    );
    expect(foundFarm).toBeDefined();
    expect(foundFarm.municipality).toBe("Fómeque, Cundinamarca");
    expect(foundFarm.scale).toBe("MEDIANO");
    expect(foundFarm.billing.approvedPaymentsCop).toBe(149000);

    // 3. Actualizar plan a ANUAL_20, extender +60 días y ajustar maxUsers a 20 (PATCH)
    const patchReq = new NextRequest(
      "http://localhost:3000/api/superadmin/granjas",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmId: newFarmId,
          planCode: "ANUAL_20",
          status: "active",
          maxUsers: 20,
          extendDays: 60,
          municipality: "Cáqueza, Cundinamarca",
          registerManualPayment: true,
          amountCop: 210000,
          paymentMethod: "transferencia",
        }),
      },
    );

    const patchRes = await patchSuperAdminFarms(patchReq);
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.ok).toBe(true);
    expect(patchBody.subscription.planCode).toBe("ANUAL_20");
    expect(patchBody.subscription.maxUsers).toBe(20);
    expect(patchBody.subscription.daysRemaining).toBeGreaterThanOrEqual(85);

    // 4. Cambiar de contexto activo a la nueva granja (Modo Soporte)
    const switchReq = new NextRequest(
      "http://localhost:3000/api/superadmin/granjas",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "switch_context",
          farmId: newFarmId,
        }),
      },
    );
    const switchRes = await patchSuperAdminFarms(switchReq);
    expect(switchRes.status).toBe(200);
    const switchBody = await switchRes.json();
    expect(switchBody.activeFarmId).toBe(newFarmId);
    expect(mockedSessionUser.current?.farmId).toBe(newFarmId);
    // Incluso con farmId apuntando a la granja secundaria, el Super-Admin conserva acceso
    expect(canManagePlatformTenants(mockedSessionUser.current)).toBe(true);
  });
});


import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import { appSettings, catalogos, farms, farmSubscriptions, feedInventory, feedPrograms, sessions, users } from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import { getPlanEntitlements, resolveCommercialPlan } from "@/lib/pricing/entitlements";
import * as authMod from "@/lib/auth";
import { proxy } from "@/proxy";
import { POST as registerFarm } from "@/app/api/auth/register/route";
import {
  GET as listUsers,
  PATCH as patchUser,
  POST as createUser,
} from "@/app/api/configuracion/usuarios/route";

describe("Day 0 Registration (/registro) & Farm User/Role Management", () => {
  const createdFarmIds: string[] = [];

  afterEach(async () => {
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "test-user",
      username: "test",
      name: "Test User",
      role: "admin",
      farmId: "00000000-0000-0000-0000-000000000001",
    });

    for (const farmId of createdFarmIds) {
      await runWithFarmContext(farmId, async () => {
        await db.delete(feedPrograms).where(eq(feedPrograms.farmId, farmId));
        await db.delete(feedInventory).where(eq(feedInventory.farmId, farmId));
        await db.delete(catalogos).where(eq(catalogos.farmId, farmId));
        await db.delete(appSettings).where(eq(appSettings.farmId, farmId));
      });
      await db.delete(sessions).where(eq(sessions.farmId, farmId));
      await db.delete(users).where(eq(users.farmId, farmId));
      await db.delete(farmSubscriptions).where(eq(farmSubscriptions.farmId, farmId));
      await db.delete(farms).where(eq(farms.id, farmId));
    }
    createdFarmIds.length = 0;
  });

  it("permite acceso público a /registro y /api/auth/register en proxy", async () => {
    const reqPage = new NextRequest("http://localhost:3000/registro", {
      headers: { accept: "text/html" },
    });
    const resPage = await proxy(reqPage);
    expect(resPage.headers.get("location")).toBeNull();

    const reqApi = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
    });
    const resApi = await proxy(reqApi);
    expect(resApi.status).toBe(200);
  });

  it("POST /api/auth/register crea farm + propietario + suscripción Gratis de un usuario", async () => {
    const uniqueSuffix = crypto.randomBytes(4).toString("hex");
    const ownerUsername = `owner_${uniqueSuffix}`;

    const regReq = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmName: `Finca Semilla ${uniqueSuffix}`,
        ownerName: "Rosa Elena Rojas",
        username: ownerUsername,
        password: "ClaveSegura123",
        acceptLegal: true,
        qrSource: "afiche-tienda-agro",
        allyCode: "AGRO-BOYACA-01",
      }),
    });

    const regRes = await registerFarm(regReq);
    expect(regRes.status).toBe(201);
    const regBody = await regRes.json();
    expect(regBody.ok).toBe(true);
    expect(regBody.redirectTo).toBe("/inicio?wizard=1");
    expect(regBody.farm.planCode).toBe("FREEMIUM_SEMILLA");
    expect(regBody.user.role).toBe("propietario");
    expect(regRes.cookies.get(authMod.sessionCookieName)?.value).toBeTruthy();

    const farmId = String(regBody.farmId);
    createdFarmIds.push(farmId);

    const [farmRow] = await db.select().from(farms).where(eq(farms.id, farmId));
    expect(farmRow?.qrSource).toBe("afiche-tienda-agro");
    expect(farmRow?.allyCode).toBe("AGRO-BOYACA-01");

    // Cambiar sesión simulada al nuevo propietario para probar CRUD de usuarios con RLS
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: regBody.user.id,
      username: ownerUsername,
      name: "Rosa Elena Rojas",
      role: "propietario",
      farmId,
    });

    // El propietario ocupa la única plaza Gratis; el segundo usuario queda sujeto a un plan con más plazas.
    const addOpReq = new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Pedro Galponero",
        username: `op_${uniqueSuffix}`,
        password: "OperarioClave99",
        role: "operario",
      }),
    });
    const addOpRes = await runWithFarmContext(farmId, () => createUser(addOpReq));
    expect(addOpRes.status).toBe(403);
    const addOpBody = await addOpRes.json();
    expect(addOpBody.code).toBe("USER_LIMIT_REACHED");

    const listRes = await runWithFarmContext(farmId, () =>
      listUsers(new NextRequest("http://localhost:3000/api/configuracion/usuarios")),
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.users).toHaveLength(1);
    expect(listBody.maxUsers).toBe(1);
  });

  it("rechaza emitir el rol admin desde la gestión de usuarios de una granja", async () => {
    const req = new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Intento Admin",
        username: `intento_admin_${crypto.randomBytes(4).toString("hex")}`,
        password: "ClaveSegura123",
        role: "admin",
      }),
    });

    const res = await createUser(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Rol inválido/);
  });

  it("mapea suscripciones históricas activas a Productor, limita plazas y actualiza nombre/rol/clave via PATCH", async () => {
    expect(getPlanEntitlements(resolveCommercialPlan("CICLO_60D", true), 3).maxUserSeats).toBe(3);
    expect(getPlanEntitlements(resolveCommercialPlan("SEMESTRAL_PONEDORA", true), 3).maxUserSeats).toBe(3);
    expect(getPlanEntitlements(resolveCommercialPlan("ANUAL_20", true), 5).maxUserSeats).toBe(5);
    expect(getPlanEntitlements(resolveCommercialPlan("MEDIANO_MENSUAL", true), 15).maxUserSeats).toBe(15);
    expect(getPlanEntitlements(resolveCommercialPlan("COMERCIAL_MEDIANO", true), 15).maxUserSeats).toBe(15);
    expect(getPlanEntitlements(resolveCommercialPlan("FREEMIUM_SEMILLA", false)).maxUserSeats).toBe(1);

    const uniqueSuffix = `${Date.now()}_${crypto.randomBytes(2).toString("hex")}`;
    const ownerUsername = `mediano_${uniqueSuffix}`;
    const regReq = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmName: `Avícola Mediana ${uniqueSuffix}`,
        municipality: "Tunja",
        ownerName: "Carlos Alberto Pérez",
        username: ownerUsername,
        password: "ClaveMediana2026!",
        acceptLegal: true,
      }),
    });
    const regRes = await registerFarm(regReq);
    expect(regRes.status).toBe(201);
    const regBody = await regRes.json();
    const farmId = String(regBody.farmId);
    createdFarmIds.push(farmId);

    // Simular una suscripción histórica pagada y activa con 15 plazas de equipo.
    await db
      .update(farmSubscriptions)
      .set({ planCode: "MEDIANO_MENSUAL", status: "active", maxUsers: 15 })
      .where(eq(farmSubscriptions.farmId, farmId));

    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: regBody.user.id,
      username: ownerUsername,
      name: "Carlos Alberto Pérez",
      role: "propietario",
      farmId,
    });

    // Crear usuario 2 (operario) y usuario 3 (veterinario) -> permitidos por MEDIANO_MENSUAL
    const u2Res = await runWithFarmContext(farmId, () =>
      createUser(
        new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Operario Galpón 1",
            username: `op1_${uniqueSuffix}`,
            password: "ClaveOp1_2026",
            role: "operario",
          }),
        }),
      ),
    );
    expect(u2Res.status).toBe(201);
    const u2Body = await u2Res.json();

    const u3Res = await runWithFarmContext(farmId, () =>
      createUser(
        new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Dra. Lucía Vet",
            username: `vet_${uniqueSuffix}`,
            password: "ClaveVet_2026",
            role: "veterinario",
          }),
        }),
      ),
    );
    expect(u3Res.status).toBe(201);

    // Rechazar contraseña corta en PATCH
    const badPatchRes = await runWithFarmContext(farmId, () =>
      patchUser(
        new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: u2Body.user.id,
            name: "Operario Actualizado",
            password: "123",
          }),
        }),
      ),
    );
    expect(badPatchRes.status).toBe(400);

    // Actualizar nombre, rol y contraseña válida en PATCH
    const okPatchRes = await runWithFarmContext(farmId, () =>
      patchUser(
        new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: u2Body.user.id,
            name: "Operario Líder Galpón 1",
            role: "gerente",
            password: "NuevaClaveSegura99",
          }),
        }),
      ),
    );
    expect(okPatchRes.status).toBe(200);
    const okPatchBody = await okPatchRes.json();
    expect(okPatchBody.user.name).toBe("Operario Líder Galpón 1");
    expect(okPatchBody.user.role).toBe("gerente");

    const listRes = await runWithFarmContext(farmId, () =>
      listUsers(new NextRequest("http://localhost:3000/api/configuracion/usuarios")),
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.users).toHaveLength(3);
    expect(listBody.maxUsers).toBe(15);
  });
});


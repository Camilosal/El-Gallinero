import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import crypto from "node:crypto";
import { db } from "@/db";
import { farms, farmSubscriptions, sessions, users } from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import * as authMod from "@/lib/auth";
import { proxy } from "@/proxy";
import { POST as registerFarm } from "@/app/api/auth/register/route";
import {
  GET as listUsers,
  PATCH as patchUser,
  POST as createUser,
  resolveMaxUsersFromPlan,
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

  it("POST /api/auth/register crea farm + propietario + suscripcion Freemium y permite hasta 2 usuarios", async () => {
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
        qrSource: "afiche-tienda-agro",
        allyCode: "AGRO-BOYACA-01",
      }),
    });

    const regRes = await registerFarm(regReq);
    expect(regRes.status).toBe(201);
    const regBody = await regRes.json();
    expect(regBody.ok).toBe(true);
    expect(regBody.redirectTo).toBe("/dashboard?wizard=1");
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

    // Crear 2º usuario (operario) -> permitido (tope = 2 en FREEMIUM_SEMILLA)
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
    expect(addOpRes.status).toBe(201);

    // Intentar 3º usuario -> bloqueado con USER_LIMIT_REACHED
    const addThirdReq = new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Tercer Usuario",
        username: `extra_${uniqueSuffix}`,
        password: "ExtraClave99",
        role: "veterinario",
      }),
    });
    const addThirdRes = await runWithFarmContext(farmId, () => createUser(addThirdReq));
    expect(addThirdRes.status).toBe(403);
    const addThirdBody = await addThirdRes.json();
    expect(addThirdBody.code).toBe("USER_LIMIT_REACHED");

    const listRes = await runWithFarmContext(farmId, () =>
      listUsers(new NextRequest("http://localhost:3000/api/configuracion/usuarios")),
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.users).toHaveLength(2);
    expect(listBody.maxUsers).toBe(2);
  });

  it("resuelve cupos de PLAN_CATALOG (MEDIANO_MENSUAL=15), permite >2 usuarios y actualiza nombre/rol/clave via PATCH", async () => {
    expect(resolveMaxUsersFromPlan("CICLO_60D", null)).toBe(3);
    expect(resolveMaxUsersFromPlan("SEMESTRAL_PONEDORA", null)).toBe(3);
    expect(resolveMaxUsersFromPlan("ANUAL_20", null)).toBe(5);
    expect(resolveMaxUsersFromPlan("MEDIANO_MENSUAL", null)).toBe(15);
    expect(resolveMaxUsersFromPlan("COMERCIAL_MEDIANO", null)).toBe(15);
    expect(resolveMaxUsersFromPlan("FREEMIUM_SEMILLA", null)).toBe(2);

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
      }),
    });
    const regRes = await registerFarm(regReq);
    expect(regRes.status).toBe(201);
    const regBody = await regRes.json();
    const farmId = String(regBody.farmId);
    createdFarmIds.push(farmId);

    // Actualizar suscripción de prueba a MEDIANO_MENSUAL (15 usuarios)
    await db
      .update(farmSubscriptions)
      .set({ planCode: "MEDIANO_MENSUAL", maxUsers: 15 })
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


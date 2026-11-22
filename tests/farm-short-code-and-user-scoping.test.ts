import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  appSettings,
  catalogos,
  farmLocations,
  farms,
  farmSubscriptions,
  feedInventory,
  feedPrograms,
  sensorReadings,
  sessions,
  users,
} from "@/db/schema";
import { runWithFarmContext } from "@/db/tenant-context";
import * as authMod from "@/lib/auth";
import {
  computeFarmCodeCheckChar,
  describeFarmCodeError,
  FARM_CODE_ALPHABET,
  FARM_CODE_REGEX,
  generateFarmCodeCandidate,
  isValidFarmCode,
  normalizeFarmCode,
} from "@/lib/farm-code";
import { verifyRenewalFarmId } from "@/lib/pricing/renewal-farm";
import { getFarmSubscriptionStatus } from "@/lib/subscription";
import { proxy } from "@/proxy";
import { POST as registerFarm } from "@/app/api/auth/register/route";
import { POST as loginUser } from "@/app/api/auth/login/route";
import { POST as recoverAccess } from "@/app/api/auth/recover/route";
import { GET as getAuthMe } from "@/app/api/auth/me/route";
import { POST as createFarmUser } from "@/app/api/configuracion/usuarios/route";
import { POST as rotateIotToken, GET as getIotTokenStatus } from "@/app/api/operaciones/sensores/token/route";
import { GET as getSensorReadings, POST as postSensorReading } from "@/app/api/operaciones/sensores/route";
import { loadCompleteFarmBackup } from "@/lib/export/datasets";

describe("Código Corto Alfanumérico de Granja (Mod-31), Usuarios Multi-Finca e IoT", () => {
  const createdFarmIds: string[] = [];

  afterEach(async () => {
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "test-user",
      username: "test",
      name: "Test User",
      role: "admin",
      farmId: "00000000-0000-0000-0000-000000000001",
    });

    for (const farmId of createdFarmIds.splice(0)) {
      await runWithFarmContext(farmId, async () => {
        await db.delete(sensorReadings).where(eq(sensorReadings.farmId, farmId));
        await db.delete(farmLocations).where(eq(farmLocations.farmId, farmId));
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
  });

  it("genera códigos Mod-31 de 6 caracteres sin 0/O/1/I/L y detecta sustituciones o transposiciones", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateFarmCodeCandidate();
      expect(code).toMatch(FARM_CODE_REGEX);
      expect(code).not.toMatch(/[01ILO]/);
      expect(isValidFarmCode(code)).toBe(true);
    }

    const sample = generateFarmCodeCandidate();
    const formatted = ` ${sample.slice(0, 3).toLowerCase()}-${sample.slice(3).toLowerCase()} `;
    expect(normalizeFarmCode(formatted)).toBe(sample);
    expect(isValidFarmCode(formatted)).toBe(true);

    // Mutar un solo carácter en cualquier posición debe invalidar el Mod-31
    for (let pos = 0; pos < sample.length; pos++) {
      const replacement = FARM_CODE_ALPHABET.split("").find((ch) => ch !== sample[pos])!;
      const mutated = sample.slice(0, pos) + replacement + sample.slice(pos + 1);
      expect(isValidFarmCode(mutated)).toBe(false);
    }

    // Transponer dos caracteres adyacentes distintos también debe invalidar el Mod-31
    for (let pos = 0; pos < sample.length - 1; pos++) {
      if (sample[pos] === sample[pos + 1]) continue;
      const transposed =
        sample.slice(0, pos) + sample[pos + 1] + sample[pos] + sample.slice(pos + 2);
      expect(isValidFarmCode(transposed)).toBe(false);
    }

    expect(describeFarmCodeError("7K4M20")).toMatch(/no usa 0, O, 1, I ni L/);
    expect(computeFarmCodeCheckChar("7K4M2")).toBeTruthy();
  });

  it("permite el mismo username en distintas granjas, exige código en colisión y aísla login/recover", async () => {
    const suffix = crypto.randomBytes(4).toString("hex");
    const sharedUsername = `carlos_${suffix}`;
    const passA = "ClaveFincaA_2026!";
    const passB = "ClaveFincaB_2026!";

    const regARes = await registerFarm(
      new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `10.10.1.${Math.floor(Math.random() * 200) + 1}`,
        },
        body: JSON.stringify({
          farmName: `Finca Alfa ${suffix}`,
          ownerName: "Carlos Alfa",
          username: sharedUsername,
          password: passA,
          acceptLegal: true,
        }),
      }),
    );
    expect(regARes.status).toBe(201);
    const bodyA = await regARes.json();
    createdFarmIds.push(bodyA.farmId);

    const regBRes = await registerFarm(
      new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `10.10.2.${Math.floor(Math.random() * 200) + 1}`,
        },
        body: JSON.stringify({
          farmName: `Finca Beta ${suffix}`,
          ownerName: "Carlos Beta",
          username: sharedUsername.toUpperCase(),
          password: passB,
          acceptLegal: true,
        }),
      }),
    );
    expect(regBRes.status).toBe(201);
    const bodyB = await regBRes.json();
    createdFarmIds.push(bodyB.farmId);

    expect(isValidFarmCode(bodyA.farmCode)).toBe(true);
    expect(isValidFarmCode(bodyB.farmCode)).toBe(true);
    expect(bodyA.farmCode).not.toBe(bodyB.farmCode);

    // Ampliar plazas en A y B para probar usuarios secundarios con mismo username
    await db
      .update(farmSubscriptions)
      .set({ planCode: "MEDIANO_MENSUAL", status: "active", maxUsers: 5 })
      .where(eq(farmSubscriptions.farmId, bodyA.farmId));
    await db
      .update(farmSubscriptions)
      .set({ planCode: "MEDIANO_MENSUAL", status: "active", maxUsers: 5 })
      .where(eq(farmSubscriptions.farmId, bodyB.farmId));

    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: bodyA.user.id,
      username: sharedUsername,
      name: "Carlos Alfa",
      role: "propietario",
      farmId: bodyA.farmId,
    });

    const dupWorkerName = `galponero_${suffix}`;
    const addWorkerARes = await runWithFarmContext(bodyA.farmId, () =>
      createFarmUser(
        new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Operario Alfa",
            username: dupWorkerName,
            password: "WorkerPassA1!",
            role: "operario",
          }),
        }),
      ),
    );
    expect(addWorkerARes.status).toBe(201);

    // Repetir el mismo username DENTRO de la misma Granja A debe dar 409
    const dupSameFarmRes = await runWithFarmContext(bodyA.farmId, () =>
      createFarmUser(
        new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Duplicado Alfa",
            username: dupWorkerName.toUpperCase(),
            password: "WorkerPassA2!",
            role: "operario",
          }),
        }),
      ),
    );
    expect(dupSameFarmRes.status).toBe(409);

    // Crear el mismo username en Granja B SÍ debe permitirse
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: bodyB.user.id,
      username: sharedUsername,
      name: "Carlos Beta",
      role: "propietario",
      farmId: bodyB.farmId,
    });
    const addWorkerBRes = await runWithFarmContext(bodyB.farmId, () =>
      createFarmUser(
        new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Operario Beta",
            username: dupWorkerName,
            password: "WorkerPassB1!",
            role: "operario",
          }),
        }),
      ),
    );
    expect(addWorkerBRes.status).toBe(201);

    // Usuario único en Granja B (solo existe allá): login sin farmCode funciona
    const uniqueOnlyName = `solo_b_${suffix}`;
    await runWithFarmContext(bodyB.farmId, () =>
      createFarmUser(
        new NextRequest("http://localhost:3000/api/configuracion/usuarios", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Único Beta",
            username: uniqueOnlyName,
            password: "SoloBetaPass1!",
            role: "operario",
          }),
        }),
      ),
    );

    const uniqueLoginRes = await loginUser(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: uniqueOnlyName,
          password: "SoloBetaPass1!",
        }),
      }),
    );
    expect(uniqueLoginRes.status).toBe(200);
    const uniqueLoginBody = await uniqueLoginRes.json();
    expect(uniqueLoginBody.farmId).toBe(bodyB.farmId);
    expect(uniqueLoginBody.farmCode).toBe(bodyB.farmCode);

    // Login SIN farmCode cuando el usuario existe en A y B -> debe exigir código (409)
    const ambiguousLoginRes = await loginUser(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: sharedUsername,
          password: passA,
        }),
      }),
    );
    expect(ambiguousLoginRes.status).toBe(409);
    const ambiguousBody = await ambiguousLoginRes.json();
    expect(ambiguousBody.code).toBe("FARM_CODE_REQUIRED");

    // Login con código de Granja A y contraseña de Granja B -> rechazado (401, nunca cruza de tenant)
    const wrongCrossLoginRes = await loginUser(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmCode: bodyA.farmCode,
          username: sharedUsername,
          password: passB,
        }),
      }),
    );
    expect(wrongCrossLoginRes.status).toBe(401);

    // Login con código de Granja A (normalizado con minúsculas/guion) y contraseña de Granja A -> 200 en A
    const validLoginARes = await loginUser(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmCode: `${bodyA.farmCode.slice(0, 3).toLowerCase()}-${bodyA.farmCode.slice(3)}`,
          username: sharedUsername,
          password: passA,
        }),
      }),
    );
    expect(validLoginARes.status).toBe(200);
    const validLoginABody = await validLoginARes.json();
    expect(validLoginABody.farmId).toBe(bodyA.farmId);
    expect(validLoginABody.farmCode).toBe(bodyA.farmCode);

    // Recuperación de acceso sin farmCode sobre usuario duplicado -> 409 FARM_CODE_REQUIRED
    const recoverAmbiguousRes = await recoverAccess(
      new NextRequest("http://localhost:3000/api/auth/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `10.10.3.${Math.floor(Math.random() * 200) + 1}`,
        },
        body: JSON.stringify({
          username: sharedUsername,
          recoveryCode: bodyA.recoveryCode,
          newPassword: "NuevaClaveA_2026!",
        }),
      }),
    );
    expect(recoverAmbiguousRes.status).toBe(409);

    // Recuperación con farmCode de Granja A cambia SOLO clave en Granja A
    const recoverARes = await recoverAccess(
      new NextRequest("http://localhost:3000/api/auth/recover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": `10.10.4.${Math.floor(Math.random() * 200) + 1}`,
        },
        body: JSON.stringify({
          farmCode: bodyA.farmCode,
          username: sharedUsername,
          recoveryCode: bodyA.recoveryCode,
          newPassword: "NuevaClaveA_2026!",
        }),
      }),
    );
    expect(recoverARes.status).toBe(200);

    // Verificar clave intacta en Granja B y actualizada en Granja A
    const loginNewARes = await loginUser(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmCode: bodyA.farmCode,
          username: sharedUsername,
          password: "NuevaClaveA_2026!",
        }),
      }),
    );
    expect(loginNewARes.status).toBe(200);

    const loginIntactBRes = await loginUser(
      new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmCode: bodyB.farmCode,
          username: sharedUsername,
          password: passB,
        }),
      }),
    );
    expect(loginIntactBRes.status).toBe(200);

    // /api/auth/me debe exponer farmCode
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: bodyA.user.id,
      username: sharedUsername,
      name: "Carlos Alfa",
      role: "propietario",
      farmId: bodyA.farmId,
    });
    const meRes = await getAuthMe(new NextRequest("http://localhost:3000/api/auth/me"));
    expect(meRes.status).toBe(200);
    const meBody = await meRes.json();
    expect(meBody.farmCode).toBe(bodyA.farmCode);
  });

  it("redirecciona cámara nativa en /escanear?f=...&qr=... preservando código y destino en /login", async () => {
    const res = await proxy(
      new NextRequest("https://app.iwage.co/escanear?f=7K4M2X&qr=ACT%3Aactivo-1", {
        headers: { accept: "text/html" },
      }),
    );
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toBeTruthy();
    const redirectUrl = new URL(location!);
    expect(redirectUrl.pathname).toBe("/login");
    expect(redirectUrl.searchParams.get("granja")).toBe("7K4M2X");
    expect(redirectUrl.searchParams.get("next")).toBe("/escanear?f=7K4M2X&qr=ACT%3Aactivo-1");
  });

  it("autentica hardware IoT por Granja (x-farm-code + x-sensor-token), verifica renovación y respaldo con code", async () => {
    const farmAId = crypto.randomUUID();
    const farmBId = crypto.randomUUID();
    createdFarmIds.push(farmAId, farmBId);

    const inserted = await db
      .insert(farms)
      .values([
        { id: farmAId, slug: `iot-a-${farmAId.slice(0, 8)}`, name: "Granja IoT A", planCode: "PRODUCTOR" },
        { id: farmBId, slug: `iot-b-${farmBId.slice(0, 8)}`, name: "Granja IoT B", planCode: "PRODUCTOR" },
      ])
      .returning();

    const farmA = inserted.find((f) => f.id === farmAId)!;
    const farmB = inserted.find((f) => f.id === farmBId)!;
    expect(isValidFarmCode(farmA.code)).toBe(true);
    expect(isValidFarmCode(farmB.code)).toBe(true);

    await db.insert(farmSubscriptions).values([
      {
        farmId: farmAId,
        planCode: "PRODUCTOR",
        status: "active",
        maxUsers: 5,
        currentPeriodStart: new Date(Date.now() - 86400_000),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
      },
      {
        farmId: farmBId,
        planCode: "PRODUCTOR",
        status: "active",
        maxUsers: 5,
        currentPeriodStart: new Date(Date.now() - 86400_000),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
      },
    ]);

    // Emitir token IoT para Granja A
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "owner-a",
      username: "owner_a",
      name: "Owner A",
      role: "propietario",
      farmId: farmAId,
    });

    const tokenRes = await runWithFarmContext(farmAId, () =>
      rotateIotToken(
        new NextRequest("http://localhost:3000/api/operaciones/sensores/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rotate" }),
        }),
      ),
    );
    expect(tokenRes.status).toBe(201);
    const tokenBody = await tokenRes.json();
    expect(tokenBody.farmCode).toBe(farmA.code);
    expect(tokenBody.rawToken).toMatch(/^iwg_iot_/);

    const statusRes = await runWithFarmContext(farmAId, () =>
      getIotTokenStatus(new NextRequest("http://localhost:3000/api/operaciones/sensores/token")),
    );
    expect(statusRes.status).toBe(200);
    expect((await statusRes.json()).configured).toBe(true);

    // Enviar lectura usando x-farm-code + x-sensor-token hacia Granja A
    const sensorPostA = await postSensorReading(
      new NextRequest("http://localhost:3000/api/operaciones/sensores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-farm-code": farmA.code,
          "x-sensor-token": tokenBody.rawToken,
        },
        body: JSON.stringify({
          deviceId: "ESP32-GALPON-A",
          temperatureC: 28.4,
          humidityPct: 72,
        }),
      }),
    );
    expect(sensorPostA.status).toBe(201);
    const sensorPostABody = await sensorPostA.json();
    expect(sensorPostABody.farmId).toBe(farmAId);
    expect(sensorPostABody.farmCode).toBe(farmA.code);

    // Intentar usar el token de A contra el código de B debe fallar con 401
    const crossSensorRes = await postSensorReading(
      new NextRequest("http://localhost:3000/api/operaciones/sensores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-farm-code": farmB.code,
          "x-sensor-token": tokenBody.rawToken,
        },
        body: JSON.stringify({
          deviceId: "ESP32-SPOOF",
          temperatureC: 24,
        }),
      }),
    );
    expect(crossSensorRes.status).toBe(401);

    // Granja B NO ve la lectura de Granja A
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "owner-b",
      username: "owner_b",
      name: "Owner B",
      role: "propietario",
      farmId: farmBId,
    });
    const listSensorsB = await runWithFarmContext(farmBId, () =>
      getSensorReadings(new NextRequest("http://localhost:3000/api/operaciones/sensores")),
    );
    expect(listSensorsB.status).toBe(200);
    const listSensorsBBody = await listSensorsB.json();
    expect(listSensorsBBody.readings).toHaveLength(0);

    // Verificar renovación usando Código Corto (y bloqueo cruzado entre fincas)
    await runWithFarmContext(farmAId, async () => {
      const verified = await verifyRenewalFarmId(farmA.code, "producer");
      expect(verified.id).toBe(farmAId);
      expect(verified.code).toBe(farmA.code);

      const subStatus = await getFarmSubscriptionStatus(farmAId);
      expect(subStatus.farmCode).toBe(farmA.code);

      await expect(verifyRenewalFarmId(farmB.code, "producer")).rejects.toMatchObject({
        statusCode: 404,
      });

      const backup = await loadCompleteFarmBackup();
      expect((backup as { farm?: { code?: string } }).farm?.code).toBe(farmA.code);
    });
  });
});

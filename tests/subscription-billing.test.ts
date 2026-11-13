import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto, { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { runWithFarmContext } from "@/db/tenant-context";
import {
  billingPayments,
  broilerBatches,
  farmLocations,
  farmSubscriptions,
  farms,
  users,
} from "@/db/schema";
import { GET as billingGET, POST as checkoutPOST } from "@/app/api/billing/checkout/route";
import { POST as webhookPOST } from "@/app/api/billing/webhook/route";
import { GET as lotesGET, POST as pollosPOST } from "@/app/api/produccion/pollos/route";
import { POST as adquisicionesPOST } from "@/app/api/produccion/adquisiciones/route";
import { POST as ventaAvesPOST } from "@/app/api/finanzas/finanzas/ventas-aves/route";
import * as authMod from "@/lib/auth";
import { mockRequest, parseJson } from "./helpers";

describe("Suscripción por Ciclo Productivo y Pagos Wompi Nequi/Daviplata/PSE (Task B4)", () => {
  const farmId = randomUUID();
  const userId = randomUUID();
  let locationId = "";

  beforeAll(async () => {
    const expiredAt = new Date(Date.now() - 3 * 86400000);
    await db.insert(farms).values({
      id: farmId,
      slug: `test-b4-${farmId.slice(0, 8)}`,
      name: "Granja B4 Billing",
      deploymentMode: "saas",
      planCode: "FREEMIUM_SEMILLA",
      trialEndsAt: expiredAt,
    });

    await db.insert(farmSubscriptions).values({
      farmId,
      planCode: "FREEMIUM_SEMILLA",
      status: "expired",
      maxActiveBatches: 1,
      maxUsers: 2,
      currentPeriodStart: new Date(Date.now() - 35 * 86400000),
      currentPeriodEnd: expiredAt,
    });

    await runWithFarmContext(farmId, async () => {
      await db.insert(users).values({
        id: userId,
        farmId,
        username: `b4_${userId.slice(0, 8)}`,
        passwordHash: "hash",
        name: "Productor B4",
        role: "propietario",
      });

      const [loc] = await db
        .insert(farmLocations)
        .values({
          farmId,
          code: `GALP-B4-${farmId.slice(0, 6)}`,
          name: "Galpón B4 Engorde",
          type: "galpon",
        })
        .returning();
      locationId = loc.id;
    });

    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: userId,
      farmId,
      username: `b4_${userId.slice(0, 8)}`,
      name: "Productor B4",
      role: "propietario",
    });
  });

  afterAll(async () => {
    await db.delete(farms).where(eq(farms.id, farmId));
    vi.mocked(authMod.getSessionUser).mockResolvedValue({
      id: "test-user",
      farmId: "00000000-0000-0000-0000-000000000001",
      username: "test",
      name: "Test User",
      role: "admin",
    });
  });

  it("permite 1er lote activo, consulta y venta/cierre post-trial, pero bloquea 2do lote activo con 402 UPGRADE_REQUIRED", async () => {
    // 1. Primer lote en Freemium post-trial: permitido
    const firstRes = await adquisicionesPOST(
      mockRequest("http://localhost/api/produccion/adquisiciones", {
        method: "POST",
        body: {
          date: "2026-11-10",
          acquisitionType: "compra",
          birdType: "lote_pollos",
          quantity: 20,
          unitCost: 2800,
          breed: "Ross 308",
          destinationLocationId: locationId,
        },
      }),
    );
    expect([200, 201]).toContain(firstRes.status);
    const firstJson = (await parseJson(firstRes)) as { createdBirdIds?: string[] };
    const firstBatchId = firstJson.createdBirdIds?.[0];
    expect(firstBatchId).toBeTruthy();

    // 2. Consulta de lectura sigue abierta sin restricción
    const readRes = await lotesGET(mockRequest("http://localhost/api/produccion/pollos", { method: "GET" }));
    expect(readRes.status).toBe(200);

    // 3. Intentar crear 2do lote simultáneo -> 402 UPGRADE_REQUIRED
    const blockedRes = await adquisicionesPOST(
      mockRequest("http://localhost/api/produccion/adquisiciones", {
        method: "POST",
        body: {
          date: "2026-11-11",
          acquisitionType: "compra",
          birdType: "lote_pollos",
          quantity: 30,
          unitCost: 2900,
          breed: "Ross 308",
          destinationLocationId: locationId,
        },
      }),
    );
    expect(blockedRes.status).toBe(402);
    const blockedJson = (await parseJson(blockedRes)) as { code?: string };
    expect(blockedJson.code).toBe("UPGRADE_REQUIRED");

    const pollosBlocked = await pollosPOST(
      mockRequest("http://localhost/api/produccion/pollos", { method: "POST", body: {} }),
    );
    expect(pollosBlocked.status).toBe(402);

    // 4. Vender/cerrar el lote actual NUNCA se bloquea en Freemium
    const closeSaleRes = await ventaAvesPOST(
      mockRequest("http://localhost/api/finanzas/finanzas/ventas-aves", {
        method: "POST",
        body: {
          date: "2026-11-13",
          birdType: "lote_pollos",
          batchId: firstBatchId,
          quantity: 20,
          priceMode: "por_ave",
          pricePerUnit: 18000,
          buyer: "Cliente B4",
        },
      }),
    );
    expect([200, 201]).toContain(closeSaleRes.status);

    // Confirmar promptPostHarvestRenewal activo
    const billingRes = await billingGET(mockRequest("http://localhost/api/billing/checkout", { method: "GET" }));
    expect(billingRes.status).toBe(200);
    const billingData = (await parseJson(billingRes)) as {
      subscription: { promptPostHarvestRenewal: boolean; isPostTrialFreemium: boolean };
    };
    expect(billingData.subscription.isPostTrialFreemium).toBe(true);
    expect(billingData.subscription.promptPostHarvestRenewal).toBe(true);
  });

  it("checkout Nequi/Daviplata/PSE + webhook Wompi válido activa ciclo 60d idempotente y desbloquea 2+ lotes", async () => {
    // Asegurar que hay 1 lote activo para probar desbloqueo real
    await runWithFarmContext(farmId, async () => {
      await db.insert(broilerBatches).values({
        farmId,
        code: `L-ACTIVO-B4-${farmId.slice(0, 4)}`,
        species: "pollo",
        purpose: "engorde_carne",
        breed: "Ross 308",
        startDate: "2026-11-12",
        initialQuantity: 25,
        currentQuantity: 25,
        locationId,
        status: "activo",
      });
    });

    const checkoutRes = await checkoutPOST(
      mockRequest("http://localhost/api/billing/checkout", {
        method: "POST",
        body: { planCode: "CICLO_60D", method: "nequi" },
      }),
    );
    expect(checkoutRes.status).toBe(201);
    const checkoutJson = (await parseJson(checkoutRes)) as {
      checkout: {
        externalReference: string;
        amountCop: number;
        amountInCents: number;
        integritySignature: string;
      };
    };

    expect(checkoutJson.checkout.amountCop).toBe(45000);
    expect(checkoutJson.checkout.amountInCents).toBe(4500000);
    expect(checkoutJson.checkout.integritySignature).toMatch(/^[a-f0-9]{64}$/);

    // Webhook inválido rechazado con 401
    const badWebhook = await webhookPOST(
      mockRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        body: {
          timestamp: 1731500000,
          data: {
            transaction: {
              id: "wompi-tx-bad",
              reference: checkoutJson.checkout.externalReference,
              status: "APPROVED",
              amount_in_cents: 4500000,
            },
          },
          signature: {
            properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
            checksum: "0".repeat(64),
          },
        },
      }),
    );
    expect(badWebhook.status).toBe(401);

    // Webhook válido firmado con eventsSecret
    const eventsSecret = process.env.WOMPI_EVENTS_SECRET || "test_events_iwage_default_secret";
    const ts = 1731500123;
    const txId = "wompi-tx-nequi-001";
    const checksum = crypto
      .createHash("sha256")
      .update(`${txId}APPROVED4500000${ts}${eventsSecret}`)
      .digest("hex");

    const okWebhookPayload = {
      timestamp: ts,
      data: {
        transaction: {
          id: txId,
          reference: checkoutJson.checkout.externalReference,
          status: "APPROVED",
          amount_in_cents: 4500000,
        },
      },
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
        checksum,
      },
    };

    const okWebhook1 = await webhookPOST(
      mockRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        body: okWebhookPayload,
      }),
    );
    expect(okWebhook1.status).toBe(200);
    const okJson1 = (await parseJson(okWebhook1)) as {
      ok: boolean;
      idempotent: boolean;
      subscription: { status: string; planCode: string; currentPeriodEnd: string };
    };
    expect(okJson1.ok).toBe(true);
    expect(okJson1.idempotent).toBe(false);
    expect(okJson1.subscription.status).toBe("active");
    expect(okJson1.subscription.planCode).toBe("CICLO_60D");

    const firstPeriodEnd = new Date(okJson1.subscription.currentPeriodEnd).getTime();
    const diffDays = (firstPeriodEnd - Date.now()) / 86400000;
    expect(diffDays).toBeGreaterThan(58);
    expect(diffDays).toBeLessThanOrEqual(61);

    // Reenvío del mismo webhook es idempotente
    const okWebhook2 = await webhookPOST(
      mockRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        body: okWebhookPayload,
      }),
    );
    expect(okWebhook2.status).toBe(200);
    const okJson2 = (await parseJson(okWebhook2)) as {
      idempotent: boolean;
      subscription: { currentPeriodEnd: string };
    };
    expect(okJson2.idempotent).toBe(true);
    expect(okJson2.subscription.currentPeriodEnd).toBe(okJson1.subscription.currentPeriodEnd);

    // Ahora SÍ permite abrir un 2do lote activo simultáneo
    const unlockedRes = await adquisicionesPOST(
      mockRequest("http://localhost/api/produccion/adquisiciones", {
        method: "POST",
        body: {
          date: "2026-11-13",
          acquisitionType: "compra",
          birdType: "lote_pollos",
          quantity: 40,
          unitCost: 2950,
          breed: "Ross 308",
          destinationLocationId: locationId,
        },
      }),
    );
    expect([200, 201]).toContain(unlockedRes.status);

    const [payRow] = await db
      .select()
      .from(billingPayments)
      .where(eq(billingPayments.externalReference, checkoutJson.checkout.externalReference))
      .limit(1);
    expect(payRow?.status).toBe("approved");
  });
});


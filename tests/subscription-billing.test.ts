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

    // /api/produccion/pollos redirige altas a /api/produccion/adquisiciones con 409
    const pollosRedirect = await pollosPOST(
      mockRequest("http://localhost/api/produccion/pollos", { method: "POST", body: {} }),
    );
    expect(pollosRedirect.status).toBe(409);

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

  it("checkout Productor + webhook Wompi válido activa suscripción idempotente y desbloquea 2+ lotes", async () => {
    const prevEnv = {
      WOMPI_ENVIRONMENT: process.env.WOMPI_ENVIRONMENT,
      WOMPI_PUBLIC_KEY: process.env.WOMPI_PUBLIC_KEY,
      WOMPI_INTEGRITY_SECRET: process.env.WOMPI_INTEGRITY_SECRET,
      WOMPI_EVENTS_SECRET: process.env.WOMPI_EVENTS_SECRET,
      WOMPI_CHECKOUT_URL: process.env.WOMPI_CHECKOUT_URL,
    };
    const eventsSecret = "test_events_iwage_default_secret";
    process.env.WOMPI_ENVIRONMENT = "sandbox";
    process.env.WOMPI_PUBLIC_KEY = "pub_test_subscription_suite";
    process.env.WOMPI_INTEGRITY_SECRET = "integrity-test-subscription-suite";
    process.env.WOMPI_EVENTS_SECRET = eventsSecret;
    process.env.WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";

    try {
      const { getPublicPricingOffer, createPricingQuote } = await import("@/lib/pricing/quote");
      const offer = getPublicPricingOffer();
      const expectedQuote = createPricingQuote({
        segment: "producer",
        users: 1,
        months: 3,
        renewal: false,
        locations: 1,
        areasPerLocation: 1,
        extraPlates: 0,
        extraTrainingPackages: 0,
      });

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
          body: {
            segment: "producer",
            users: 1,
            months: 3,
            renewal: false,
            locations: 1,
            areasPerLocation: 1,
            acceptedTerms: true,
            acceptedPolicyVersion: offer.policyVersion,
          },
        }),
      );
      expect(checkoutRes.status).toBe(200);
      const checkoutJson = (await parseJson(checkoutRes)) as {
        redirectUrl: string;
        reference: string;
      };
      expect(checkoutJson.reference).toMatch(/^IWG-/);
      const redirect = new URL(checkoutJson.redirectUrl);
      expect(redirect.origin).toBe("https://checkout.wompi.co");
      const amountInCents = expectedQuote.totalBeforeLogisticsAndTaxCop * 100;
      expect(redirect.searchParams.get("amount-in-cents")).toBe(String(amountInCents));
      expect(redirect.searchParams.get("signature:integrity")).toMatch(/^[a-f0-9]{64}$/);

      // Webhook inválido rechazado con 401
      const badWebhook = await webhookPOST(
        mockRequest("http://localhost/api/billing/webhook", {
          method: "POST",
          body: {
            timestamp: 1731500000,
            data: {
              transaction: {
                id: "wompi-tx-bad",
                reference: checkoutJson.reference,
                status: "APPROVED",
                amount_in_cents: amountInCents,
                currency: "COP",
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
      const ts = 1731500123;
      const txId = "wompi-tx-nequi-001";
      const checksum = crypto
        .createHash("sha256")
        .update(`${txId}APPROVED${amountInCents}${ts}${eventsSecret}`)
        .digest("hex");

      const okWebhookPayload = {
        timestamp: ts,
        data: {
          transaction: {
            id: txId,
            reference: checkoutJson.reference,
            status: "APPROVED",
            amount_in_cents: amountInCents,
            currency: "COP",
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
      expect(okJson1.subscription.planCode).toBe("PRODUCTOR");

      const firstPeriodEnd = new Date(okJson1.subscription.currentPeriodEnd).getTime();
      const diffDays = (firstPeriodEnd - Date.now()) / 86400000;
      expect(diffDays).toBeGreaterThan(85);
      expect(diffDays).toBeLessThanOrEqual(95);

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
        .where(eq(billingPayments.externalReference, checkoutJson.reference))
        .limit(1);
      expect(payRow?.status).toBe("approved");
    } finally {
      for (const [k, v] of Object.entries(prevEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});


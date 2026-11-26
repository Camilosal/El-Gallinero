import { updateSettings } from "@/lib/settings";
import masterReferences from "@/lib/configuration/master-references.json";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import crypto, { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { and, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { Pool } from "pg";
import { db } from "@/db";
import { runWithFarmContext } from "@/db/tenant-context";
import {
  billingPayments,
  broilerBatches,
  farmLocations,
  farmSubscriptionEvents,
  farmSubscriptions,
  farms,
  users,
} from "@/db/schema";
import { GET as billingGET, POST as checkoutPOST } from "@/app/api/billing/checkout/route";
import { GET as billingHistoryGET } from "@/app/api/billing/history/route";
import { POST as reservationsResultPOST } from "@/app/api/billing/reservas/route";
import { POST as webhookPOST } from "@/app/api/billing/webhook/route";
import { GET as lotesGET, POST as pollosPOST } from "@/app/api/produccion/pollos/route";
import { POST as adquisicionesPOST } from "@/app/api/produccion/adquisiciones/route";
import { POST as ventaAvesPOST } from "@/app/api/finanzas/finanzas/ventas-aves/route";
import * as authMod from "@/lib/auth";
import { createPricingQuote } from "@/lib/pricing/quote";
import {
  addCalendarMonths,
  expirePaidSubscriptionForFarm,
  getFarmSubscriptionStatus,
  getSubscriptionApprovalEventType,
  processReservationsPaymentResult,
  processWompiWebhookEvent,
} from "@/lib/subscription";
import { signReservationsServiceRequest } from "@/lib/reservas-payments";
import { mockRequest, parseJson } from "./helpers";

const nativeFetch = globalThis.fetch;

describe("Suscripción por Ciclo Productivo y Pagos Wompi Nequi/Daviplata/PSE (Task B4)", () => {
  const farmId = randomUUID();
  const userId = randomUUID();
  let locationId = "";
  const originalWompiEnvironment = {
    environment: process.env.WOMPI_ENVIRONMENT,
    publicKey: process.env.WOMPI_PUBLIC_KEY,
    integritySecret: process.env.WOMPI_INTEGRITY_SECRET,
    eventsSecret: process.env.WOMPI_EVENTS_SECRET,
  };
  const originalReservationsEnvironment = {
    intentsUrl: process.env.RESERVAS_PAYMENT_INTENTS_URL,
    apiSecret: process.env.RESERVAS_PAYMENT_API_SECRET,
    resultSecret: process.env.RESERVAS_PAYMENT_RESULT_SECRET,
    appUrl: process.env.APP_URL,
  };
  const testEventsSecret = "test-events-secret-for-subscription-suite";
  const testReservationsSecret = "test-reservas-secret-for-subscription-suite";
  let reservationsFetch: ReturnType<typeof vi.fn>;

  it("distingue una primera activación durante prueba de una renovación o reactivación", () => {
    const now = new Date("2026-11-20T12:00:00.000Z");
    expect(getSubscriptionApprovalEventType({
      planCode: "FREEMIUM_SEMILLA",
      status: "trial",
      currentPeriodEnd: new Date("2026-12-20T12:00:00.000Z"),
    }, now)).toBe("subscription_activated");
    expect(getSubscriptionApprovalEventType({
      planCode: "PRODUCTOR",
      status: "active",
      currentPeriodEnd: new Date("2026-12-20T12:00:00.000Z"),
    }, now)).toBe("subscription_renewed");
    expect(getSubscriptionApprovalEventType({
      planCode: "PRODUCTOR",
      status: "expired",
      currentPeriodEnd: new Date("2026-11-19T12:00:00.000Z"),
    }, now)).toBe("subscription_reactivated");
  });

  it("registra el vencimiento una sola vez y conserva los derechos de Gratis", async () => {
    const [originalFarm] = await db.select().from(farms).where(eq(farms.id, farmId)).limit(1);
    const [originalSubscription] = await db.select().from(farmSubscriptions)
      .where(eq(farmSubscriptions.farmId, farmId)).limit(1);
    const expiredAt = new Date(Date.now() - 60_000);

    await runWithFarmContext(farmId, async () => {
      await db.update(farms).set({ planCode: "PRODUCTOR" }).where(eq(farms.id, farmId));
      await db.update(farmSubscriptions).set({
        planCode: "PRODUCTOR",
        status: "active",
        currentPeriodEnd: expiredAt,
      }).where(eq(farmSubscriptions.farmId, farmId));
    });

    try {
      const firstExpiry = await expirePaidSubscriptionForFarm(farmId, new Date());
      const repeatedExpiry = await expirePaidSubscriptionForFarm(farmId, new Date());
      const status = await runWithFarmContext(farmId, () => getFarmSubscriptionStatus(farmId));
      const [subscription] = await runWithFarmContext(farmId, () => db.select().from(farmSubscriptions)
        .where(eq(farmSubscriptions.farmId, farmId)).limit(1));
      const events = await runWithFarmContext(farmId, () => db.select().from(farmSubscriptionEvents)
        .where(eq(farmSubscriptionEvents.farmId, farmId)));

      expect(firstExpiry).toBe(true);
      expect(repeatedExpiry).toBe(false);
      expect(subscription?.status).toBe("expired");
      expect(status.status).toBe("expired");
      expect(status.planCode).toBe("PRODUCTOR");
      expect(status.planKey).toBe("free");
      expect(status.entitlements.maxUserSeats).toBe(1);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        eventType: "subscription_expired",
        source: "subscription_expiry_cron",
        beforeSnapshot: { planCode: "PRODUCTOR", status: "active" },
        afterSnapshot: { planCode: "PRODUCTOR", status: "expired" },
      });
    } finally {
      await runWithFarmContext(farmId, async () => {
        if (originalFarm) await db.update(farms).set({ planCode: originalFarm.planCode }).where(eq(farms.id, farmId));
        if (originalSubscription) {
          await db.update(farmSubscriptions).set({
            planCode: originalSubscription.planCode,
            status: originalSubscription.status,
            currentPeriodEnd: originalSubscription.currentPeriodEnd,
          }).where(eq(farmSubscriptions.farmId, farmId));
        }
      });
    }
  });

  beforeAll(async () => {
    process.env.WOMPI_ENVIRONMENT = "sandbox";
    process.env.WOMPI_PUBLIC_KEY = "pub_test_subscription_suite";
    process.env.WOMPI_INTEGRITY_SECRET = "integrity-test-subscription-suite";
    process.env.WOMPI_EVENTS_SECRET = testEventsSecret;
    process.env.RESERVAS_PAYMENT_INTENTS_URL = "https://reservas.test/api/pagos/intentos";
    process.env.RESERVAS_PAYMENT_API_SECRET = testReservationsSecret;
    process.env.RESERVAS_PAYMENT_RESULT_SECRET = "test-result-secret-for-subscription-suite";
    process.env.APP_URL = "https://app.iwage.co";

    reservationsFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const requestBody = JSON.parse(String(init?.body)) as { reference: string };
      return new Response(JSON.stringify({
        intentId: "reservas-test-intent",
        reference: requestBody.reference,
        status: "pending",
        checkoutUrl: `https://checkout.wompi.co/p/?reference=${encodeURIComponent(requestBody.reference)}`,
      }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", reservationsFetch);

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
      await updateSettings(Object.entries(masterReferences)
        .filter(([key]) => key.startsWith("tax.") || key.startsWith("payroll.") || key === "external.tax_uvt_cop")
        .map(([key, value]) => ({ key, value })), userId);
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
    if (originalWompiEnvironment.environment === undefined) delete process.env.WOMPI_ENVIRONMENT;
    else process.env.WOMPI_ENVIRONMENT = originalWompiEnvironment.environment;
    if (originalWompiEnvironment.publicKey === undefined) delete process.env.WOMPI_PUBLIC_KEY;
    else process.env.WOMPI_PUBLIC_KEY = originalWompiEnvironment.publicKey;
    if (originalWompiEnvironment.integritySecret === undefined) delete process.env.WOMPI_INTEGRITY_SECRET;
    else process.env.WOMPI_INTEGRITY_SECRET = originalWompiEnvironment.integritySecret;
    if (originalWompiEnvironment.eventsSecret === undefined) delete process.env.WOMPI_EVENTS_SECRET;
    else process.env.WOMPI_EVENTS_SECRET = originalWompiEnvironment.eventsSecret;
    if (originalReservationsEnvironment.intentsUrl === undefined) delete process.env.RESERVAS_PAYMENT_INTENTS_URL;
    else process.env.RESERVAS_PAYMENT_INTENTS_URL = originalReservationsEnvironment.intentsUrl;
    if (originalReservationsEnvironment.apiSecret === undefined) delete process.env.RESERVAS_PAYMENT_API_SECRET;
    else process.env.RESERVAS_PAYMENT_API_SECRET = originalReservationsEnvironment.apiSecret;
    if (originalReservationsEnvironment.resultSecret === undefined) delete process.env.RESERVAS_PAYMENT_RESULT_SECRET;
    else process.env.RESERVAS_PAYMENT_RESULT_SECRET = originalReservationsEnvironment.resultSecret;
    if (originalReservationsEnvironment.appUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = originalReservationsEnvironment.appUrl;
    vi.unstubAllGlobals();
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
    expect([200, 201], await firstRes.clone().text()).toContain(firstRes.status);
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
    expect(await parseJson(pollosRedirect)).toMatchObject({
      href: "/produccion/adquisiciones?nuevo=lote_pollos",
    });

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
    expect([200, 201], await closeSaleRes.clone().text()).toContain(closeSaleRes.status);

    // Confirmar promptPostHarvestRenewal activo
    const billingRes = await billingGET(mockRequest("http://localhost/api/billing/checkout", { method: "GET" }));
    expect(billingRes.status).toBe(200);
    const billingData = (await parseJson(billingRes)) as {
      subscription: { promptPostHarvestRenewal: boolean; isPostTrialFreemium: boolean };
    };
    expect(billingData.subscription.isPostTrialFreemium).toBe(true);
    expect(billingData.subscription.promptPostHarvestRenewal).toBe(true);
  });

  it("verifica FarmID y plan vigente para renovar antes de crear el intento", async () => {
    const [originalSubscription] = await db.select().from(farmSubscriptions).where(eq(farmSubscriptions.farmId, farmId)).limit(1);
    const [originalFarm] = await db.select().from(farms).where(eq(farms.id, farmId)).limit(1);
    const callsBefore = reservationsFetch.mock.calls.length;

    try {
      const renewalQuote = createPricingQuote({
        segment: "producer",
        users: 3,
        months: 3,
        renewal: true,
        locations: 1,
        areasPerLocation: 3,
        extraPlates: 0,
        extraTrainingPackages: 0,
      });
      const checkoutPayload = (verifiedFarmId: string) => ({
        segment: "producer",
        users: 3,
        months: 3,
        renewal: true,
        farmId: verifiedFarmId,
        locations: 1,
        areasPerLocation: 3,
        idempotencyKey: randomUUID(),
        acceptedTerms: true,
        acceptedPolicyVersion: renewalQuote.policyVersion,
      });

      const expiredRenewal = await checkoutPOST(
        mockRequest("http://localhost/api/billing/checkout", {
          method: "POST",
          body: checkoutPayload(farmId),
        }),
      );
      expect(expiredRenewal.status).toBe(409);
      expect(await parseJson(expiredRenewal)).toMatchObject({ code: "RENEWAL_SUBSCRIPTION_NOT_ACTIVE" });
      expect(reservationsFetch).toHaveBeenCalledTimes(callsBefore);

      await db.update(farmSubscriptions).set({
        planCode: "PRODUCTOR",
        status: "active",
        maxUsers: 3,
        currentPeriodStart: new Date(Date.now() - 30 * 86400000),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      }).where(eq(farmSubscriptions.farmId, farmId));
      await db.update(farms).set({ planCode: "PRODUCTOR" }).where(eq(farms.id, farmId));

      const otherFarm = await checkoutPOST(
        mockRequest("http://localhost/api/billing/checkout", {
          method: "POST",
          body: checkoutPayload("00000000-0000-0000-0000-000000000001"),
        }),
      );
      expect(otherFarm.status).toBe(404);
      expect(await parseJson(otherFarm)).toMatchObject({ code: "RENEWAL_FARM_NOT_FOUND" });
      expect(reservationsFetch).toHaveBeenCalledTimes(callsBefore);

      const validRenewal = await checkoutPOST(
        mockRequest("http://localhost/api/billing/checkout", {
          method: "POST",
          body: checkoutPayload(farmId),
        }),
      );
      expect(validRenewal.status).toBe(200);
      const validRenewalBody = await parseJson(validRenewal) as { reference: string };
      const [payment] = await db.select().from(billingPayments)
        .where(eq(billingPayments.externalReference, validRenewalBody.reference))
        .limit(1);
      const purchase = payment?.rawPayload?.pricingPurchase as Record<string, unknown> | undefined;
      expect(purchase?.renewalFarm).toMatchObject({ id: farmId, name: "Granja B4 Billing", planName: "Productor" });
      expect(purchase?.quote).toMatchObject({
        renewal: true,
        totalBeforeLogisticsAndTaxCop: renewalQuote.totalBeforeLogisticsAndTaxCop,
      });
      expect((purchase?.quote as { subscription?: Record<string, unknown> } | undefined)?.subscription).toMatchObject({
        loyaltySavingsCop: renewalQuote.subscription.loyaltySavingsCop,
      });
      expect(reservationsFetch).toHaveBeenCalledTimes(callsBefore + 1);
    } finally {
      if (originalSubscription) {
        await db.update(farmSubscriptions).set({
          planCode: originalSubscription.planCode,
          status: originalSubscription.status,
          maxActiveBatches: originalSubscription.maxActiveBatches,
          maxUsers: originalSubscription.maxUsers,
          currentPeriodStart: originalSubscription.currentPeriodStart,
          currentPeriodEnd: originalSubscription.currentPeriodEnd,
        }).where(eq(farmSubscriptions.farmId, farmId));
      }
      if (originalFarm) await db.update(farms).set({ planCode: originalFarm.planCode }).where(eq(farms.id, farmId));
      reservationsFetch.mockClear();
    }
  });

  it("recupera el intento de Reservas cuando se pierde la respuesta del primer POST", async () => {
    const quote = createPricingQuote({
      segment: "producer",
      users: 3,
      months: 3,
      renewal: false,
      locations: 1,
      areasPerLocation: 3,
      extraPlates: 0,
      extraTrainingPackages: 0,
    });
    const idempotencyKey = randomUUID();
    const expectedReference = `IWG-${idempotencyKey}`;
    const expectedCheckoutUrl = `https://checkout.wompi.co/p/?reference=${encodeURIComponent(expectedReference)}`;
    let centralIntent: { idempotencyKey: string; reference: string; checkoutUrl: string } | null = null;
    const lostResponseFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { idempotencyKey: string; reference: string };
      if (!centralIntent) {
        centralIntent = {
          idempotencyKey: body.idempotencyKey,
          reference: body.reference,
          checkoutUrl: expectedCheckoutUrl,
        };
        throw new TypeError("socket closed after Reservas created the intent");
      }

      expect(body.idempotencyKey).toBe(centralIntent.idempotencyKey);
      expect(body.reference).toBe(centralIntent.reference);
      return new Response(JSON.stringify({
        intentId: "reservas-recovered-intent",
        reference: centralIntent.reference,
        status: "pending",
        checkoutUrl: centralIntent.checkoutUrl,
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", lostResponseFetch);

    const payload = {
      segment: "producer",
      users: 3,
      months: 3,
      renewal: false,
      locations: 1,
      areasPerLocation: 3,
      idempotencyKey,
      acceptedTerms: true,
      acceptedPolicyVersion: quote.policyVersion,
    };

    try {
      const lostResponse = await checkoutPOST(
        mockRequest("http://localhost/api/billing/checkout", { method: "POST", body: payload }),
      );
      expect(lostResponse.status).toBe(503);
      const reference = expectedReference;
      const [pendingPayment] = await db.select().from(billingPayments)
        .where(eq(billingPayments.externalReference, reference))
        .limit(1);
      expect(pendingPayment?.status).toBe("pending");
      expect(pendingPayment?.rawPayload?.pricingPurchase).toBeTruthy();

      const retry = await checkoutPOST(
        mockRequest("http://localhost/api/billing/checkout", { method: "POST", body: payload }),
      );
      expect(retry.status).toBe(200);
      expect(await parseJson(retry)).toMatchObject({
        reference,
        redirectUrl: expectedCheckoutUrl,
        status: "pending",
      });
      expect(lostResponseFetch).toHaveBeenCalledTimes(2);
      expect(lostResponseFetch.mock.calls.map(([, init]) => JSON.parse(String(init?.body)).idempotencyKey))
        .toEqual([idempotencyKey, idempotencyKey]);
    } finally {
      vi.stubGlobal("fetch", reservationsFetch);
      reservationsFetch.mockClear();
    }
  });

  it.skipIf(!process.env.RESERVAS_TEST_DATABASE_URL)("recupera por HTTP un pago persistido cuando se corta el socket tras crearlo", async () => {
    const databaseUrl = new URL(process.env.RESERVAS_TEST_DATABASE_URL!);
    const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
    expect(localHosts.has(databaseUrl.hostname)).toBe(true);
    expect(databaseUrl.pathname.toLowerCase()).toContain("test");

    const root = dirname(dirname(fileURLToPath(import.meta.url)));
    const reservasRoot = process.env.RESERVAS_TEST_APP_ROOT?.trim() || join(root, "..", "app_reservas");
    const cacheDir = join(tmpdir(), `iwagranja-reservas-http-e2e-${randomUUID()}`);
    const idempotencyKey = randomUUID();
    const reference = `IWG-${idempotencyKey}`;
    const serviceSecret = `iwagranja-http-e2e-${randomUUID()}`;
    const envKeys = [
      "APP_URL",
      "IWAGRANJA_PAYMENT_API_SECRET",
      "IWAGRANJA_PAYMENT_RESULT_URL",
      "IWAGRANJA_PAYMENT_RESULT_SECRET",
      "IWAGRANJA_RETURN_ORIGINS",
      "NODE_ENV",
      "RESERVAS_PAYMENT_INTENTS_URL",
      "RESERVAS_PAYMENT_API_SECRET",
      "RESERVAS_PAYMENT_RESULT_SECRET",
      "STRAPI_TOKEN",
      "STRAPI_URL",
      "WOMPI_CHECKOUT_URL",
      "WOMPI_ENVIRONMENT",
      "WOMPI_EVENTS_SECRET",
      "WOMPI_INTEGRITY_SECRET",
      "WOMPI_PRIVATE_KEY",
      "WOMPI_PUBLIC_KEY",
    ];
    const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
    let vite: { ssrLoadModule: (id: string) => Promise<any>; close: () => Promise<void> } | undefined;
    let strapiAdapter: ReturnType<typeof createHttpServer> | undefined;
    let proxy: ReturnType<typeof createHttpServer> | undefined;
    let adminPool: Pool | undefined;
    let intentPool: Pool | undefined;
    let schemaName: string | undefined;
    let proxyCalls = 0;
    let firstResponseDropped = false;
    let firstCentralIntent: Record<string, unknown> | undefined;
    const proxyErrors: string[] = [];
    const adapterToken = `strapi-adapter-${randomUUID()}`;

    try {
      process.env.APP_URL = "https://app.iwage.co";
      process.env.IWAGRANJA_PAYMENT_API_SECRET = serviceSecret;
      process.env.IWAGRANJA_PAYMENT_RESULT_URL = "http://127.0.0.1:62554/api/billing/reservas";
      process.env.IWAGRANJA_PAYMENT_RESULT_SECRET = "iwagranja-http-e2e-result-secret";
      process.env.IWAGRANJA_RETURN_ORIGINS = "https://app.iwage.co";
      Reflect.set(process.env, "NODE_ENV", "test");
      process.env.RESERVAS_PAYMENT_API_SECRET = serviceSecret;
      process.env.RESERVAS_PAYMENT_RESULT_SECRET = "iwagranja-http-e2e-result-secret";
      process.env.STRAPI_TOKEN = adapterToken;
      process.env.WOMPI_CHECKOUT_URL = "https://checkout.wompi.co/p/";
      process.env.WOMPI_ENVIRONMENT = "sandbox";
      process.env.WOMPI_EVENTS_SECRET = "iwagranja-http-e2e-wompi-events";
      process.env.WOMPI_INTEGRITY_SECRET = "iwagranja-http-e2e-wompi-integrity";
      process.env.WOMPI_PRIVATE_KEY = "prv_test_iwagranja_http_e2e";
      process.env.WOMPI_PUBLIC_KEY = "pub_test_iwagranja_http_e2e";

      adminPool = new Pool({ connectionString: databaseUrl.toString(), max: 2 });
      schemaName = `iwagranja_intent_test_${process.pid}_${Date.now()}`;
      await adminPool.query(`CREATE SCHEMA "${schemaName}"`);
      intentPool = new Pool({
        connectionString: databaseUrl.toString(),
        options: `-c search_path=${schemaName}`,
        max: 4,
      });
      await intentPool.query(`
        CREATE TABLE pagos (
          id BIGSERIAL PRIMARY KEY,
          document_id TEXT NOT NULL UNIQUE,
          source_app TEXT NOT NULL,
          purpose TEXT NOT NULL,
          idempotency_key TEXT NOT NULL UNIQUE,
          intention_fingerprint TEXT NOT NULL,
          reference_id TEXT NOT NULL UNIQUE,
          return_url TEXT NOT NULL,
          environment TEXT NOT NULL,
          result_delivery_status TEXT NOT NULL,
          result_delivery_attempts INTEGER NOT NULL DEFAULT 0,
          pasarela TEXT NOT NULL,
          estado TEXT NOT NULL,
          monto NUMERIC(14, 2) NOT NULL,
          moneda TEXT NOT NULL,
          datos_transaccion JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const sendAdapterResponse = (status: number, body: Record<string, unknown>, response: import("node:http").ServerResponse) => {
        response.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        response.end(JSON.stringify(body));
      };
      strapiAdapter = createHttpServer(async (incoming, outgoing) => {
        try {
          if (incoming.headers.authorization !== `Bearer ${adapterToken}`) {
            sendAdapterResponse(401, { error: "unauthorized" }, outgoing);
            return;
          }
          const url = new URL(incoming.url ?? "/", "http://127.0.0.1");
          const path = url.pathname.replace(/\/$/, "");
          if (path !== "/api/pagos" && !path.startsWith("/api/pagos/")) {
            sendAdapterResponse(404, { error: "not found" }, outgoing);
            return;
          }

          if (incoming.method === "GET" && path === "/api/pagos") {
            const key = url.searchParams.get("filters[idempotency_key][$eq]");
            const result = await intentPool!.query("SELECT * FROM pagos WHERE idempotency_key = $1 LIMIT 1", [key]);
            sendAdapterResponse(200, {
              data: result.rows.map((row) => ({ ...row, documentId: row.document_id })),
              meta: { pagination: { page: 1, pageSize: 1, total: result.rowCount ?? 0 } },
            }, outgoing);
            return;
          }

          let rawBody = "";
          for await (const chunk of incoming) rawBody += Buffer.from(chunk).toString("utf8");
          const body = rawBody ? JSON.parse(rawBody) as { data?: Record<string, unknown> } : { data: {} };
          const data = body.data ?? {};

          if (incoming.method === "POST" && path === "/api/pagos") {
            const values = [
              randomUUID(), data.source_app, data.purpose, data.idempotency_key,
              data.intention_fingerprint, data.reference_id, data.return_url, data.environment,
              data.result_delivery_status, data.result_delivery_attempts, data.pasarela,
              data.estado, data.monto, data.moneda, JSON.stringify(data.datos_transaccion ?? {}),
            ];
            const created = await intentPool!.query(`
              INSERT INTO pagos (
                document_id, source_app, purpose, idempotency_key, intention_fingerprint,
                reference_id, return_url, environment, result_delivery_status, result_delivery_attempts,
                pasarela, estado, monto, moneda, datos_transaccion
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
              RETURNING *
            `, values);
            const row = created.rows[0];
            sendAdapterResponse(201, { data: { ...row, documentId: row.document_id } }, outgoing);
            return;
          }

          if (incoming.method === "PUT" && path.startsWith("/api/pagos/")) {
            const documentId = decodeURIComponent(path.slice("/api/pagos/".length));
            const updated = await intentPool!.query(`
              UPDATE pagos
              SET estado = $1, pasarela = $2, datos_transaccion = $3::jsonb, updated_at = NOW()
              WHERE document_id = $4
              RETURNING *
            `, [data.estado, data.pasarela, JSON.stringify(data.datos_transaccion ?? {}), documentId]);
            if (!updated.rowCount) {
              sendAdapterResponse(404, { error: "not found" }, outgoing);
              return;
            }
            const row = updated.rows[0];
            sendAdapterResponse(200, { data: { ...row, documentId: row.document_id } }, outgoing);
            return;
          }

          if (incoming.method === "DELETE" && path.startsWith("/api/pagos/")) {
            const documentId = decodeURIComponent(path.slice("/api/pagos/".length));
            await intentPool!.query("DELETE FROM pagos WHERE document_id = $1", [documentId]);
            sendAdapterResponse(200, { data: null }, outgoing);
            return;
          }
          sendAdapterResponse(405, { error: "method not allowed" }, outgoing);
        } catch (error) {
          const candidate = error as { code?: string };
          if (candidate.code === "23505") {
            sendAdapterResponse(409, { error: "duplicate payment intent" }, outgoing);
            return;
          }
          sendAdapterResponse(500, { error: "local payment adapter failed" }, outgoing);
        }
      });
      await new Promise<void>((resolve, reject) => {
        strapiAdapter!.once("error", reject);
        strapiAdapter!.listen(0, "127.0.0.1", () => resolve());
      });
      const adapterAddress = strapiAdapter.address();
      if (!adapterAddress || typeof adapterAddress === "string") throw new Error("No se obtuvo el puerto del adaptador PostgreSQL.");
      process.env.STRAPI_URL = `http://127.0.0.1:${adapterAddress.port}`;

      const { createServer: createViteServer } = await import(pathToFileURL(join(reservasRoot, "node_modules/vite/dist/node/index.js")).href);
      const viteServer = await createViteServer({
        root: reservasRoot,
        cacheDir,
        server: { middlewareMode: true },
        appType: "custom",
        logLevel: "silent",
      });
      vite = viteServer;
      const { POST: reservasIntentPOST } = await viteServer.ssrLoadModule("/src/pages/api/pagos/intentos.ts");

      proxy = createHttpServer(async (incoming, outgoing) => {
        proxyCalls += 1;
        try {
          const chunks: Buffer[] = [];
          for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
          const headers = new Headers();
          for (const name of ["content-type", "x-iwagranja-timestamp", "x-iwagranja-signature"]) {
            const value = incoming.headers[name];
            if (typeof value === "string") headers.set(name, value);
          }
          const upstream = await reservasIntentPOST({
            request: new Request("http://reservas.local/api/pagos/intentos", {
              method: "POST",
              headers,
              body: Buffer.concat(chunks).toString("utf8"),
            }),
          });
          const body = await upstream.text();

          if (!firstResponseDropped) {
            firstResponseDropped = true;
            if (upstream.status !== 201) proxyErrors.push(`primer POST central devolvió ${upstream.status}`);
            try { firstCentralIntent = JSON.parse(body) as Record<string, unknown>; }
            catch { proxyErrors.push("la respuesta central inicial no era JSON válido"); }
            // El endpoint de Reservas ya persistió en PostgreSQL; corta el socket antes de que IwaGranja reciba la respuesta.
            outgoing.destroy();
            return;
          }

          outgoing.writeHead(upstream.status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
          outgoing.end(body);
        } catch (error) {
          proxyErrors.push(error instanceof Error ? error.message : String(error));
          if (!outgoing.destroyed) {
            outgoing.writeHead(500, { "Content-Type": "application/json" });
            outgoing.end(JSON.stringify({ error: "proxy de integración falló" }));
          }
        }
      });
      await new Promise<void>((resolve, reject) => {
        proxy!.once("error", reject);
        proxy!.listen(0, "127.0.0.1", () => resolve());
      });
      const address = proxy.address();
      if (!address || typeof address === "string") throw new Error("No se obtuvo el puerto del proxy local.");
      process.env.RESERVAS_PAYMENT_INTENTS_URL = `http://127.0.0.1:${address.port}/api/pagos/intentos`;
      vi.stubGlobal("fetch", nativeFetch);

      const quote = createPricingQuote({
        segment: "producer",
        users: 3,
        months: 3,
        renewal: false,
        locations: 1,
        areasPerLocation: 3,
        extraPlates: 0,
        extraTrainingPackages: 0,
      });
      const payload = {
        segment: "producer",
        users: 3,
        months: 3,
        renewal: false,
        locations: 1,
        areasPerLocation: 3,
        idempotencyKey,
        acceptedTerms: true,
        acceptedPolicyVersion: quote.policyVersion,
      };

      const firstAttempt = await checkoutPOST(
        mockRequest("http://localhost/api/billing/checkout", { method: "POST", body: payload }),
      );
      expect(firstAttempt.status).toBe(503);
      expect(proxyCalls).toBe(1);
      expect(proxyErrors).toEqual([]);
      expect(firstCentralIntent).toMatchObject({
        reference,
        status: "pending",
        checkoutUrl: expect.stringMatching(/^https:\/\/checkout\.wompi\.co\/p\//),
      });

      const [localPaymentAfterDrop] = await db.select().from(billingPayments)
        .where(eq(billingPayments.externalReference, reference))
        .limit(1);
      expect(localPaymentAfterDrop?.status).toBe("pending");
      expect(localPaymentAfterDrop?.rawPayload?.reservasCheckout).toBeUndefined();

      const retry = await checkoutPOST(
        mockRequest("http://localhost/api/billing/checkout", { method: "POST", body: payload }),
      );
      expect(retry.status).toBe(200);
      expect(await parseJson(retry)).toMatchObject({
        reference,
        status: "pending",
        redirectUrl: firstCentralIntent?.checkoutUrl,
      });
      expect(proxyCalls).toBe(2);

      const [localPaymentAfterRecovery] = await db.select().from(billingPayments)
        .where(eq(billingPayments.externalReference, reference))
        .limit(1);
      const savedCheckout = localPaymentAfterRecovery?.rawPayload?.reservasCheckout as Record<string, unknown> | undefined;
      expect(savedCheckout).toMatchObject({
        intentId: firstCentralIntent?.intentId,
        status: "pending",
        checkoutUrl: firstCentralIntent?.checkoutUrl,
      });

      const centralRows = await intentPool!.query("SELECT * FROM pagos WHERE idempotency_key = $1", [`iwagranja:${idempotencyKey}`]);
      expect(centralRows.rowCount).toBe(1);
      expect(centralRows.rows[0]).toMatchObject({
        document_id: firstCentralIntent?.intentId,
        reference_id: reference,
        estado: "pendiente",
        moneda: "COP",
      });
    } finally {
      vi.stubGlobal("fetch", reservationsFetch);
      reservationsFetch.mockClear();
      await db.delete(billingPayments).where(and(
        eq(billingPayments.externalReference, reference),
        eq(billingPayments.farmId, farmId),
      ));
      if (proxy?.listening) await new Promise<void>((resolve, reject) => proxy!.close((error) => error ? reject(error) : resolve()));
      if (strapiAdapter?.listening) await new Promise<void>((resolve, reject) => strapiAdapter!.close((error) => error ? reject(error) : resolve()));
      if (vite) await vite.close();
      await intentPool?.end();
      if (schemaName && adminPool) await adminPool.query(`DROP SCHEMA "${schemaName}" CASCADE`);
      await adminPool?.end();
      await rm(cacheDir, { recursive: true, force: true });
      for (const key of envKeys) {
        const value = previousEnv.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  }, 25_000);

  it("checkout Productor a 18 meses y webhooks concurrentes activan una sola vez", async () => {
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

    const quote = createPricingQuote({
      segment: "producer",
      users: 3,
      months: 18,
      renewal: false,
      locations: 1,
      areasPerLocation: 3,
      extraPlates: 0,
      extraTrainingPackages: 0,
    });
    const checkoutRes = await checkoutPOST(
      mockRequest("http://localhost/api/billing/checkout", {
        method: "POST",
        body: {
          segment: "producer",
          users: 3,
          months: 18,
          renewal: false,
          locations: 1,
          areasPerLocation: 3,
          idempotencyKey: randomUUID(),
          acceptedTerms: true,
          acceptedPolicyVersion: quote.policyVersion,
        },
      }),
    );
    expect(checkoutRes.status).toBe(200);
    const checkoutJson = (await parseJson(checkoutRes)) as {
      redirectUrl: string;
      reference: string;
    };
    expect(checkoutJson.redirectUrl).toBe(`https://checkout.wompi.co/p/?reference=${encodeURIComponent(checkoutJson.reference)}`);
    expect(checkoutJson.reference).toMatch(/^IWG-/);
    expect(reservationsFetch).toHaveBeenCalledTimes(1);
    const centralRequest = reservationsFetch.mock.calls[0]?.[1] as RequestInit;
    const centralRequestBody = JSON.parse(String(centralRequest.body)) as {
      idempotencyKey: string;
      amountInCents: number;
      currency: string;
      returnUrl: string;
    };
    const centralHeaders = centralRequest.headers as Record<string, string>;
    expect(centralHeaders["x-iwagranja-signature"]).toBe(signReservationsServiceRequest(
      String(centralRequest.body),
      centralHeaders["x-iwagranja-timestamp"],
      testReservationsSecret,
    ));
    expect(centralRequestBody.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(centralRequestBody.amountInCents).toBe(quote.totalBeforeLogisticsAndTaxCop * 100);
    expect(centralRequestBody.currency).toBe("COP");
    expect(new URL(centralRequestBody.returnUrl).origin).toBe("https://app.iwage.co");

    const repeatedCheckoutRes = await checkoutPOST(
      mockRequest("http://localhost/api/billing/checkout", {
        method: "POST",
        body: {
          segment: "producer",
          users: 3,
          months: 18,
          renewal: false,
          locations: 1,
          areasPerLocation: 3,
          idempotencyKey: centralRequestBody.idempotencyKey,
          acceptedTerms: true,
          acceptedPolicyVersion: quote.policyVersion,
        },
      }),
    );
    expect(repeatedCheckoutRes.status).toBe(200);
    expect(await parseJson(repeatedCheckoutRes)).toMatchObject({
      redirectUrl: checkoutJson.redirectUrl,
      reference: checkoutJson.reference,
      recovered: true,
    });
    expect(reservationsFetch).toHaveBeenCalledTimes(1);

    const reusedForDifferentSelection = await checkoutPOST(
      mockRequest("http://localhost/api/billing/checkout", {
        method: "POST",
        body: {
          segment: "producer",
          users: 4,
          months: 18,
          renewal: false,
          locations: 1,
          areasPerLocation: 3,
          idempotencyKey: centralRequestBody.idempotencyKey,
          acceptedTerms: true,
          acceptedPolicyVersion: quote.policyVersion,
        },
      }),
    );
    expect(reusedForDifferentSelection.status).toBe(409);
    expect(reservationsFetch).toHaveBeenCalledTimes(1);

    const [pendingPayment] = await db
      .select()
      .from(billingPayments)
      .where(eq(billingPayments.externalReference, checkoutJson.reference))
      .limit(1);
    expect(pendingPayment?.amountCop).toBe(quote.totalBeforeLogisticsAndTaxCop);

    const paymentLookup = () => billingGET(new NextRequest(
      `http://localhost/api/billing/checkout?reference=${checkoutJson.reference}&status=approved`,
    ));
    vi.mocked(authMod.getSessionUser).mockResolvedValueOnce(null);
    expect((await paymentLookup()).status).toBe(401);
    const billingUser = await authMod.getSessionUser();
    expect(billingUser?.farmId).toBe(farmId);
    vi.mocked(authMod.getSessionUser).mockResolvedValueOnce({ ...billingUser!, farmId: randomUUID() });
    expect((await paymentLookup()).status).toBe(404);
    const paymentBeforeWebhook = await paymentLookup();
    expect(paymentBeforeWebhook.status).toBe(200);
    expect(paymentBeforeWebhook.headers.get("cache-control")).toContain("no-store");
    expect(await parseJson(paymentBeforeWebhook)).toMatchObject({
      payment: { externalReference: checkoutJson.reference, status: "pending", paidAt: null },
    });

    // Webhook inválido rechazado con 401
    const badWebhook = await webhookPOST(
      mockRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        body: {
          timestamp: 1731500000,
          environment: "test",
          data: {
            transaction: {
              id: "wompi-tx-bad",
              reference: checkoutJson.reference,
              status: "APPROVED",
              amount_in_cents: quote.totalBeforeLogisticsAndTaxCop * 100,
              currency: "COP",
            },
          },
          signature: {
            properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents", "transaction.currency"],
            checksum: "0".repeat(64),
          },
        },
      }),
    );
    expect(badWebhook.status).toBe(401);

    // Webhook válido firmado con eventsSecret
    const ts = 1731500123;
    const txId = `wompi-tx-${randomUUID()}`;
    const checksum = crypto
      .createHash("sha256")
      .update(`${txId}APPROVED${quote.totalBeforeLogisticsAndTaxCop * 100}COP${ts}${testEventsSecret}`)
      .digest("hex");

    const okWebhookPayload = {
      timestamp: ts,
      environment: "test",
      data: {
        transaction: {
          id: txId,
          reference: checkoutJson.reference,
          status: "APPROVED",
          amount_in_cents: quote.totalBeforeLogisticsAndTaxCop * 100,
          currency: "COP",
        },
      },
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents", "transaction.currency"],
        checksum,
      },
    };

    const [okWebhook1, okWebhook2] = await Promise.all([
      webhookPOST(mockRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        body: okWebhookPayload,
      })),
      webhookPOST(mockRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        body: okWebhookPayload,
      })),
    ]);
    expect(okWebhook1.status).toBe(200);
    expect(okWebhook2.status).toBe(200);
    const okJson1 = (await parseJson(okWebhook1)) as {
      ok: boolean;
      idempotent: boolean;
      subscription: { status: string; planCode: string; currentPeriodEnd: string };
    };
    const okJson2 = (await parseJson(okWebhook2)) as {
      idempotent: boolean;
      subscription: { status: string; planCode: string; currentPeriodEnd: string };
    };
    expect(okJson1.ok).toBe(true);
    expect(okJson2.idempotent).not.toBe(okJson1.idempotent);
    const activationResult = okJson1.idempotent ? okJson2 : okJson1;
    const replayResult = okJson1.idempotent ? okJson1 : okJson2;
    expect(activationResult.idempotent).toBe(false);
    expect(replayResult.idempotent).toBe(true);
    expect(activationResult.subscription.status).toBe("active");
    expect(activationResult.subscription.planCode).toBe("PRODUCTOR");
    const paymentAfterWebhook = await paymentLookup();
    expect(await parseJson(paymentAfterWebhook)).toMatchObject({
      payment: { externalReference: checkoutJson.reference, status: "approved" },
    });

    const firstPeriodEnd = new Date(activationResult.subscription.currentPeriodEnd).getTime();
    expect(firstPeriodEnd).toBeGreaterThan(Date.now() + 17 * 30 * 86400000);
    expect(firstPeriodEnd).toBeLessThan(Date.now() + 19 * 30 * 86400000);
    expect(okJson2.subscription.currentPeriodEnd).toBe(okJson1.subscription.currentPeriodEnd);

    const [activationEvent] = await runWithFarmContext(farmId, () => db
      .select()
      .from(farmSubscriptionEvents)
      .where(eq(farmSubscriptionEvents.eventKey, `wompi-approved:${pendingPayment!.id}`))
      .limit(1));
    expect(activationEvent).toMatchObject({
      farmId,
      eventType: "subscription_activated",
      actorType: "system",
      source: "wompi_webhook",
      paymentId: pendingPayment!.id,
      externalReference: checkoutJson.reference,
      resultStatus: "applied",
      policyVersion: quote.policyVersion,
      afterSnapshot: {
        planCode: "PRODUCTOR",
        status: "active",
        maxUsers: 3,
      },
    });
    expect(activationEvent?.beforeSnapshot).toBeTruthy();

    const historyResponse = await billingHistoryGET(new NextRequest("http://localhost/api/billing/history"));
    expect(historyResponse.status).toBe(200);
    const historyData = await parseJson(historyResponse) as {
      events: Array<{ id: string; eventType: string; externalReference: string }>;
    };
    expect(historyData.events[0]).toMatchObject({
      id: activationEvent?.id,
      eventType: "subscription_activated",
      externalReference: checkoutJson.reference,
    });
    vi.mocked(authMod.getSessionUser).mockResolvedValueOnce({
      id: userId,
      farmId,
      username: `b4_${userId.slice(0, 8)}`,
      name: "Operario de prueba",
      role: "operario",
    });
    const deniedHistoryResponse = await billingHistoryGET(new NextRequest("http://localhost/api/billing/history"));
    expect(deniedHistoryResponse.status).toBe(403);

    const sendSignedLateStatus = async (status: string) => {
      const eventTimestamp = Math.floor(Date.now() / 1000);
      const eventChecksum = crypto
        .createHash("sha256")
        .update(`${txId}${status}${quote.totalBeforeLogisticsAndTaxCop * 100}COP${eventTimestamp}${testEventsSecret}`)
        .digest("hex");
      return webhookPOST(mockRequest("http://localhost/api/billing/webhook", {
        method: "POST",
        body: {
          timestamp: eventTimestamp,
          environment: "test",
          data: {
            transaction: {
              id: txId,
              reference: checkoutJson.reference,
              status,
              amount_in_cents: quote.totalBeforeLogisticsAndTaxCop * 100,
              currency: "COP",
            },
          },
          signature: {
            properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents", "transaction.currency"],
            checksum: eventChecksum,
          },
        },
      }));
    };

    // Wompi terminal/unknown states delivered after approval must not undo an active subscription.
    const lateVoided = await sendSignedLateStatus("VOIDED");
    const lateRefunded = await sendSignedLateStatus("REFUNDED");
    expect(lateVoided.status).toBe(200);
    expect(await parseJson(lateVoided)).toMatchObject({ ok: true, reviewRequired: true, paymentStatus: "approved" });
    expect(lateRefunded.status).toBe(200);
    expect(await parseJson(lateRefunded)).toMatchObject({ ok: true, reviewRequired: true, paymentStatus: "approved" });
    const [paymentAfterLateStatuses] = await db
      .select()
      .from(billingPayments)
      .where(eq(billingPayments.externalReference, checkoutJson.reference))
      .limit(1);
    const [subscriptionAfterLateStatuses] = await db
      .select()
      .from(farmSubscriptions)
      .where(eq(farmSubscriptions.farmId, farmId))
      .limit(1);
    expect(paymentAfterLateStatuses?.status).toBe("approved");
    expect(subscriptionAfterLateStatuses?.currentPeriodEnd?.getTime()).toBe(firstPeriodEnd);
    const activationEvents = await runWithFarmContext(farmId, () => db
      .select({ id: farmSubscriptionEvents.id })
      .from(farmSubscriptionEvents)
      .where(and(
        eq(farmSubscriptionEvents.paymentId, pendingPayment!.id),
        eq(farmSubscriptionEvents.eventType, "subscription_activated"),
      )));
    expect(activationEvents).toHaveLength(1);

    const postReservationsResult = async (status: string) => {
      const event = {
        eventId: randomUUID(),
        sourceApp: "iwagranja",
        purpose: "subscription",
        provider: "wompi",
        providerTransactionId: txId,
        reference: checkoutJson.reference,
        status,
        amountInCents: quote.totalBeforeLogisticsAndTaxCop * 100,
        currency: "COP",
        paidAt: new Date().toISOString(),
        environment: "test",
      };
      const rawBody = JSON.stringify(event);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = crypto.createHmac("sha256", process.env.RESERVAS_PAYMENT_RESULT_SECRET!)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");
      return reservationsResultPOST(new Request("http://localhost/api/billing/reservas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-reservas-timestamp": timestamp,
          "x-reservas-signature": signature,
        },
        body: rawBody,
      }) as never);
    };

    const oldPendingResponse = await postReservationsResult("PENDING");
    expect(oldPendingResponse.status).toBe(200);
    expect(await parseJson(oldPendingResponse)).toMatchObject({
      ok: true,
      idempotent: true,
      paymentStatus: "approved",
    });

    const replayedApproval = await postReservationsResult("APPROVED");
    expect(replayedApproval.status).toBe(200);
    expect(await parseJson(replayedApproval)).toMatchObject({
      ok: true,
      idempotent: true,
      paymentStatus: "approved",
    });

    const lateDeclineResponse = await postReservationsResult("DECLINED");
    expect(lateDeclineResponse.status).toBe(200);
    expect(await parseJson(lateDeclineResponse)).toMatchObject({
      ok: true,
      reviewRequired: true,
      paymentStatus: "approved",
    });
    const [subscriptionAfterReplays] = await db
      .select()
      .from(farmSubscriptions)
      .where(eq(farmSubscriptions.farmId, farmId))
      .limit(1);
    expect(subscriptionAfterReplays?.currentPeriodEnd?.getTime()).toBe(firstPeriodEnd);

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
  });

  it("rechaza el webhook si falta el secreto de eventos", async () => {
    const configuredSecret = process.env.WOMPI_EVENTS_SECRET;
    delete process.env.WOMPI_EVENTS_SECRET;
    try {
      const result = await processWompiWebhookEvent({}, null);
      expect(result).toMatchObject({ ok: false, status: 503 });
    } finally {
      if (configuredSecret === undefined) delete process.env.WOMPI_EVENTS_SECRET;
      else process.env.WOMPI_EVENTS_SECRET = configuredSecret;
    }
  });

  it("registra estados Wompi no reconocidos como revisión sin cambiar el plan", async () => {
    const externalReference = `IWG-${randomUUID()}`;
    const providerTxId = `wompi-review-${randomUUID()}`;
    const amountCop = 12_345;
    const providerStatus = "PROCESSING_REVIEW_REQUIRED";
    const [subscriptionBefore] = await runWithFarmContext(farmId, () => db
      .select()
      .from(farmSubscriptions)
      .where(eq(farmSubscriptions.farmId, farmId))
      .limit(1));

    const [payment] = await db.insert(billingPayments).values({
      farmId,
      externalReference,
      provider: "wompi",
      method: "checkout",
      amountCop,
      planCode: "CICLO_60D",
      status: "pending",
    }).returning();

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const payload = {
        timestamp,
        environment: "test",
        data: {
          transaction: {
            id: providerTxId,
            reference: externalReference,
            status: providerStatus,
            amount_in_cents: amountCop * 100,
            currency: "COP",
          },
        },
        signature: {
          properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents", "transaction.currency"],
          checksum: crypto.createHash("sha256")
            .update(`${providerTxId}${providerStatus}${amountCop * 100}COP${timestamp}${testEventsSecret}`)
            .digest("hex"),
        },
      };

      const [firstResult, secondConcurrentResult] = await Promise.all([
        processWompiWebhookEvent(payload),
        processWompiWebhookEvent(payload),
      ]);
      const replayResult = await processWompiWebhookEvent(payload);
      const [paymentAfter] = await db.select().from(billingPayments)
        .where(eq(billingPayments.id, payment!.id)).limit(1);
      const [subscriptionAfter] = await runWithFarmContext(farmId, () => db
        .select()
        .from(farmSubscriptions)
        .where(eq(farmSubscriptions.farmId, farmId))
        .limit(1));
      const reviewEvents = await runWithFarmContext(farmId, () => db.select().from(farmSubscriptionEvents)
        .where(eq(farmSubscriptionEvents.paymentId, payment!.id)));

      expect(firstResult).toMatchObject({ ok: true, paymentStatus: "review", reviewRequired: true });
      expect(secondConcurrentResult).toMatchObject({ ok: true, paymentStatus: "review", reviewRequired: true });
      if (
        !firstResult.ok ||
        !secondConcurrentResult.ok ||
        !("idempotent" in firstResult) ||
        !("idempotent" in secondConcurrentResult)
      ) {
        throw new Error("La entrega concurrente de la revisión no fue aceptada.");
      }
      expect([firstResult.idempotent, secondConcurrentResult.idempotent].sort()).toEqual([false, true]);
      expect(replayResult).toMatchObject({ ok: true, paymentStatus: "review", idempotent: true });
      expect(paymentAfter).toMatchObject({ status: "review", providerTxId });
      expect(subscriptionAfter?.planCode).toBe(subscriptionBefore?.planCode);
      expect(subscriptionAfter?.currentPeriodEnd?.toISOString()).toBe(subscriptionBefore?.currentPeriodEnd?.toISOString());
      expect(reviewEvents).toHaveLength(1);
      expect(reviewEvents[0]).toMatchObject({
        farmId,
        eventKey: `payment-review:${payment!.id}:${providerTxId}`,
        eventType: "payment_review_required",
        actorType: "system",
        source: "wompi_webhook",
        beforeSnapshot: { paymentStatus: "pending" },
        afterSnapshot: { paymentStatus: "review", providerStatus },
        paymentId: payment!.id,
        externalReference,
        resultStatus: "review_required",
      });
      expect(reviewEvents[0]).not.toHaveProperty("rawPayload");
    } finally {
      await db.delete(billingPayments).where(eq(billingPayments.id, payment!.id));
    }
  });

  it("confirma a Reservas las discrepancias ya registradas sin modificar el pago", async () => {
    const externalReference = `IWG-${randomUUID()}`;
    const providerTxId = `wompi-amount-review-${randomUUID()}`;
    const amountCop = 12_345;
    const [payment] = await db.insert(billingPayments).values({
      farmId,
      externalReference,
      provider: "wompi",
      method: "checkout",
      amountCop,
      planCode: "CICLO_60D",
      status: "pending",
    }).returning();
    const [subscriptionBefore] = await runWithFarmContext(farmId, () => db
      .select()
      .from(farmSubscriptions)
      .where(eq(farmSubscriptions.farmId, farmId))
      .limit(1));

    try {
      const event = {
        eventId: randomUUID(),
        sourceApp: "iwagranja",
        purpose: "subscription",
        provider: "wompi",
        providerTransactionId: providerTxId,
        reference: externalReference,
        status: "APPROVED",
        amountInCents: amountCop * 100 + 100,
        currency: "COP",
        paidAt: new Date().toISOString(),
        environment: "test",
      };
      const rawBody = JSON.stringify(event);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = crypto.createHmac("sha256", process.env.RESERVAS_PAYMENT_RESULT_SECRET!)
        .update(`${timestamp}.${rawBody}`)
        .digest("hex");
      const response = await reservationsResultPOST(new Request("http://localhost/api/billing/reservas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-reservas-timestamp": timestamp,
          "x-reservas-signature": signature,
        },
        body: rawBody,
      }) as never);

      expect(response.status).toBe(200);
      expect(await parseJson(response)).toMatchObject({
        ok: true,
        reviewRequired: true,
        paymentStatus: "pending",
      });
      const [paymentAfter] = await db.select().from(billingPayments)
        .where(eq(billingPayments.id, payment!.id)).limit(1);
      const [subscriptionAfter] = await runWithFarmContext(farmId, () => db
        .select()
        .from(farmSubscriptions)
        .where(eq(farmSubscriptions.farmId, farmId))
        .limit(1));
      const [reviewEvent] = await runWithFarmContext(farmId, () => db.select().from(farmSubscriptionEvents)
        .where(eq(farmSubscriptionEvents.paymentId, payment!.id)));

      expect(paymentAfter).toMatchObject({ status: "pending", providerTxId: null });
      expect(subscriptionAfter?.planCode).toBe(subscriptionBefore?.planCode);
      expect(subscriptionAfter?.currentPeriodEnd?.toISOString()).toBe(subscriptionBefore?.currentPeriodEnd?.toISOString());
      expect(reviewEvent).toMatchObject({
        eventKey: `payment-review:${payment!.id}:${providerTxId}`,
        eventType: "payment_review_required",
        source: "reservas_delivery",
        afterSnapshot: {
          paymentStatus: "pending",
          reviewRequired: true,
          providerStatus: "APPROVED",
          providerTxId,
          amountMatches: false,
          currencyMatches: true,
        },
        resultStatus: "review_required",
      });
    } finally {
      await db.delete(billingPayments).where(eq(billingPayments.id, payment!.id));
    }
  });

  it("acumula ambos períodos cuando se aprueban dos pagos Productor de la misma granja", async () => {
    const concurrentFarmId = randomUUID();
    const baseline = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 10));
    const quote = createPricingQuote({
      segment: "producer",
      users: 3,
      months: 3,
      renewal: false,
      locations: 1,
    });
    const amountCop = quote.totalBeforeLogisticsAndTaxCop;
    const events = Array.from({ length: 2 }, () => ({
      eventId: randomUUID(),
      sourceApp: "iwagranja",
      purpose: "subscription",
      provider: "wompi",
      providerTransactionId: randomUUID(),
      reference: `IWG-${randomUUID()}`,
      status: "APPROVED",
      amountInCents: amountCop * 100,
      currency: "COP",
      environment: "test",
    }));
    await db.insert(farms).values({
      id: concurrentFarmId,
      slug: `test-payments-${concurrentFarmId}`,
      name: "Granja de concurrencia Productor",
      deploymentMode: "saas",
      planCode: "PRODUCTOR",
    });
    try {
      await runWithFarmContext(concurrentFarmId, async () => {
        await db.insert(farmSubscriptions).values({
          farmId: concurrentFarmId,
          planCode: "PRODUCTOR",
          status: "active",
          maxUsers: 3,
          currentPeriodStart: new Date(),
          currentPeriodEnd: baseline,
        });
        await db.insert(billingPayments).values(events.map((event) => ({
          farmId: concurrentFarmId,
          externalReference: event.reference,
          provider: "wompi",
          method: "checkout",
          amountCop,
          planCode: "PRODUCTOR",
          status: "pending",
          rawPayload: { pricingPurchase: {
            policyVersion: quote.policyVersion,
            termsVersion: "test-terms",
            acceptedAt: new Date().toISOString(),
            environment: "sandbox",
            acceptedTerms: true,
            acceptedDocuments: ["terminos", "retracto"],
            quote,
          } },
        })));
      });

      let approvals: Promise<Awaited<ReturnType<typeof processReservationsPaymentResult>>[]> | undefined;
      try {
        await runWithFarmContext(concurrentFarmId, () => db.transaction(async (gate) => {
          await gate.select({ id: farmSubscriptions.id }).from(farmSubscriptions)
            .where(eq(farmSubscriptions.farmId, concurrentFarmId)).for("update");
          const [{ pid }] = (await gate.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`)).rows;
          approvals = Promise.all(events.map(processReservationsPaymentResult));
          // Let both approval transactions reach the database lock before releasing it.
          await expect.poll(async () => {
            const { rows: [result] } = await db.execute<{ count: number }>(sql`
              WITH RECURSIVE waiting(pid) AS (
                SELECT ${pid}::int
                UNION
                SELECT activity.pid
                FROM pg_stat_activity AS activity
                JOIN waiting ON waiting.pid = ANY(pg_blocking_pids(activity.pid))
                WHERE activity.datname = current_database()
              )
              SELECT (count(*) - 1)::int AS count FROM waiting
            `);
            return result.count;
          }, { timeout: 5_000 }).toBeGreaterThanOrEqual(2);
        }));
      } finally {
        await approvals;
      }
      const results = await approvals;
      expect(results).toMatchObject(events.map(() => ({ ok: true, paymentStatus: "approved", idempotent: false })));
      const midPeriod = addCalendarMonths(baseline, 3).toISOString();
      const finalPeriod = addCalendarMonths(baseline, 6).toISOString();

      await runWithFarmContext(concurrentFarmId, async () => {
        const [subscription] = await db.select().from(farmSubscriptions)
          .where(eq(farmSubscriptions.farmId, concurrentFarmId));
        const audit = await db.select().from(farmSubscriptionEvents)
          .where(eq(farmSubscriptionEvents.farmId, concurrentFarmId));
        expect(subscription?.currentPeriodEnd?.toISOString()).toBe(finalPeriod);
        expect(audit).toHaveLength(2);
        expect(audit).toEqual(expect.arrayContaining([
          expect.objectContaining({
            eventType: "subscription_renewed",
            beforeSnapshot: expect.objectContaining({ currentPeriodEnd: baseline.toISOString() }),
            afterSnapshot: expect.objectContaining({ currentPeriodEnd: midPeriod }),
          }),
          expect.objectContaining({
            eventType: "subscription_renewed",
            beforeSnapshot: expect.objectContaining({ currentPeriodEnd: midPeriod }),
            afterSnapshot: expect.objectContaining({ currentPeriodEnd: finalPeriod }),
          }),
        ]));
      });
    } finally {
      await db.delete(farms).where(eq(farms.id, concurrentFarmId));
    }
  });

  it("impide que un ID de transacción Wompi apruebe dos referencias distintas", async () => {
    const transactionId = `wompi-tx-reused-${randomUUID()}`;
    const amountCop = 1000;
    const references = [`IWG-${randomUUID()}`, `IWG-${randomUUID()}`] as const;
    const [periodBefore] = await db
      .select({ currentPeriodEnd: farmSubscriptions.currentPeriodEnd })
      .from(farmSubscriptions)
      .where(eq(farmSubscriptions.farmId, farmId))
      .limit(1);

    await db.insert(billingPayments).values(references.map((externalReference) => ({
      farmId,
      externalReference,
      provider: "wompi",
      method: "checkout",
      amountCop,
      planCode: "CICLO_60D",
      status: "pending",
    })));

    const makeSignedApproval = (reference: string) => {
      const timestamp = Math.floor(Date.now() / 1000);
      const checksum = crypto
        .createHash("sha256")
        .update(`${transactionId}APPROVED${amountCop * 100}COP${timestamp}${testEventsSecret}`)
        .digest("hex");
      return {
        timestamp,
        environment: "test",
        data: {
          transaction: {
            id: transactionId,
            reference,
            status: "APPROVED",
            amount_in_cents: amountCop * 100,
            currency: "COP",
          },
        },
        signature: {
          properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents", "transaction.currency"],
          checksum,
        },
      };
    };

    try {
      const responses = await Promise.all(references.map((reference) => webhookPOST(
        mockRequest("http://localhost/api/billing/webhook", {
          method: "POST",
          body: makeSignedApproval(reference),
        }),
      )));
      expect(responses.map((response) => response.status).sort()).toEqual([200, 200]);

      const paymentRows = await db.select().from(billingPayments).where(eq(billingPayments.providerTxId, transactionId));
      expect(paymentRows).toHaveLength(1);
      expect(paymentRows[0]?.status).toBe("approved");
      const reviewEvents = await runWithFarmContext(farmId, () => db.select().from(farmSubscriptionEvents)
        .where(eq(farmSubscriptionEvents.eventType, "payment_review_required")));
      expect(reviewEvents.some((event) => event.externalReference === references.find((reference) =>
        paymentRows[0]?.externalReference !== reference))).toBe(true);

      const [periodAfter] = await db
        .select({ currentPeriodEnd: farmSubscriptions.currentPeriodEnd })
        .from(farmSubscriptions)
        .where(eq(farmSubscriptions.farmId, farmId))
        .limit(1);
      expect(periodAfter?.currentPeriodEnd?.getTime()).toBe(
        (periodBefore?.currentPeriodEnd?.getTime() ?? 0) + 60 * 86400000,
      );
    } finally {
      await db.delete(billingPayments).where(eq(billingPayments.externalReference, references[0]));
      await db.delete(billingPayments).where(eq(billingPayments.externalReference, references[1]));
    }
  });
});


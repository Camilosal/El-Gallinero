import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

import crypto from "node:crypto";
import { processWompiWebhookEvent, verifyWompiWebhookSignature } from "@/lib/subscription";
import { POST as reservationsResultPOST } from "@/app/api/billing/reservas/route";

const originalEventsSecret = process.env.WOMPI_EVENTS_SECRET;
const originalWompiEnvironment = process.env.WOMPI_ENVIRONMENT;
const originalReservationsSecret = process.env.RESERVAS_PAYMENT_RESULT_SECRET;

afterEach(() => {
  if (originalEventsSecret === undefined) delete process.env.WOMPI_EVENTS_SECRET;
  else process.env.WOMPI_EVENTS_SECRET = originalEventsSecret;
  if (originalWompiEnvironment === undefined) delete process.env.WOMPI_ENVIRONMENT;
  else process.env.WOMPI_ENVIRONMENT = originalWompiEnvironment;
  if (originalReservationsSecret === undefined) delete process.env.RESERVAS_PAYMENT_RESULT_SECRET;
  else process.env.RESERVAS_PAYMENT_RESULT_SECRET = originalReservationsSecret;
});

describe("seguridad del webhook de pagos", () => {
  it("falla cerrado cuando no existe secreto de eventos configurado", async () => {
    delete process.env.WOMPI_EVENTS_SECRET;

    expect(verifyWompiWebhookSignature({ timestamp: 1 }, "a".repeat(64))).toBe(false);
    await expect(processWompiWebhookEvent({}, null)).resolves.toMatchObject({
      ok: false,
      status: 503,
    });
  });

  it("rechaza un evento firmado que pertenece al ambiente incorrecto", async () => {
    const secret = "test-events-environment-secret";
    const timestamp = 1731500123;
    process.env.WOMPI_EVENTS_SECRET = secret;
    process.env.WOMPI_ENVIRONMENT = "sandbox";
    const payload = {
      timestamp,
      environment: "prod",
      data: { transaction: { id: "tx-test", status: "APPROVED", amount_in_cents: 100 } },
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
        checksum: crypto.createHash("sha256").update(`tx-testAPPROVED100${timestamp}${secret}`).digest("hex"),
      },
    };

    await expect(processWompiWebhookEvent(payload, null)).resolves.toMatchObject({
      ok: false,
      status: 409,
    });
  });

  it("falla cerrado si Reservas no tiene secreto de resultado configurado", async () => {
    delete process.env.RESERVAS_PAYMENT_RESULT_SECRET;
    const response = await reservationsResultPOST(new Request("http://localhost/api/billing/reservas", {
      method: "POST",
      body: "{}",
    }) as never);
    expect(response.status).toBe(503);
  });

  it("rechaza firma inválida o vencida antes de procesar el pago", async () => {
    process.env.RESERVAS_PAYMENT_RESULT_SECRET = "reservas-result-test-secret";
    const now = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ sourceApp: "iwagranja", purpose: "subscription" });
    const invalid = await reservationsResultPOST(new Request("http://localhost/api/billing/reservas", {
      method: "POST",
      headers: { "x-reservas-timestamp": now, "x-reservas-signature": "0".repeat(64) },
      body,
    }) as never);
    expect(invalid.status).toBe(401);

    const staleTimestamp = String(Number(now) - 301);
    const staleSignature = crypto.createHmac("sha256", process.env.RESERVAS_PAYMENT_RESULT_SECRET)
      .update(staleTimestamp + "." + body).digest("hex");
    const stale = await reservationsResultPOST(new Request("http://localhost/api/billing/reservas", {
      method: "POST",
      headers: { "x-reservas-timestamp": staleTimestamp, "x-reservas-signature": staleSignature },
      body,
    }) as never);
    expect(stale.status).toBe(401);
  });

  it("valida HMAC antes de rechazar un evento de origen inesperado", async () => {
    process.env.RESERVAS_PAYMENT_RESULT_SECRET = "reservas-result-test-secret";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ sourceApp: "otro", purpose: "subscription", provider: "wompi" });
    const signature = crypto.createHmac("sha256", process.env.RESERVAS_PAYMENT_RESULT_SECRET)
      .update(timestamp + "." + body).digest("hex");
    const response = await reservationsResultPOST(new Request("http://localhost/api/billing/reservas", {
      method: "POST",
      headers: { "x-reservas-timestamp": timestamp, "x-reservas-signature": signature },
      body,
    }) as never);
    expect(response.status).toBe(400);
  });
});

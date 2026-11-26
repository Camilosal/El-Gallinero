import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }));
vi.mock("@/db", () => ({ db: { select: selectMock } }));

import { GET } from "@/app/api/v1/integrations/billing/reconciliation/route";

const secret = "test-only-reconciliation-secret-32-bytes-min";

function query(rows: unknown[]) {
  const result = Promise.resolve(rows);
  const chain = {
    from: () => chain,
    where: () => chain,
    leftJoin: () => chain,
    orderBy: () => chain,
    limit: () => result,
    then: result.then.bind(result),
  };
  return chain;
}

function signedRequest(path: string, timestamp = Math.floor(Date.now() / 1000)) {
  const url = new URL(path, "http://localhost");
  const params = new URLSearchParams(url.searchParams);
  params.sort();
  const queryString = params.toString();
  const target = `${url.pathname}${queryString ? `?${queryString}` : ""}`;
  const timestampHeader = String(timestamp);
  const signature = createHmac("sha256", secret)
    .update(`${timestampHeader}.GET.${target}`)
    .digest("hex");
  return new NextRequest(url, {
    headers: {
      "x-reservas-reconciliation-timestamp": timestampHeader,
      "x-reservas-reconciliation-signature": signature,
    },
  });
}

describe("exportación HMAC de conciliación para Reservas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESERVAS_RECONCILIATION_HMAC_SECRET = secret;
    selectMock.mockImplementation(() => query([]));
  });

  it("rechaza firmas ausentes o inválidas antes de consultar la base", async () => {
    const unsigned = await GET(new NextRequest("http://localhost/api/v1/integrations/billing/reconciliation"));
    expect(unsigned.status).toBe(401);

    const signed = signedRequest("/api/v1/integrations/billing/reconciliation");
    const invalid = new NextRequest(signed.url, {
      headers: {
        "x-reservas-reconciliation-timestamp": signed.headers.get("x-reservas-reconciliation-timestamp")!,
        "x-reservas-reconciliation-signature": "0".repeat(64),
      },
    });
    const response = await GET(invalid);

    expect(response.status).toBe(401);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("rechaza filtros fuera de rango antes de leer datos", async () => {
    const response = await GET(signedRequest("/api/v1/integrations/billing/reconciliation?pageSize=101"));

    expect(response.status).toBe(400);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("rechaza parámetros duplicados aunque la firma sea válida", async () => {
    const response = await GET(signedRequest("/api/v1/integrations/billing/reconciliation?pageSize=1&pageSize=2"));

    expect(response.status).toBe(400);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("devuelve pagos y eventos con cursores estables y campos mínimos", async () => {
    const paymentId = "11111111-1111-4111-8111-111111111111";
    const eventId = "22222222-2222-4222-8222-222222222222";
    const createdAt = "2026-11-24 10:00:00.000000";
    const occurredAt = "2026-11-24 10:01:00.000000";
    selectMock
      .mockImplementationOnce(() => query([{
        id: paymentId,
        reference: "IWG-payment-1",
        providerTransactionId: "wompi-tx-1",
        amountInCents: 1_990_000,
        currency: "COP",
        status: "approved",
        environment: "test",
        createdAt,
        paidAt: new Date("2026-11-24T10:00:00.000Z"),
        rawPayload: { secret: "no-exportar" },
        farmId: "no-exportar",
      }]))
      .mockImplementationOnce(() => query([{
        id: eventId,
        reference: "IWG-payment-1",
        providerTransactionId: "wompi-tx-1",
        environment: "test",
        eventType: "payment_review_required",
        source: "wompi_webhook",
        resultStatus: "review_required",
        occurredAt,
        paymentStatus: "review",
        amountInCents: 1_990_000,
        farmId: "no-exportar",
        rawPayload: { secret: "no-exportar" },
      }]));

    const response = await GET(signedRequest("/api/v1/integrations/billing/reconciliation?pageSize=1&environment=test"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      scope: "iwagranja/subscription",
      data: {
        payments: [{
          reference: "IWG-payment-1",
          environment: "test",
          amountInCents: 1_990_000,
          currency: "COP",
          financialStatus: "approved",
          providerTransactionId: "wompi-tx-1",
        }],
        subscriptionEvents: [{
          reference: "IWG-payment-1",
          eventType: "payment_review_required",
          source: "wompi_webhook",
          resultStatus: "review_required",
          paymentStatus: "review",
        }],
      },
      nextCursor: {
        payments: null,
        subscriptionEvents: null,
      },
      complete: { payments: true, subscriptionEvents: true },
    });
    expect(JSON.stringify(body)).not.toContain("no-exportar");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(selectMock).toHaveBeenCalledTimes(2);
  });

  it("responde con 503 cuando falta una clave de servicio segura", async () => {
    process.env.RESERVAS_RECONCILIATION_HMAC_SECRET = "short";

    const response = await GET(signedRequest("/api/v1/integrations/billing/reconciliation"));

    expect(response.status).toBe(503);
    expect(selectMock).not.toHaveBeenCalled();
  });
});

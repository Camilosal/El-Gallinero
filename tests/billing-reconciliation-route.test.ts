import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }));
vi.mock("@/db", () => ({ db: { select: selectMock } }));

import { GET } from "@/app/api/superadmin/billing/reconciliation/route";

function query(rows: unknown[]) {
  const result = Promise.resolve(rows);
  const chain = {
    from: () => chain,
    where: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    orderBy: () => chain,
    limit: () => result,
    then: result.then.bind(result),
  };
  return chain;
}

const request = () => new NextRequest("http://localhost/api/superadmin/billing/reconciliation");

describe("ruta de conciliación de Super-Administración", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSessionUser).mockResolvedValue({
      id: "test-admin",
      username: "admin",
      name: "Admin",
      role: "admin",
      farmId: "00000000-0000-0000-0000-000000000001",
    });
  });

  it("rechaza usuarios no autenticados y roles sin permiso de ajustes", async () => {
    vi.mocked(getSessionUser).mockResolvedValueOnce(null);
    const unauthenticated = await GET(request());
    expect(unauthenticated.status).toBe(401);
    expect(selectMock).not.toHaveBeenCalled();

    vi.mocked(getSessionUser).mockResolvedValue({
      id: "test-operator",
      username: "operator",
      name: "Operator",
      role: "operario",
      farmId: "00000000-0000-0000-0000-000000000001",
    });
    const forbidden = await GET(request());
    expect(forbidden.status).toBe(403);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("devuelve solo casos locales y no serializa el payload del pago", async () => {
    const farmId = "00000000-0000-0000-0000-000000000101";
    const reference = "IWG-intent-audit";
    const observedAt = new Date("2026-11-20T10:00:00.000Z");
    selectMock
      .mockImplementationOnce(() => query([{ count: 1 }]))
      .mockImplementationOnce(() => query([{ count: 1 }]))
      .mockImplementationOnce(() => query([{
        id: "payment-audit-1",
        farmId,
        farmName: "Granja de prueba",
        provider: "wompi",
        externalReference: reference,
        providerTxId: "wompi-tx-audit",
        amountCop: 19_900,
        planCode: "PRODUCTOR",
        status: "approved",
        createdAt: observedAt,
        rawPayload: { secret: "no-debe-aparecer" },
      }]))
      .mockImplementationOnce(() => query([{
        id: "event-audit-1",
        farmId,
        farmName: "Granja de prueba",
        paymentId: "payment-missing",
        externalReference: "IWG-orphan-event",
        eventType: "subscription_activated",
        source: "reservas_delivery",
        resultStatus: "applied",
        occurredAt: observedAt,
        providerTxId: "wompi-tx-orphan-event",
      }, {
        id: "event-review-1",
        farmId,
        farmName: "Granja de prueba",
        paymentId: null,
        externalReference: "IWG-review-audit",
        eventType: "payment_review_required",
        source: "wompi_webhook",
        resultStatus: "review_required",
        occurredAt: observedAt,
        providerTxId: "wompi-tx-review-event",
      }]));

    const response = await GET(request());
    const report = await response.json();

    expect(response.status).toBe(200);
    expect(report).toMatchObject({
      scope: "iwagranja_local",
      completeScan: true,
      sources: { comparedSystems: ["IwaGranja"] },
      limitations: expect.arrayContaining([expect.stringContaining("No consulta Reservas ni Wompi")]),
    });
    expect(report.findings.map((finding: { code: string }) => finding.code)).toEqual([
      "payment_requires_review",
      "approved_without_lifecycle_event",
      "lifecycle_event_without_payment",
    ]);
    expect(report.findings[2]).toMatchObject({ providerTxId: "wompi-tx-orphan-event" });
    expect(report.findings[0]).toMatchObject({
      code: "payment_requires_review",
      externalReference: "IWG-review-audit",
      providerTxId: "wompi-tx-review-event",
    });
    expect(JSON.stringify(report)).not.toContain("no-debe-aparecer");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});

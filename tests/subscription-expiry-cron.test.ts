import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { selectMock, expireMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  expireMock: vi.fn(),
}));

vi.mock("@/db", () => ({ db: { select: selectMock } }));
vi.mock("@/lib/subscription", () => ({ expirePaidSubscriptionForFarm: expireMock }));

import { POST } from "@/app/api/cron/suscripciones-vencidas/route";

function query(rows: unknown[]) {
  const result = Promise.resolve(rows);
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => result,
    then: result.then.bind(result),
  };
  return chain;
}

function cronRequest(token?: string) {
  return new NextRequest("http://localhost/api/cron/suscripciones-vencidas", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("cron de vencimiento de suscripciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CRON_SECRET;
  });

  it("falla cerrado si falta CRON_SECRET o la autorización no coincide", async () => {
    const unconfigured = await POST(cronRequest());
    expect(unconfigured.status).toBe(503);
    expect(selectMock).not.toHaveBeenCalled();

    process.env.CRON_SECRET = "secret-for-test";
    const unauthorized = await POST(cronRequest("wrong-secret"));
    expect(unauthorized.status).toBe(401);
    const rawSecret = await POST(new NextRequest("http://localhost/api/cron/suscripciones-vencidas", {
      method: "POST",
      headers: { authorization: "secret-for-test" },
    }));
    expect(rawSecret.status).toBe(401);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("procesa lotes autorizados y devuelve el estado de vencimientos pendientes", async () => {
    process.env.CRON_SECRET = "secret-for-test";
    selectMock
      .mockImplementationOnce(() => query([{ farmId: "farm-1", currentPeriodEnd: new Date("2026-11-19T00:00:00Z") }]))
      .mockImplementationOnce(() => query([{ count: 0 }]));
    expireMock.mockResolvedValueOnce(true);

    const response = await POST(cronRequest("secret-for-test"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      ok: true,
      scanned: 1,
      expired: 1,
      failures: 0,
      remaining: 0,
      hasMore: false,
    });
    expect(expireMock).toHaveBeenCalledWith("farm-1", expect.any(Date));
  });
});

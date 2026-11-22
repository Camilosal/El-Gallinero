import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  dbSelect: vi.fn(),
  syncExternalSourcesDue: vi.fn(),
  runWithFarmContext: vi.fn(),
}));

vi.mock("@/db", () => ({ db: { select: mocks.dbSelect } }));
vi.mock("@/db/schema", () => ({ farms: { id: "farms.id" } }));
vi.mock("@/db/tenant-context", () => ({
  DEFAULT_FARM_ID: "00000000-0000-0000-0000-000000000001",
  runWithFarmContext: mocks.runWithFarmContext,
}));
vi.mock("@/lib/external-sources/sync-orchestrator", () => ({
  syncExternalSourcesDue: mocks.syncExternalSourcesDue,
}));

import { POST } from "@/app/api/cron/fuentes-externas/route";

const previousSecret = process.env.CRON_SECRET;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.dbSelect.mockReturnValue({ from: vi.fn().mockResolvedValue([]) });
  mocks.runWithFarmContext.mockImplementation((_farmId: string, operation: () => unknown) => operation());
  mocks.syncExternalSourcesDue.mockResolvedValue({
    checked: ["ideam_hydro_alerts"],
    failed: [],
    results: [{
      sourceKey: "ideam_hydro_alerts",
      status: "ok",
      providerName: "IDEAM",
      fetchedAt: "2026-11-17T00:00:00.000Z",
      expiresAt: "2026-11-17T03:00:00.000Z",
      summary: "1 registro",
      lastError: null,
    }],
  });
});

afterEach(() => {
  if (previousSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = previousSecret;
});

function cronRequest(authorization?: string) {
  return new NextRequest("http://localhost/api/cron/fuentes-externas", {
    method: "POST",
    headers: authorization ? { authorization } : undefined,
  });
}

describe("Autorización del programador externo", () => {
  it("rechaza la llamada cuando el secreto no está configurado", async () => {
    delete process.env.CRON_SECRET;
    const response = await POST(cronRequest("Bearer wrong"));

    expect(response.status).toBe(503);
    expect(mocks.syncExternalSourcesDue).not.toHaveBeenCalled();
  });

  it("rechaza llamadas con secreto incorrecto antes de consultar granjas", async () => {
    process.env.CRON_SECRET = "expected-secret";
    const response = await POST(cronRequest("Bearer wrong-secret"));

    expect(response.status).toBe(401);
    expect(mocks.dbSelect).not.toHaveBeenCalled();
    expect(mocks.syncExternalSourcesDue).not.toHaveBeenCalled();
  });

  it("ejecuta una sincronización por granja con el secreto correcto", async () => {
    process.env.CRON_SECRET = "expected-secret";
    const response = await POST(cronRequest("Bearer expected-secret"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, farmsProcessed: 1, sourcesChecked: 1, sourceFailures: 0 });
    expect(mocks.syncExternalSourcesDue).toHaveBeenCalledTimes(1);
  });
});

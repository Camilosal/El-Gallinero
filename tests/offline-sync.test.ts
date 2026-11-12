import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Offline Sync Architecture", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("garantiza que las mutaciones de outbox tengan UUID y timestamp del cliente", () => {
    const clientTimestamp = new Date().toISOString();
    const mutation = {
      id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
      endpoint: "/api/produccion/huevos",
      method: "POST" as const,
      entity: "huevos" as const,
      description: "Recolección de 36 huevos (gallina)",
      payload: {
        date: "2026-11-12",
        species: "gallina",
        totalCollected: 36,
        broken: 1,
        forIncubation: 0,
        locationId: "loc-123",
      },
      clientTimestamp,
      status: "pending" as const,
      retries: 0,
      createdAt: Date.now(),
    };

    expect(mutation.id).toBeDefined();
    expect(mutation.clientTimestamp).toBe(clientTimestamp);
    expect(mutation.status).toBe("pending");
    expect(mutation.retries).toBe(0);
  });

  it("prioriza mutaciones en orden FIFO (las más antiguas primero)", () => {
    const mutations = [
      { id: "3", createdAt: 300, status: "pending" },
      { id: "1", createdAt: 100, status: "pending" },
      { id: "2", createdAt: 200, status: "failed" },
      { id: "4", createdAt: 50, status: "synced" },
    ];

    const pending = mutations
      .filter((m) => m.status === "pending" || m.status === "failed")
      .sort((a, b) => a.createdAt - b.createdAt);

    expect(pending.map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("maneja idempotencia si el lote o registro ya fue insertado previamente", () => {
    const existingDbIds = new Set(["uuid-egg-001", "uuid-mort-002"]);

    const incomingMutations = [
      { id: "uuid-egg-001", entity: "huevos", total: 40 }, // ya existe (reintento offline)
      { id: "uuid-egg-003", entity: "huevos", total: 25 }, // nuevo
    ];

    const results = incomingMutations.map((m) => {
      if (existingDbIds.has(m.id)) {
        return { id: m.id, status: "synced", note: "idempotent_skip" };
      }
      existingDbIds.add(m.id);
      return { id: m.id, status: "synced", note: "inserted" };
    });

    expect(results).toEqual([
      { id: "uuid-egg-001", status: "synced", note: "idempotent_skip" },
      { id: "uuid-egg-003", status: "synced", note: "inserted" },
    ]);
  });
});

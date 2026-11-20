import { afterAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
vi.mock("server-only", () => ({}));
import { db, pool } from "@/db";
import { billingPayments, farmSubscriptionEvents, farmSubscriptions, farms } from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";

const mockedUser = vi.hoisted(() => ({
  current: {
    id: "00000000-0000-0000-0000-000000000099",
    username: "platform_admin_test",
    name: "Platform Admin Test",
    role: "admin",
    farmId: "00000000-0000-0000-0000-000000000001",
    homeFarmId: "00000000-0000-0000-0000-000000000001",
  },
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSessionUser: vi.fn(async () => mockedUser.current),
  };
});

import { PATCH as patchSuperAdminFarms } from "@/app/api/superadmin/granjas/route";

const databaseName = process.env.DATABASE_URL
  ? decodeURIComponent(new URL(process.env.DATABASE_URL).pathname.replace(/^\//, ""))
  : "";
const isIsolatedTestDatabase = databaseName.includes("_test_");

describe("auditoría de cambios administrativos de suscripción", () => {
  let farmId: string | null = null;

  afterAll(async () => {
    if (!farmId) return;
    await runWithFarmContext(farmId, async () => {
      await db.delete(billingPayments).where(eq(billingPayments.farmId, farmId!));
      await db.delete(farmSubscriptions).where(eq(farmSubscriptions.farmId, farmId!));
    });
    const role = await pool.query<{ rolsuper: boolean }>("SELECT rolsuper FROM pg_roles WHERE rolname = current_user");
    if (!isIsolatedTestDatabase || !role.rows[0]?.rolsuper) {
      throw new Error("Refusing to clean append-only subscription events outside an isolated superuser test database.");
    }
    await pool.query("ALTER TABLE farm_subscription_events DISABLE TRIGGER farm_subscription_events_no_update_delete");
    try {
      await pool.query("DELETE FROM farm_subscription_events WHERE farm_id = $1", [farmId]);
    } finally {
      await pool.query("ALTER TABLE farm_subscription_events ENABLE TRIGGER farm_subscription_events_no_update_delete");
    }
    await pool.query("DELETE FROM farms WHERE id = $1", [farmId]);
  });

  it.skipIf(!isIsolatedTestDatabase)("registra antes/después, actor y pago manual en una sola operación", async () => {
    const role = await pool.query<{ rolsuper: boolean }>("SELECT rolsuper FROM pg_roles WHERE rolname = current_user");
    expect(role.rows[0]?.rolsuper).toBe(true);
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 86400000);
    const [farm] = await db.insert(farms).values({
      slug: `billing-audit-${randomUUID()}`,
      name: "Granja de auditoría de pagos",
      planCode: "PRODUCTOR",
    }).returning();
    farmId = farm.id;

    await runWithFarmContext(farm.id, async () => {
      await db.insert(farmSubscriptions).values({
        farmId: farm.id,
        planCode: "PRODUCTOR",
        status: "active",
        maxUsers: 3,
        maxActiveBatches: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      });
    });

    const response = await patchSuperAdminFarms(new NextRequest("http://localhost/api/superadmin/granjas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmId: farm.id,
        planCode: "PRODUCTOR",
        status: "active",
        maxUsers: 2,
        extendDays: 30,
        registerManualPayment: true,
        amountCop: 19900,
        paymentMethod: "transferencia",
        changeReason: "Ampliación autorizada por el titular",
      }),
    }));

    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody.subscription.maxUsers).toBe(2);

    const events = await runWithFarmContext(farm.id, () => db.select().from(farmSubscriptionEvents)
      .where(eq(farmSubscriptionEvents.farmId, farm.id)));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "subscription_changed",
      actorType: "platform_admin",
      actorId: mockedUser.current.id,
      source: "superadmin_farm_update",
      reason: "Ampliación autorizada por el titular",
      beforeSnapshot: { planCode: "PRODUCTOR", status: "active", maxUsers: 3 },
      afterSnapshot: { planCode: "PRODUCTOR", status: "active", maxUsers: 2 },
      resultStatus: "applied",
    });
    expect(events[0]?.externalReference).toMatch(/^SA-/);
    expect(events[0]?.paymentId).toBeTruthy();

    const payments = await runWithFarmContext(farm.id, () => db.select().from(billingPayments)
      .where(eq(billingPayments.farmId, farm.id)));
    expect(payments).toHaveLength(1);
    expect(payments[0]?.id).toBe(events[0]?.paymentId);
  });
});

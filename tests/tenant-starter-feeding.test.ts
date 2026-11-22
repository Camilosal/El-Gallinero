import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, pool } from "@/db";
import { runPendingMigrations } from "@/db/migrate-prod";
import {
  appSettings,
  billingPayments,
  catalogos,
  farmSubscriptions,
  farms,
  feedInventory,
  feedPrograms,
  sessions,
  users,
} from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { FEEDING_SPECIES } from "@/lib/species";
import { getStageSpecies } from "@/lib/feeding/stage-species";
import {
  STARTER_FEED_DEFINITIONS,
  STARTER_STAGE_PROGRAMS,
  seedStarterFeedsAndPrograms,
} from "@/lib/feeding/default-tenant-seed";

const mockedSessionUser = vi.hoisted(() => ({
  current: {
    id: "00000000-0000-0000-0000-000000000099",
    username: "admin",
    name: "Super Admin",
    role: "admin",
    farmId: "00000000-0000-0000-0000-000000000001",
    homeFarmId: "00000000-0000-0000-0000-000000000001",
  },
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSessionUser: vi.fn(async () => mockedSessionUser.current),
    switchUserSessionFarm: vi.fn(async (_userId: string, targetFarmId: string) => {
      mockedSessionUser.current = {
        ...mockedSessionUser.current,
        farmId: targetFarmId,
      };
    }),
  };
});

import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as superadminCreateFarmPost } from "@/app/api/superadmin/granjas/route";
import { POST as seedDefaultsPost } from "@/app/api/produccion/etapas/seed-defaults/route";
import { GET as getFeedingReview, POST as postFeedingReview } from "@/app/api/dashboard/setup/feeding-review/route";
import { GET as getTareasPendientes } from "@/app/api/dashboard/tareas-pendientes/route";
import { POST as postEtapa } from "@/app/api/produccion/etapas/route";

async function cleanupFarm(farmId: string) {
  await runWithFarmContext(farmId, async () => {
    await db.delete(feedPrograms).where(eq(feedPrograms.farmId, farmId));
    await db.delete(feedInventory).where(eq(feedInventory.farmId, farmId));
    await db.delete(catalogos).where(eq(catalogos.farmId, farmId));
    await db.delete(appSettings).where(eq(appSettings.farmId, farmId));
  });
  await db.delete(billingPayments).where(eq(billingPayments.farmId, farmId));
  await db.delete(farmSubscriptions).where(eq(farmSubscriptions.farmId, farmId));
  await db.delete(sessions).where(eq(sessions.farmId, farmId));
  await db.delete(users).where(eq(users.farmId, farmId));
  await db.delete(farms).where(eq(farms.id, farmId));
}

describe("Bloque A: Precarga de alimentos (sin proveedor), planes mixtos multiespecie y validación inicial", () => {
  const createdFarmIds: string[] = [];

  beforeAll(async () => {
    await runPendingMigrations(pool);
  });

  afterAll(async () => {
    mockedSessionUser.current.farmId = DEFAULT_FARM_ID;
    for (const farmId of createdFarmIds) {
      await cleanupFarm(farmId);
    }
  });

  it("precarga alimentos neutros y planes mixtos (suma 100%) para todas las especies al registrar un nuevo tenant", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const req = new NextRequest("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": `10.10.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)}`,
      },
      body: JSON.stringify({
        farmName: `Granja Semilla ${suffix}`,
        username: `owner_${suffix}`,
        password: "Password123!",
        ownerName: "Camila Campo",
        acceptLegal: true,
      }),
    });

    const res = await registerPost(req);
    expect(res.status).toBe(201);
    const payload = await res.json();
    const newFarmId = payload.farm?.id as string;
    expect(newFarmId).toBeTruthy();
    createdFarmIds.push(newFarmId);

    await runWithFarmContext(newFarmId, async () => {
      const feeds = await db.select().from(feedInventory);
      expect(feeds.length).toBe(STARTER_FEED_DEFINITIONS.length);
      for (const feed of feeds) {
        expect(feed.supplier).toBeNull();
        expect(Number(feed.currentStock)).toBe(0);
        expect(Number(feed.costPerUnit)).toBe(0);
      }

      const stages = await db
        .select()
        .from(catalogos)
        .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.farmId, newFarmId)));
      expect(stages.length).toBe(STARTER_STAGE_PROGRAMS.length);

      const speciesCovered = new Set(stages.map((s) => getStageSpecies(s)));
      for (const species of FEEDING_SPECIES) {
        expect(speciesCovered.has(species)).toBe(true);
      }

      const programs = await db.select().from(feedPrograms);
      for (const stage of stages) {
        const entries = programs.filter((p) => p.stageCatalogoId === stage.id);
        expect(entries.length).toBeGreaterThanOrEqual(2); // Mixto: al menos 2 ingredientes
        const totalPct = entries.reduce((sum, entry) => sum + Number(entry.percentage), 0);
        expect(Math.abs(totalPct - 100)).toBeLessThanOrEqual(0.05);
      }
    });

    // Verifica que feedingProgramsValidated inicie en false y pase a true tras validar
    mockedSessionUser.current.farmId = newFarmId;

    const tareasBefore = await (
      await getTareasPendientes(new NextRequest("http://localhost:3000/api/dashboard/tareas-pendientes"))
    ).json();
    expect(tareasBefore.setup.feedingProgramsValidated).toBe(false);

    const reviewBefore = await (
      await getFeedingReview(new NextRequest("http://localhost:3000/api/dashboard/setup/feeding-review"))
    ).json();
    expect(reviewBefore.reviewed).toBe(false);

    const confirmRes = await postFeedingReview(
      new NextRequest("http://localhost:3000/api/dashboard/setup/feeding-review", { method: "POST" }),
    );
    expect(confirmRes.status).toBe(200);
    const confirmBody = await confirmRes.json();
    expect(confirmBody.reviewed).toBe(true);
    expect(confirmBody.reviewedAt).toBeTruthy();

    const tareasAfter = await (
      await getTareasPendientes(new NextRequest("http://localhost:3000/api/dashboard/tareas-pendientes"))
    ).json();
    expect(tareasAfter.setup.feedingProgramsValidated).toBe(true);
  });

  it("permite backfill idempotente vía /api/produccion/etapas/seed-defaults y acepta especie 'gallo' en etapas", async () => {
    const bareFarmId = crypto.randomUUID();
    createdFarmIds.push(bareFarmId);
    await db.insert(farms).values({
      id: bareFarmId,
      slug: `bare-${bareFarmId.slice(0, 8)}`,
      name: "Granja Sin Planes",
    });

    mockedSessionUser.current.farmId = bareFarmId;
    const firstSeedRes = await seedDefaultsPost(
      new NextRequest("http://localhost:3000/api/produccion/etapas/seed-defaults", { method: "POST" }),
    );
    expect(firstSeedRes.status).toBe(200);
    const firstSeed = await firstSeedRes.json();
    expect(firstSeed.createdFeeds).toBe(STARTER_FEED_DEFINITIONS.length);
    expect(firstSeed.createdStages).toBe(STARTER_STAGE_PROGRAMS.length);
    expect(firstSeed.createdPrograms).toBe(STARTER_STAGE_PROGRAMS.length);

    // Segunda llamada no debe duplicar ni alimentos ni etapas ni programas
    const secondSeed = await (
      await seedDefaultsPost(
        new NextRequest("http://localhost:3000/api/produccion/etapas/seed-defaults", { method: "POST" }),
      )
    ).json();
    expect(secondSeed.createdFeeds).toBe(0);
    expect(secondSeed.createdStages).toBe(0);
    expect(secondSeed.createdPrograms).toBe(0);

    // También funciona directamente desde seedStarterFeedsAndPrograms
    const directRes = await runWithFarmContext(bareFarmId, () => seedStarterFeedsAndPrograms(bareFarmId));
    expect(directRes.createdFeeds).toBe(0);
    expect(directRes.createdStages).toBe(0);

    // Crear etapa explícita para 'gallo' debe permitirse y dejar constancia de revisión
    const bareFeeds = await runWithFarmContext(bareFarmId, async () => db.select().from(feedInventory));
    expect(bareFeeds.length).toBe(STARTER_FEED_DEFINITIONS.length);
    const galloReq = new NextRequest("http://localhost:3000/api/produccion/etapas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        species: "gallo",
        value: "Gallo: Reproducción Alta",
        minWeeks: 26,
        maxWeeks: 100,
        programs: [
          { feedId: bareFeeds[0].id, dailyAmountPerHen: 75 },
          { feedId: bareFeeds[1].id, dailyAmountPerHen: 25 },
        ],
      }),
    });
    const galloRes = await postEtapa(galloReq);
    const galloBody = await galloRes.json();
    expect(galloRes.status, JSON.stringify(galloBody)).toBe(201);

    const reviewAfterEdit = await (
      await getFeedingReview(new NextRequest("http://localhost:3000/api/dashboard/setup/feeding-review"))
    ).json();
    expect(reviewAfterEdit.reviewed).toBe(true);
  });

  it("precarga alimentos y planes iniciales también al crear un tenant desde Super-Admin", async () => {
    mockedSessionUser.current.farmId = DEFAULT_FARM_ID;
    mockedSessionUser.current.homeFarmId = DEFAULT_FARM_ID;
    mockedSessionUser.current.role = "admin";

    const suffix = crypto.randomUUID().slice(0, 8);
    const req = new NextRequest("http://localhost:3000/api/superadmin/granjas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmName: `Finca SuperAdmin ${suffix}`,
        ownerName: "Admin Finca",
        ownerUsername: `sa_${suffix}`,
        ownerPassword: "Password123!",
        planCode: "FREEMIUM_SEMILLA",
      }),
    });
    const res = await superadminCreateFarmPost(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    const createdId = body.farm.id as string;
    createdFarmIds.push(createdId);

    await runWithFarmContext(createdId, async () => {
      const feeds = await db.select().from(feedInventory);
      const stages = await db
        .select()
        .from(catalogos)
        .where(and(eq(catalogos.category, "etapa_crecimiento"), eq(catalogos.farmId, createdId)));
      const programs = await db.select().from(feedPrograms);
      expect(feeds.length).toBe(STARTER_FEED_DEFINITIONS.length);
      expect(stages.length).toBe(STARTER_STAGE_PROGRAMS.length);
      expect(programs.length).toBeGreaterThan(20);
    });
  });
});

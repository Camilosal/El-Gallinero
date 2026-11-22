import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getSessionUser } from "@/lib/auth";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentMemories, farms, users, weightLogs } from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { getStandardCurve } from "@/lib/standard-curves";
import { computeEmpiricalCurveCalibration } from "@/lib/zootechnics";
import { learnFromBiologicalCalibrationAction } from "@/lib/agent/ui-memory-bridge";
import { recallRelevantMemories, saveFarmMemory } from "@/lib/agent/memory";
import { collectBriefingFindings, detectOperationalMemoryContext } from "@/lib/agent/proactive";
import { GET as curvasGET } from "@/app/api/analisis/curvas/route";
import {
  BEHAVIORAL_NUDGE_GROUPS,
  computeNudgeUtilityScore,
  getNudgeFeedbackMap,
  pickAdaptiveNudge,
  recordNudgeFeedback,
} from "@/lib/behavioral-nudges";
import { mockRequest, parseJson } from "./helpers";

function createMemoryStorage(): Pick<Storage, "getItem" | "setItem"> {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe("Capacidad 1 · Autocalibración empírica de curvas biológicas", () => {
  const tempUserId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(users).values({
      id: tempUserId,
      username: `cal_${tempUserId.slice(0, 8)}`,
      passwordHash: "hash-not-used",
      name: "Operador Calibración",
      role: "propietario",
      farmId: DEFAULT_FARM_ID,
    });
  });

  afterAll(async () => {
    await runWithFarmContext(DEFAULT_FARM_ID, async () => {
      await db.delete(agentMemories).where(eq(agentMemories.userId, tempUserId));
    });
    await db.delete(users).where(eq(users.id, tempUserId));
  });

  it("aplica encogimiento Bayesiano, filtra outliers y escala puntos calibrados", () => {
    const curve = getStandardCurve("pollo")!;
    expect(curve).toBeDefined();

    const emptyCal = computeEmpiricalCurveCalibration({
      points: curve.points,
      observations: [],
      environmentFactor: 0.97,
    });
    expect(emptyCal.empiricalFactor).toBe(1);
    expect(emptyCal.status).toBe("sin_historial");
    expect(emptyCal.confidencePct).toBe(0);

    // Con N=2 observaciones +10%, el encogimiento (K=4 -> 2/6) no sobreajusta al 100%
    const twoObs = [2, 4].map((w) => {
      const pt = curve.points.find((p) => p.week === w)!;
      return { week: w, actualValue: pt.target * 1.1, sampleSize: 20, ageDaysFromNow: 2 };
    });
    const learningCal = computeEmpiricalCurveCalibration({
      points: curve.points,
      observations: twoObs,
    });
    expect(learningCal.status).toBe("en_aprendizaje");
    expect(learningCal.empiricalFactor).toBeGreaterThan(1.01);
    expect(learningCal.empiricalFactor).toBeLessThan(1.06);

    // Con N=5 observaciones consistentes +10% y 1 outlier extremo (3x), filtra el outlier y alcanza estado calibrada
    const richObs = [1, 2, 3, 4, 5].map((w) => {
      const pt = curve.points.find((p) => p.week === w)!;
      return { week: w, actualValue: pt.target * 1.1, sampleSize: 30, ageDaysFromNow: 1 };
    });
    richObs.push({
      week: 3,
      actualValue: curve.points.find((p) => p.week === 3)!.target * 3.2,
      sampleSize: 5,
      ageDaysFromNow: 0,
    });

    const fullCal = computeEmpiricalCurveCalibration({
      points: curve.points,
      observations: richObs,
    });
    expect(fullCal.observationCount).toBe(5);
    expect(fullCal.status).toBe("calibrada");
    expect(fullCal.confidencePct).toBeGreaterThanOrEqual(55);
    expect(fullCal.empiricalFactor).toBeGreaterThan(1.05);
    expect(fullCal.calibratedPoints[1].target).toBeGreaterThan(curve.points[1].target);
  });

  it("GET /api/analisis/curvas retorna calibratedCurve + empiricalCalibration y persiste memoria biométrica", async () => {
    await runWithFarmContext(DEFAULT_FARM_ID, async () => {
      const res = await curvasGET(mockRequest("http://localhost/api/analisis/curvas?species=pollo"));
      expect(res.status).toBe(200);
      const body = await parseJson(res);
      expect(body.curve?.points?.length).toBeGreaterThan(0);
      expect(body.calibratedCurve?.points?.length).toBe(body.curve.points.length);
      expect(body.empiricalCalibration).toMatchObject({
        status: expect.stringMatching(/sin_historial|en_aprendizaje|calibrada/),
      });

      const mem = await learnFromBiologicalCalibrationAction({
        userId: tempUserId,
        species: "pollo",
        breed: "Cobb 500",
        weekNumber: 4,
        avgWeightKg: 0.82,
        sampleSize: 25,
        empiricalFactor: 1.07,
        confidencePct: 60,
      });
      expect(mem?.category).toBe("lote");
      expect(mem?.content).toContain("+7%");
      expect(mem?.content).toContain("60%");
    });
  });
});

describe("Capacidad 3 · Bucle de retroalimentación adaptativo para nudges", () => {
  it("mantiene rotación exacta sin historial y prioriza útiles / enfría descartados tras interacción", () => {
    const storage = createMemoryStorage();
    const pool = BEHAVIORAL_NUDGE_GROUPS.inicio.nudges;
    const pageKey = "inicio:/inicio";

    // Sin señales de feedback, conserva secuencia determinista 0 -> 1 -> 2 -> 3
    const first = pickAdaptiveNudge(pageKey, pool, storage, { advance: true });
    const second = pickAdaptiveNudge(pageKey, pool, storage, { advance: true });
    expect(first.index).toBe(0);
    expect(second.index).toBe(1);
    expect(first.prioritizedByHistory).toBe(false);

    // Usuario acciona sobre el último nudge (idx 3) y descarta el idx 2
    const now = 1_800_000_000_000;
    const targetGood = pool[3];
    const targetDismissed = pool[2];

    recordNudgeFeedback(targetGood.id, "shown", storage, now);
    recordNudgeFeedback(targetGood.id, "acted", storage, now);
    recordNudgeFeedback(targetGood.id, "acted", storage, now);

    recordNudgeFeedback(targetDismissed.id, "shown", storage, now);
    recordNudgeFeedback(targetDismissed.id, "dismissed", storage, now);

    const feedbackMap = getNudgeFeedbackMap(storage);
    const evalGood = computeNudgeUtilityScore(targetGood.id, feedbackMap, now + 1000);
    const evalDismissed = computeNudgeUtilityScore(targetDismissed.id, feedbackMap, now + 1000);

    expect(evalGood.prioritizedByHistory).toBe(true);
    expect(evalDismissed.isCooledDown).toBe(true);
    expect(evalGood.score).toBeGreaterThan(evalDismissed.score);

    const adaptivePick = pickAdaptiveNudge(pageKey, pool, storage, { advance: true, nowMs: now + 1000 });
    expect(adaptivePick.nudge.id).toBe(targetGood.id);
    expect(adaptivePick.prioritizedByHistory).toBe(true);
  });
});


describe("Cierre punta a punta · calibratedComparison, memoria compartida por finca y briefings", () => {
  const testFarmId = crypto.randomUUID();
  const galponeroId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(farms).values({
      id: testFarmId,
      slug: `finca-adapt-${testFarmId.slice(0, 8)}`,
      name: "Finca Circuito Adaptativo",
    });
    await db.insert(users).values([
      {
        id: galponeroId,
        username: `galp_${galponeroId.slice(0, 8)}`,
        passwordHash: "hash-not-used",
        name: "Galponero Turno",
        role: "galponero",
        farmId: testFarmId,
      },
      {
        id: ownerId,
        username: `owner_${ownerId.slice(0, 8)}`,
        passwordHash: "hash-not-used",
        name: "Propietario Finca",
        role: "propietario",
        farmId: testFarmId,
      },
    ]);
  });

  afterAll(async () => {
    await runWithFarmContext(testFarmId, async () => {
      await db.delete(agentMemories);
      await db.delete(weightLogs);
    });
    await db.delete(users).where(eq(users.farmId, testFarmId));
    await db.delete(farms).where(eq(farms.id, testFarmId));
  });

  it("GET /api/analisis/curvas retorna calibratedComparison coherente con calibratedCurve", async () => {
    const curve = getStandardCurve("pollo", "Cobb 500")!;
    expect(curve).toBeDefined();
    const week4 = curve.points.find((pt) => pt.week === 4)!;
    const obsWeightKg = Number(((week4.target * 1.12) / 1000).toFixed(3));

    await runWithFarmContext(testFarmId, async () => {
      await db.insert(weightLogs).values([
        { date: "2026-11-10", species: "pollo", breed: "Cobb 500", weekNumber: 4, avgWeightKg: String(obsWeightKg), sampleSize: 25 },
        { date: "2026-11-12", species: "pollo", breed: "Cobb 500", weekNumber: 4, avgWeightKg: String(obsWeightKg), sampleSize: 25 },
        { date: "2026-11-14", species: "pollo", breed: "Cobb 500", weekNumber: 4, avgWeightKg: String(obsWeightKg), sampleSize: 25 },
        { date: "2026-11-16", species: "pollo", breed: "Cobb 500", weekNumber: 4, avgWeightKg: String(obsWeightKg), sampleSize: 25 },
      ]);

      vi.mocked(getSessionUser).mockResolvedValueOnce({
        id: ownerId,
        username: `owner_${ownerId.slice(0, 8)}`,
        name: "Propietario Finca",
        role: "propietario",
        farmId: testFarmId,
      } as any);
      const res = await curvasGET(mockRequest("http://localhost/api/analisis/curvas?species=pollo&breed=Cobb%20500"));
      expect(res.status).toBe(200);
      const body = (await parseJson(res)) as any;

      expect(body.empiricalCalibration?.status).toBe("calibrada");
      expect(body.empiricalCalibration?.empiricalFactor).toBeGreaterThan(1.03);
      expect(body.calibratedCurve?.points?.length).toBe(body.curve.points.length);

      const calWeek4 = body.calibratedCurve.points.find((pt: { week: number }) => pt.week === 4);
      expect(body.calibratedComparison).toBeTruthy();
      expect(body.calibratedComparison.week).toBe(4);
      expect(body.calibratedComparison.target).toBeCloseTo(calWeek4.target, 1);
      expect(body.calibratedComparison.target).toBeGreaterThan(body.comparison.target);
    });
  });

  it("comparte memorias operativas por farmId entre usuarios, protege preferencias privadas e inyecta contexto en briefings", async () => {
    await runWithFarmContext(testFarmId, async () => {
      await saveFarmMemory({
        userId: galponeroId,
        category: "lote",
        subjectKey: "biometria_cobb_galpon1",
        content: "Lote Cobb 500 del Galpón 1 promedia +7% sobre referencia en semana 4.",
        importance: 4,
      });
      await saveFarmMemory({
        userId: galponeroId,
        category: "preferencia",
        subjectKey: "saludo_personal_galponero",
        content: "Prefiero que Gina me hable en tono muy breve en turno de madrugada.",
        importance: 5,
      });

      const recalledByOwner = await recallRelevantMemories(ownerId, "Cobb biometría peso Galpón 1", 6);
      expect(recalledByOwner.some((m) => m.subjectKey === "biometria_cobb_galpon1")).toBe(true);
      expect(recalledByOwner.some((m) => m.subjectKey === "saludo_personal_galponero")).toBe(false);

      const memFinding = await detectOperationalMemoryContext();
      expect(memFinding).toBeTruthy();
      expect(memFinding!.code).toBe("memoria_operativa_finca");
      expect(memFinding!.detail).toContain("Lote Cobb 500");

      const findings = await collectBriefingFindings("2026-11-22");
      expect(findings.some((f) => f.code === "memoria_operativa_finca")).toBe(true);
    });
  });
});

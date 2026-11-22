import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentMemories, users } from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { getStandardCurve } from "@/lib/standard-curves";
import { computeEmpiricalCurveCalibration } from "@/lib/zootechnics";
import { learnFromBiologicalCalibrationAction } from "@/lib/agent/ui-memory-bridge";
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

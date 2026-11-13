import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { requirePermission } from "@/lib/rbac-server";
import { getSessionUser } from "@/lib/auth";
import {
  executeDay1Setup,
  getProgressiveOnboardingState,
  normalizeStarterUnits,
  updateProgressiveOnboardingState,
  type Day1SetupPayload,
} from "@/lib/onboarding-server";
import {
  PROGRESSIVE_UNLOCKABLE_KEYS,
  parseDay1StarterCsv,
  type ProducerScale,
  type ProgressiveUnlockableFlagKey,
} from "@/lib/onboarding";

export const dynamic = "force-dynamic";

/** GET /api/onboarding — estado de escala, feature flags, conteos vivos, auto-triggers e historial. */
export const GET = withApiHandler(async () => {
  const user = await getSessionUser();
  const state = await getProgressiveOnboardingState({
    evaluateTriggers: true,
    userId: user?.id ?? null,
  });
  return NextResponse.json(state);
});

/** PATCH /api/onboarding — cambio de escala, toggle manual de flag o solicitud de reportes formales. */
export const PATCH = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  const user = await getSessionUser();

  const patch: Parameters<typeof updateProgressiveOnboardingState>[0] = {};

  if (body.scale !== undefined) {
    if (body.scale !== "PEQUENO" && body.scale !== "MEDIANO") {
      return NextResponse.json({ error: "Escala inválida. Usa PEQUENO o MEDIANO." }, { status: 400 });
    }
    patch.scale = body.scale as ProducerScale;
  }

  if (body.toggleFlag && typeof body.toggleFlag === "object") {
    const key = String(body.toggleFlag.key || "") as ProgressiveUnlockableFlagKey;
    if (!PROGRESSIVE_UNLOCKABLE_KEYS.includes(key)) {
      return NextResponse.json({ error: `Feature flag desconocido o no modificable: ${key}` }, { status: 400 });
    }
    patch.toggleFlag = {
      key,
      enabled: Boolean(body.toggleFlag.enabled),
      reason: body.toggleFlag.reason ? String(body.toggleFlag.reason) : undefined,
    };
  }

  if (typeof body.solicitaReporteFormal === "boolean") {
    patch.solicitaReporteFormal = body.solicitaReporteFormal;
  }
  if (typeof body.onboardingCompleted === "boolean") {
    patch.onboardingCompleted = body.onboardingCompleted;
  }
  if (typeof body.wizardDismissed === "boolean") {
    patch.wizardDismissed = body.wizardDismissed;
  }
  if (Array.isArray(body.selectedSpecies)) {
    patch.selectedSpecies = body.selectedSpecies.map((s: unknown) => String(s));
  }

  try {
    const updated = await updateProgressiveOnboardingState(patch, user?.id ?? null);
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar onboarding progresivo";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});

/** POST /api/onboarding — ejecuta el Wizard "Día 1 sin Fricción" (formulario o CSV de arranque). */
export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("config:write");
  if (denied) return denied;
  const body = await safeParseJson(req);
  const user = await getSessionUser();

  let unidades = Array.isArray(body.unidades) ? body.unidades : [];
  if (typeof body.csvText === "string" && body.csvText.trim()) {
    const parsed = parseDay1StarterCsv(body.csvText);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      return NextResponse.json({ error: parsed.errors[0], errors: parsed.errors }, { status: 400 });
    }
    unidades = [...unidades, ...normalizeStarterUnits(parsed.rows)];
  }

  const setupPayload: Day1SetupPayload = {
    nombrePredio: String(body.nombrePredio || ""),
    ciudad: body.ciudad ? String(body.ciudad) : "",
    altitudMsnm: body.altitudMsnm === "" || body.altitudMsnm == null ? null : Number(body.altitudMsnm),
    administrador: body.administrador ? String(body.administrador) : "",
    escala: body.escala === "MEDIANO" ? "MEDIANO" : "PEQUENO",
    especies: Array.isArray(body.especies) ? body.especies.map((s: unknown) => String(s)) : ["gallina"],
    fechaInicioOperacion: body.fechaInicioOperacion ? String(body.fechaInicioOperacion) : undefined,
    solicitaReporteFormal: Boolean(body.solicitaReporteFormal),
    unidades,
    bultosConcentrado40kg: body.bultosConcentrado40kg == null ? 0 : Number(body.bultosConcentrado40kg),
    kgConcentradoAdicional: body.kgConcentradoAdicional == null ? 0 : Number(body.kgConcentradoAdicional),
    costoPorBulto40kg: body.costoPorBulto40kg == null ? undefined : Number(body.costoPorBulto40kg),
    nombreAlimentoInicial: body.nombreAlimentoInicial ? String(body.nombreAlimentoInicial) : undefined,
  };

  try {
    const result = await executeDay1Setup(setupPayload, user?.id ?? null);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al completar arranque Día 1";
    return NextResponse.json({ error: message }, { status: 400 });
  }
});


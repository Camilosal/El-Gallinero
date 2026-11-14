import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { getSessionUser } from "@/lib/auth";
import { getCurrentFarmId } from "@/db/tenant-context";
import { isValidKpiPresetId } from "@/lib/kpi-dashboard";
import {
  readUserKpiDashboardConfig,
  writeUserKpiDashboardConfig,
} from "@/lib/kpi-dashboard-server";

export const GET = withApiHandler(async () => {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const farmId = user.farmId || getCurrentFarmId();
  const result = await readUserKpiDashboardConfig({
    farmId,
    userId: user.id,
  });

  return NextResponse.json(result);
});

export const PUT = withApiHandler(async (req: NextRequest) => {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo de configuración inválido" }, { status: 400 });
  }

  if (body.preset !== undefined && !isValidKpiPresetId(body.preset)) {
    return NextResponse.json({ error: "Preset de KPIs no válido" }, { status: 400 });
  }

  if (body.widgets !== undefined && !Array.isArray(body.widgets)) {
    return NextResponse.json({ error: "La lista de widgets debe ser un arreglo" }, { status: 400 });
  }

  const farmId = user.farmId || getCurrentFarmId();
  const saved = await writeUserKpiDashboardConfig({
    farmId,
    userId: user.id,
    role: user.role,
    rawConfig: {
      preset: body.preset ?? "custom",
      widgets: body.widgets,
    },
    seedFarmDefault: body.seedFarmDefault === true,
  });

  return NextResponse.json({
    ok: true,
    ...saved,
  });
});

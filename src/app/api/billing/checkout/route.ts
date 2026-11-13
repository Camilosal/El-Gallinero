import { NextRequest, NextResponse } from "next/server";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import {
  PLAN_CATALOG,
  createWompiCheckoutSession,
  getFarmSubscriptionStatus,
} from "@/lib/subscription";

export const dynamic = "force-dynamic";

export const GET = withApiHandler(async () => {
  const status = await getFarmSubscriptionStatus();
  return NextResponse.json({
    subscription: status,
    plans: Object.values(PLAN_CATALOG),
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const planCode = String(body.planCode || "").trim();
  const method = String(body.method || "nequi").trim().toLowerCase();

  try {
    const checkout = await createWompiCheckoutSession({ planCode, method });
    return NextResponse.json({ ok: true, checkout }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo iniciar el checkout." },
      { status: 400 },
    );
  }
});


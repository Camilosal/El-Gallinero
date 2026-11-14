import { NextRequest, NextResponse } from "next/server";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { isRequestRateLimited } from "@/lib/rate-limit";
import {
  PLAN_CATALOG,
  createWompiCheckoutSession,
  getFarmSubscriptionStatus,
} from "@/lib/subscription";

export const dynamic = "force-dynamic";

function resolveCheckoutRedirectUrl(req: NextRequest): string | undefined {
  if (process.env.WOMPI_REDIRECT_URL?.trim()) {
    return process.env.WOMPI_REDIRECT_URL.trim();
  }
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const cleanHost = forwardedHost.split(",")[0].trim();
  if (
    cleanHost &&
    !cleanHost.startsWith("127.") &&
    !cleanHost.startsWith("0.0.0.0") &&
    !cleanHost.startsWith("localhost")
  ) {
    const proto = (req.headers.get("x-forwarded-proto") || "https").split(",")[0].trim();
    return `${proto}://${cleanHost}/dashboard/configuracion/plan?payment=return`;
  }
  return undefined;
}

export const GET = withApiHandler(async () => {
  const status = await getFarmSubscriptionStatus();
  return NextResponse.json({
    subscription: status,
    plans: Object.values(PLAN_CATALOG),
  });
});

export const POST = withApiHandler(async (req: NextRequest) => {
  if (
    isRequestRateLimited(req, {
      namespace: "billing-checkout",
      windowMs: 15 * 60 * 1000,
      maxAttempts: 20,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes de pago recientes. Espera unos minutos antes de generar otro enlace." },
      { status: 429 },
    );
  }

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const planCode = String(body.planCode || "").trim();
  const method = String(body.method || "nequi").trim().toLowerCase();
  const redirectUrl = resolveCheckoutRedirectUrl(req);

  try {
    const checkout = await createWompiCheckoutSession({ planCode, method, redirectUrl });
    return NextResponse.json({ ok: true, checkout }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo iniciar el checkout." },
      { status: 400 },
    );
  }
});

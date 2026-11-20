import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { processReservationsPaymentResult } from "@/lib/subscription";

export const dynamic = "force-dynamic";

function verifyReservationsSignature(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  const secret = process.env.RESERVAS_PAYMENT_RESULT_SECRET?.trim();
  if (!secret || !timestamp || !/^\d{10}$/.test(timestamp) || !signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds) || Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > 300) {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature.toLowerCase(), "hex"));
  } catch {
    return false;
  }
}

export const POST = withApiHandler(async (req: NextRequest) => {
  const secret = process.env.RESERVAS_PAYMENT_RESULT_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: "La confirmación de pagos de Reservas no está configurada." }, { status: 503 });
  }

  const rawBody = await req.text();
  if (rawBody.length > 12_000) {
    return NextResponse.json({ error: "El evento excede el tamaño permitido." }, { status: 413 });
  }
  if (!verifyReservationsSignature(
    rawBody,
    req.headers.get("x-reservas-timestamp"),
    req.headers.get("x-reservas-signature"),
  )) {
    return NextResponse.json({ error: "La firma de Reservas no es válida." }, { status: 401 });
  }

  let payload: unknown;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "El evento de pago no es válido." }, { status: 400 });
  }

  const result = await processReservationsPaymentResult(payload as Record<string, unknown>);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
});

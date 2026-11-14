import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { safeParseJson, withApiHandler } from "@/lib/api-handler";
import { RESPONSE_TIME } from "@/lib/legal";
import { notifyContactTicket, type ContactTicketPayload } from "@/lib/notifications";
import { isRequestRateLimited } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const REASON_LABELS: Record<ContactTicketPayload["reason"], string> = {
  soporte: "Soporte",
  implementacion: "Implementación (paquetes Llave en Mano)",
  datos: "Datos personales o reclamos",
};

function buildTicketCode(now: Date): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const suffix = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `PQR-${y}${m}${d}-${suffix}`;
}

export const POST = withApiHandler(async (req: NextRequest) => {
  if (
    isRequestRateLimited(req, {
      namespace: "contacto",
      windowMs: 15 * 60 * 1000,
      maxAttempts: 10,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes desde esta conexión. Intenta nuevamente en 15 minutos o escríbenos por WhatsApp." },
      { status: 429 },
    );
  }

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  // Honeypot anti-bots: si viene diligenciado, respondemos 200 sin guardar ni alertar.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return NextResponse.json({ ok: true, responseTime: RESPONSE_TIME }, { status: 200 });
  }

  const rawReason = typeof body.reason === "string" ? body.reason.trim().toLowerCase() : "soporte";
  if (rawReason !== "soporte" && rawReason !== "implementacion" && rawReason !== "datos") {
    return NextResponse.json({ error: "Selecciona un motivo válido" }, { status: 400 });
  }
  const reason: ContactTicketPayload["reason"] = rawReason;

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
  const farm = typeof body.farm === "string" ? body.farm.trim().slice(0, 160) : "";
  const contactInfo = typeof body.contactInfo === "string" ? body.contactInfo.trim().slice(0, 160) : "";
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  const discoverySource =
    typeof body.discoverySource === "string" ? body.discoverySource.trim().slice(0, 80) : "";
  const attributionSource =
    typeof body.attributionSource === "string" ? body.attributionSource.trim().slice(0, 120) : "";

  if (name.length < 2) {
    return NextResponse.json({ error: "Ingresa tu nombre (mínimo 2 caracteres)" }, { status: 400 });
  }
  if (contactInfo.length < 5) {
    return NextResponse.json(
      { error: "Ingresa tu celular o correo para poder responderte (mínimo 5 caracteres)" },
      { status: 400 },
    );
  }
  if (message.length < 10) {
    return NextResponse.json(
      { error: "Cuéntanos brevemente tu solicitud (mínimo 10 caracteres)" },
      { status: 400 },
    );
  }

  const now = new Date();
  const ticketCode = buildTicketCode(now);
  const ticket: ContactTicketPayload = {
    ticketCode,
    reason,
    reasonLabel: REASON_LABELS[reason],
    name,
    farm,
    contactInfo,
    message,
    ...(discoverySource ? { discoverySource } : {}),
    ...(attributionSource ? { attributionSource } : {}),
    createdAt: now.toISOString(),
  };

  const settingKey = `contact.ticket.${now.getTime()}_${crypto.randomBytes(3).toString("hex")}`;
  await runWithFarmContext(DEFAULT_FARM_ID, async () => {
    await db.insert(appSettings).values({
      farmId: DEFAULT_FARM_ID,
      key: settingKey,
      value: JSON.stringify(ticket),
    });
  });

  await notifyContactTicket(ticket);

  return NextResponse.json(
    {
      ok: true,
      ticketCode,
      responseTime: RESPONSE_TIME,
    },
    { status: 201 },
  );
});

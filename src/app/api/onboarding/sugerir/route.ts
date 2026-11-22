import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";
import { requirePermission } from "@/lib/rbac-server";
import { suggestOnboardingFromTextWithJev } from "@/lib/agent/jev-capabilities";

export const POST = withApiHandler(async (req: NextRequest) => {
  const denied = await requirePermission("settings:manage");
  if (denied) return denied;

  const body = await safeParseJson(req);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (description.length < 3) {
    return NextResponse.json(
      { error: "Describe brevemente tu granja (ej: '300 ponedoras y 100 pollos')." },
      { status: 400 },
    );
  }

  const suggestion = await suggestOnboardingFromTextWithJev({ description });
  return NextResponse.json({ ok: true, suggestion });
});

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { withErrorHandler, safeParseJson } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

export const GET = withErrorHandler(async () => {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  return NextResponse.json(user);
});

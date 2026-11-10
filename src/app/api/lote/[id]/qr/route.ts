import QRCode from "qrcode";
import { db } from "@/db";
import { broilerBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { isUuid } from "@/lib/ids";

export const GET = withApiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  const [batch] = await db.select({ id: broilerBatches.id }).from(broilerBatches).where(eq(broilerBatches.id, id)).limit(1);
  if (!batch) return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  const origin = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const url = `${origin}/lote/${id}`;
  const svg = await QRCode.toString(url, {
    type: "svg",
    width: 300,
    margin: 2,
    color: { dark: "#14532d", light: "#ffffff" },
  });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
});

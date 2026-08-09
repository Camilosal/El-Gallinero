import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { broilerBatches } from "@/db/schema";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [batch] = await db
    .select()
    .from(broilerBatches)
    .where(eq(broilerBatches.id, id));

  if (!batch) {
    return NextResponse.json({ error: "Lote no encontrado" }, { status: 404 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const url = `${baseUrl}/lote/${id}`;

  const svg = await QRCode.toString(url, {
    type: "svg",
    width: 300,
    margin: 2,
    color: {
      dark: "#14532d",
      light: "#ffffff",
    },
  });

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=86400",
    },
  });
}

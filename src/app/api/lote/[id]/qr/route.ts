import QRCode from "qrcode";
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler, safeParseJson } from "@/lib/api-handler";

export const GET = withApiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
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

import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { transcribeAudioBlob } from "@/lib/agent/stt";

export const dynamic = "force-dynamic";

/** POST /api/asistente/transcribir — transcribe una nota de voz en español si hay proveedor STT configurado. */
export const POST = withApiHandler(async (req: NextRequest) => {
  const formData = await req.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Archivo de audio requerido" }, { status: 400 });
  }

  const result = await transcribeAudioBlob(audio);
  if (!result.configured) {
    return NextResponse.json({ configured: false, error: result.error }, { status: result.status });
  }
  if (result.error) {
    return NextResponse.json({ configured: true, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ configured: true, text: result.text || "" });
});
import { NextRequest, NextResponse } from "next/server";
import { withApiHandler } from "@/lib/api-handler";
import { getSttConfig } from "@/lib/agent/config";

export const dynamic = "force-dynamic";

/** POST /api/asistente/transcribir — transcribe una nota de voz en español si hay proveedor STT configurado. */
export const POST = withApiHandler(async (req: NextRequest) => {
  const stt = getSttConfig();
  if (!stt) {
    return NextResponse.json(
      {
        configured: false,
        error: "Transcripción automática en servidor no configurada. Usa dictado en vivo con señal o reproduce el audio para confirmar el texto.",
      },
      { status: 501 },
    );
  }

  const formData = await req.formData().catch(() => null);
  const audio = formData?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ error: "Archivo de audio requerido" }, { status: 400 });
  }
  if (audio.size > 15 * 1024 * 1024) {
    return NextResponse.json({ error: "El audio supera el límite de 15 MB" }, { status: 400 });
  }

  const upstreamForm = new FormData();
  const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
  upstreamForm.append("file", audio, `nota-voz.${ext}`);
  upstreamForm.append("model", stt.model);
  upstreamForm.append("language", "es");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(`${stt.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${stt.apiKey}` },
      body: upstreamForm,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as any;
    if (!response.ok) {
      const detail = payload?.error?.message || `Error HTTP ${response.status}`;
      return NextResponse.json({ configured: true, error: `No se pudo transcribir el audio: ${detail}` }, { status: 502 });
    }
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    return NextResponse.json({ configured: true, text });
  } finally {
    clearTimeout(timer);
  }
});

import { getSttConfig } from "./config";

/**
 * Pipeline STT compartido (ruta /api/asistente/transcribir y notas de voz de
 * Telegram en C3). Sin proveedor configurado devuelve un resultado explícito
 * para que el canal responda con un mensaje claro, nunca en silencio.
 */

export interface SttResult {
  configured: boolean;
  text?: string;
  error?: string;
  status: number;
}

async function transcribeWithGemini(
  audio: Blob,
  stt: { baseUrl: string; apiKey: string; model: string },
  signal: AbortSignal,
): Promise<{ ok: boolean; status: number; text?: string; detail?: string }> {
  const rawMime = (audio.type || "audio/webm").split(";")[0].trim().toLowerCase();
  const mimeType = rawMime.startsWith("audio/") ? rawMime : "audio/webm";
  const base64 = Buffer.from(await audio.arrayBuffer()).toString("base64");

  const endpoint = `${stt.baseUrl}/models/${encodeURIComponent(stt.model)}:generateContent?key=${encodeURIComponent(stt.apiKey)}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: "Transcribe literalmente en español esta nota de voz operativa de una granja agropecuaria en Colombia (aves, huevos NTC 1240, galpones, bultos de concentrado, cuyes, conejos, vacunas ICA, valores COP). Devuelve únicamente el texto transcrito, sin comillas ni comentarios. Si no hay voz audible, devuelve una cadena vacía.",
            },
            { inlineData: { mimeType, data: base64 } },
          ],
        },
      ],
    }),
    signal,
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as any;
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail: payload?.error?.message || `Error HTTP ${response.status}`,
    };
  }
  const parts: Array<{ text?: string }> = payload?.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || "").join(" ").replace(/\s+/g, " ").trim();
  return { ok: true, status: 200, text };
}

export async function transcribeAudioBlob(audio: Blob): Promise<SttResult> {
  const stt = getSttConfig();
  if (!stt) {
    return {
      configured: false,
      status: 501,
      error: "Transcripción automática en servidor no configurada. Usa dictado en vivo con señal o reproduce el audio para confirmar el texto.",
    };
  }
  if (audio.size === 0) return { configured: true, status: 400, error: "Archivo de audio requerido" };
  if (audio.size > 15 * 1024 * 1024) {
    return { configured: true, status: 400, error: "El audio supera el límite de 15 MB" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    if (stt.provider === "gemini") {
      const result = await transcribeWithGemini(audio, stt, controller.signal);
      if (!result.ok) {
        return { configured: true, status: 502, error: `No se pudo transcribir el audio: ${result.detail}` };
      }
      return { configured: true, status: 200, text: result.text || "" };
    }

    const upstreamForm = new FormData();
    const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
    upstreamForm.append("file", audio, `nota-voz.${ext}`);
    upstreamForm.append("model", stt.model);
    upstreamForm.append("language", "es");

    const response = await fetch(`${stt.baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${stt.apiKey}` },
      body: upstreamForm,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as any;
    if (!response.ok) {
      const detail = payload?.error?.message || `Error HTTP ${response.status}`;
      return { configured: true, status: 502, error: `No se pudo transcribir el audio: ${detail}` };
    }
    const text = typeof payload?.text === "string" ? payload.text.trim() : "";
    return { configured: true, status: 200, text };
  } catch (error) {
    return {
      configured: true,
      status: 502,
      error: `No se pudo transcribir el audio: ${error instanceof Error ? error.message : "error desconocido"}`,
    };
  } finally {
    clearTimeout(timer);
  }
}
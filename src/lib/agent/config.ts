/**
 * Configuración del asistente IA.
 *
 * Usa cualquier API compatible con OpenAI (DeepSeek por defecto) a través de
 * fetch, sin SDK adicional. Si falta la clave, el asistente queda deshabilitado
 * y la aplicación sigue funcionando con normalidad.
 */

export interface AgentConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  maxIterations: number;
  timeoutMs: number;
  temperature: number;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function getAgentConfig(): AgentConfig | null {
  const apiKey = process.env.ASSISTANT_AI_API_KEY || process.env.DEEPSEEK_API_KEY || "";
  if (!apiKey.trim()) return null;

  return {
    baseUrl: normalizeBaseUrl(process.env.ASSISTANT_AI_BASE_URL || "https://api.deepseek.com/v1"),
    apiKey: apiKey.trim(),
    model: process.env.ASSISTANT_AI_MODEL || "deepseek-chat",
    maxIterations: Math.min(10, Math.max(1, Number(process.env.ASSISTANT_AI_MAX_ITERATIONS) || 6)),
    timeoutMs: Math.min(120_000, Math.max(5_000, Number(process.env.ASSISTANT_AI_TIMEOUT_MS) || 45_000)),
    temperature: Math.min(1, Math.max(0, Number(process.env.ASSISTANT_AI_TEMPERATURE) || 0.2)),
  };
}

export function isAgentConfigured(): boolean {
  return getAgentConfig() !== null;
}

export interface SttConfig {
  provider: "openai" | "gemini";
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function getSttConfig(): SttConfig | null {
  const explicitKey = process.env.ASSISTANT_STT_API_KEY?.trim() || "";
  const explicitBase = process.env.ASSISTANT_STT_BASE_URL?.trim() || "";
  const explicitModel = process.env.ASSISTANT_STT_MODEL?.trim() || "";

  if (explicitKey) {
    const isGemini =
      explicitBase.includes("generativelanguage.googleapis.com") ||
      explicitModel.toLowerCase().startsWith("gemini");
    return {
      provider: isGemini ? "gemini" : "openai",
      baseUrl: normalizeBaseUrl(
        explicitBase ||
          (isGemini ? "https://generativelanguage.googleapis.com/v1beta" : "https://api.openai.com/v1"),
      ),
      apiKey: explicitKey,
      model: explicitModel || (isGemini ? "gemini-3.5-transcribe" : "whisper-1"),
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim() || "";
  if (openAiKey && !explicitBase.includes("generativelanguage.googleapis.com")) {
    return {
      provider: "openai",
      baseUrl: normalizeBaseUrl(explicitBase || "https://api.openai.com/v1"),
      apiKey: openAiKey,
      model: explicitModel || "whisper-1",
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim() || "";
  if (geminiKey) {
    return {
      provider: "gemini",
      baseUrl: normalizeBaseUrl(explicitBase || "https://generativelanguage.googleapis.com/v1beta"),
      apiKey: geminiKey,
      model: explicitModel || "gemini-3.5-transcribe",
    };
  }

  return null;
}

export function isSttConfigured(): boolean {
  return getSttConfig() !== null;
}

export interface VisionConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export function getVisionConfig(): VisionConfig | null {
  const explicitKey = process.env.ASSISTANT_VISION_API_KEY?.trim() || "";
  if (explicitKey) {
    return {
      baseUrl: normalizeBaseUrl(
        process.env.ASSISTANT_VISION_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
      ),
      apiKey: explicitKey,
      model: process.env.ASSISTANT_VISION_MODEL || "gemini-3.5-flash-lite",
    };
  }

  const openAiKey = process.env.OPENAI_API_KEY?.trim() || "";
  if (openAiKey) {
    return {
      baseUrl: normalizeBaseUrl(process.env.ASSISTANT_VISION_BASE_URL || "https://api.openai.com/v1"),
      apiKey: openAiKey,
      model: process.env.ASSISTANT_VISION_MODEL || "gpt-4o-mini",
    };
  }

  const geminiKey = process.env.GEMINI_API_KEY?.trim() || "";
  if (geminiKey) {
    return {
      baseUrl: normalizeBaseUrl(
        process.env.ASSISTANT_VISION_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai",
      ),
      apiKey: geminiKey,
      model: process.env.ASSISTANT_VISION_MODEL || "gemini-3.5-flash-lite",
    };
  }

  // Fallback solo si hay un endpoint/modelo multimodal configurado explícitamente
  const aiKey = process.env.ASSISTANT_AI_API_KEY || "";
  const aiBase = process.env.ASSISTANT_AI_BASE_URL || "";
  if (aiKey.trim() && process.env.ASSISTANT_VISION_BASE_URL && !aiBase.includes("deepseek.com")) {
    return {
      baseUrl: normalizeBaseUrl(process.env.ASSISTANT_VISION_BASE_URL),
      apiKey: aiKey.trim(),
      model: process.env.ASSISTANT_VISION_MODEL || "gpt-4o-mini",
    };
  }
  return null;
}

export function isVisionConfigured(): boolean {
  return getVisionConfig() !== null;
}

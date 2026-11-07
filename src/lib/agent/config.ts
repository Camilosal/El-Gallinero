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

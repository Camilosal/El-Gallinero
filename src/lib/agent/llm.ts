import type { AgentConfig } from "./config";

/** Contrato mínimo de la API OpenAI-compatible usada por DeepSeek/OpenAI. */

export interface LlmToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: LlmToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface LlmToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LlmUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
}

export interface LlmAssistantMessage {
  role: "assistant";
  content: string | null;
  tool_calls?: LlmToolCall[];
  usage?: LlmUsage;
}

export class LlmError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "LlmError";
    this.status = status;
  }
}

function friendlyProviderError(status: number, detail: string): string {
  const text = detail.toLowerCase();

  if (status === 402 || /insufficient (balance|credits)|quota|billing/.test(text)) {
    return "El proveedor de IA no tiene saldo disponible. Recarga la cuenta del proveedor y vuelve a intentar.";
  }
  if (status === 401 || status === 403) {
    return "La clave del proveedor de IA no es válida o expiró. Revisa la configuración del asistente.";
  }
  if (status === 429) {
    return "El asistente está recibiendo demasiadas solicitudes. Espera unos segundos y vuelve a intentar.";
  }
  if (status >= 500) {
    return "El proveedor de IA no está disponible en este momento. Intenta de nuevo más tarde.";
  }
  return `Error del asistente: ${detail}`;
}

export async function callLlm(
  messages: LlmMessage[],
  tools: LlmToolDefinition[],
  config: AgentConfig,
): Promise<LlmAssistantMessage> {
  const deadline = Date.now() + config.timeoutMs;
  let attempt = 0;

  while (true) {
    attempt += 1;
    const remainingMs = Math.max(2_000, deadline - Date.now());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remainingMs);

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          tools: tools.length > 0 ? tools : undefined,
          tool_choice: tools.length > 0 ? "auto" : undefined,
          temperature: config.temperature,
          max_tokens: 1800,
        }),
        signal: controller.signal,
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as any;

      if (!response.ok) {
        const transient = response.status === 429 || response.status >= 502;
        if (transient && attempt === 1 && Date.now() + 2_500 < deadline) {
          await new Promise((r) => setTimeout(r, 450));
          continue;
        }
        const detail =
          payload?.error?.message ||
          payload?.message ||
          `El proveedor de IA respondió con estado ${response.status}`;
        throw new LlmError(friendlyProviderError(response.status, detail), response.status);
      }

      const message = payload?.choices?.[0]?.message;
      if (!message) {
        throw new LlmError("El proveedor de IA no devolvió una respuesta válida");
      }

      return {
        role: "assistant",
        content: message.content ?? null,
        tool_calls: Array.isArray(message.tool_calls) ? message.tool_calls : undefined,
        usage: payload?.usage,
      };
    } catch (error) {
      if (error instanceof LlmError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new LlmError("El asistente tardó demasiado en responder. Intenta de nuevo.");
      }
      if (attempt === 1 && Date.now() + 2_500 < deadline) {
        await new Promise((r) => setTimeout(r, 400));
        continue;
      }
      throw new LlmError(
        error instanceof Error
          ? `No se pudo conectar con el proveedor de IA: ${error.message}`
          : "No se pudo conectar con el proveedor de IA",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

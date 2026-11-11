/**
 * Enrutamiento opcional de una sola intención con TypeSafe/Jev.
 * Jev solo sugiere qué grupo de herramientas ofrecer; el agente conversacional
 * interpreta argumentos y todas las reglas de escritura siguen vigentes.
 */
import type { LlmToolDefinition } from "./llm";

export const JEV_INTENT_CRITERIA = {
  animales: "Consultar o registrar animales, adquisiciones, genética, lotes, pesajes, mortalidad o traslados.",
  produccion: "Consultar o registrar huevos, postura, incubación, autoconsumo, carne o gallinaza.",
  alimentacion_sanidad: "Consultar alimentos, alimentación, vacunas, tratamientos, controles sanitarios o salud animal.",
  lugares_mantenimiento: "Consultar lugares, activos, equipos, garantías, tareas, adecuaciones o mantenimiento.",
  finanzas: "Consultar o registrar ingresos, egresos, compras, ventas, costos, pagos o presupuestos.",
  resumen_granja: "Consultar un resumen general, inventarios, indicadores o estado general de la granja.",
  otro: "Pedir ayuda, conversar, hacer una pregunta general o solicitar varias acciones de áreas distintas.",
} as const;

export type JevIntent = keyof typeof JEV_INTENT_CRITERIA;

const TOOL_ROUTES: Record<Exclude<JevIntent, "otro">, string[]> = {
  animales: ["consultar_aves", "consultar_lotes", "consultar_trazabilidad_genetica", "consultar_ubicaciones", "registrar_mortalidad", "registrar_peso", "registrar_venta_animales"],
  produccion: ["consultar_produccion", "consultar_inventario", "registrar_produccion_huevos", "registrar_autoconsumo", "registrar_venta_huevos"],
  alimentacion_sanidad: ["consultar_sanidad", "consultar_alimentos", "consultar_aves", "consultar_ubicaciones", "registrar_consumo_alimento", "registrar_mortalidad"],
  lugares_mantenimiento: ["consultar_ubicaciones", "consultar_activos", "consultar_mantenimiento"],
  finanzas: ["consultar_finanzas", "consultar_inventario", "consultar_produccion", "registrar_gasto", "registrar_ingreso", "registrar_venta_animales", "registrar_venta_huevos"],
  resumen_granja: ["consultar_resumen_granja", "consultar_inventario", "consultar_aves", "consultar_lotes", "consultar_ubicaciones", "consultar_produccion", "consultar_finanzas", "consultar_sanidad", "consultar_mantenimiento", "consultar_activos", "consultar_alimentos", "consultar_parametros"],
};

const MIN_INTENT_PROBABILITY = 0.9;
const MIN_SINGLE_REQUEST_PROBABILITY = 0.9;

export interface JevRoutingResult {
  tools: LlmToolDefinition[];
  mode: "disabled" | "routed" | "uncertain" | "unavailable";
  intent?: JevIntent;
}

export type JevEnvironment = Record<string, string | undefined>;

function parseNoul(answer: unknown): number | null {
  const value = (answer as { noul?: unknown } | null)?.noul;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function parseIntent(answer: unknown): { intent: JevIntent; probability: number } | null {
  const value = answer as { choice?: unknown; probabilities?: unknown } | null;
  if (!value || typeof value.choice !== "string" || !(value.choice in JEV_INTENT_CRITERIA)) return null;
  const probabilities = value.probabilities as Record<string, unknown> | undefined;
  const probability = probabilities?.[value.choice];
  if (typeof probability !== "number" || !Number.isFinite(probability)) return null;
  return { intent: value.choice as JevIntent, probability };
}

export async function routeAgentTools(
  message: string,
  tools: LlmToolDefinition[],
  env: JevEnvironment = process.env as Record<string, string | undefined>,
  fetcher: typeof fetch = fetch,
): Promise<JevRoutingResult> {
  const apiKey = env.TYPESAFE_API_KEY?.trim();
  if (env.ASSISTANT_JEV_ROUTING !== "true" || !apiKey) return { tools, mode: "disabled" };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const response = await fetcher("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: env.TYPESAFE_MODEL?.trim() || "jev-latest",
        state: { user_message: message.slice(0, 4000) },
        questions: {
          intent: {
            type: "choice",
            instructions: "Which single area best matches the user's main goal in user_message?",
            criteria: JEV_INTENT_CRITERIA,
          },
          is_one_clear_request: {
            type: "noul",
            instructions: "Does user_message clearly ask for one main request that belongs to one area?",
          },
        },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`TypeSafe HTTP ${response.status}`);
    const payload = await response.json() as { answers?: Record<string, unknown> };
    const intent = parseIntent(payload.answers?.intent);
    const isOneClearRequest = parseNoul(payload.answers?.is_one_clear_request);

    // Alta exigencia: la ruta solo reduce opciones cuando hay una intención
    // única y Jev asigna probabilidad fuerte al área. En otro caso, no filtra.
    if (
      !intent || intent.intent === "otro" || intent.probability < MIN_INTENT_PROBABILITY ||
      isOneClearRequest == null || isOneClearRequest < MIN_SINGLE_REQUEST_PROBABILITY
    ) {
      return { tools, mode: "uncertain", intent: intent?.intent };
    }

    const allowed = new Set(TOOL_ROUTES[intent.intent]);
    const routed = tools.filter((tool) => allowed.has(tool.function.name));
    return routed.length > 0
      ? { tools: routed, mode: "routed", intent: intent.intent }
      : { tools, mode: "uncertain", intent: intent.intent };
  } catch (error) {
    // La respuesta conversacional existente sigue disponible; una falla de
    // Jev nunca se interpreta como una decisión ni como permiso para escribir.
    const failure = error instanceof Error && error.name === "AbortError" ? "timeout" : "unavailable";
    console.warn(`TypeSafe intent routing ${failure}; using full assistant tools`);
    return { tools, mode: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}

export function isJevRoutingEnabled(env: JevEnvironment = process.env as Record<string, string | undefined>): boolean {
  return env.ASSISTANT_JEV_ROUTING === "true" && Boolean(env.TYPESAFE_API_KEY?.trim());
}

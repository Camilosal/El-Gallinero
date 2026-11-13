/**
 * Orquestador TypeSafe/Jev (`https://api.typesafe.ai/v1/systemone`).
 *
 * Capacidades:
 * 1. Enrutamiento de intención única de alta confianza y fan-out multidominio (usando compuertas
 *    `noul` paralelas para consultas compuestas sin caer en enviar todas las 58 herramientas).
 * 2. Detección paralela de necesidad de conocimiento (`consultar_conocimiento`) y persistencia de
 *    memoria (`recordar_dato_granja`).
 * 3. Helper genérico `jevRerankCandidates` para desambiguación semántica y reranking de dos etapas
 *    sobre guías de conocimiento, lugares o lotes.
 *
 * Jev nunca escribe datos por sí mismo ni aprueba mutaciones: solo filtra herramientas y ordena
 * candidatos; ante caída o incertidumbre, hace fallback seguro sin bloquear al agente.
 */
import type { LlmToolDefinition } from "./llm";

export const JEV_INTENT_CRITERIA = {
  animales:
    "Consultar o registrar animales, traslados de aves/lotes, adquisiciones, genética, lotes, pesajes, mortalidad, sacrificio/faena, reproducción de conejos/cuyes o incubación.",
  produccion:
    "Consultar o registrar huevos (NTC 1240), postura, incubación, autoconsumo, sacrificio/carne, gallinaza/ajustes o sensores en galpón.",
  alimentacion_sanidad:
    "Consultar o registrar alimentos, programas nutricionales por etapa, insumos/movimientos, predicción/FCR, vacunas, tratamientos, controles sanitarios, bioseguridad POE GAB/Res. 8452 o compostaje.",
  lugares_mantenimiento:
    "Consultar, crear o editar lugares de manejo, trasladar animales, activos, equipos, mantenimiento, sensores IoT, compostaje, rutina diaria, calendario o cierre diario.",
  finanzas:
    "Consultar o registrar ingresos, egresos, adquisiciones, compras, ventas, presupuestos comparativos, cuentas por cobrar/pagar, abonos/pagos, contabilidad analítica, prorrateo de costos o contactos.",
  resumen_granja:
    "Consultar un resumen general, KPIs zootécnicos, inventarios, contabilidad analítica, rutina de hoy, manual de procedimientos o memoria operativa de la granja.",
  otro: "Pedir ayuda general, conversar o combinar múltiples áreas no cubiertas claramente por una sola.",
} as const;

export type JevIntent = keyof typeof JEV_INTENT_CRITERIA;
export type JevDomain = Exclude<JevIntent, "otro">;

export const TOOL_ROUTES: Record<JevDomain, string[]> = {
  animales: [
    "consultar_aves",
    "consultar_lotes",
    "consultar_trazabilidad_genetica",
    "consultar_reproduccion",
    "consultar_incubacion",
    "consultar_ubicaciones",
    "registrar_mortalidad",
    "registrar_peso",
    "registrar_reproduccion",
    "registrar_incubacion",
    "registrar_venta_animales",
    "trasladar_animales",
    "registrar_adquisicion",
    "registrar_sacrificio_carne",
  ],
  produccion: [
    "consultar_produccion",
    "consultar_inventario",
    "consultar_incubacion",
    "consultar_cierre_y_sensores",
    "consultar_ubicaciones",
    "registrar_produccion_huevos",
    "registrar_incubacion",
    "registrar_autoconsumo",
    "registrar_lectura_sensor",
    "registrar_venta_huevos",
    "registrar_venta_carne",
    "registrar_venta_gallinaza",
    "registrar_sacrificio_carne",
    "ajustar_gallinaza",
  ],
  alimentacion_sanidad: [
    "consultar_sanidad",
    "consultar_alimentos",
    "consultar_programas_nutricion",
    "consultar_kpis_y_alimentacion",
    "consultar_bioseguridad",
    "consultar_compostaje",
    "consultar_inventario",
    "consultar_aves",
    "consultar_lotes",
    "consultar_ubicaciones",
    "registrar_consumo_alimento",
    "gestionar_alimento",
    "registrar_movimiento_insumo",
    "registrar_control_sanitario",
    "registrar_bioseguridad",
    "registrar_compostaje",
    "registrar_mortalidad",
    "ajustar_gallinaza",
  ],
  lugares_mantenimiento: [
    "consultar_ubicaciones",
    "consultar_activos",
    "consultar_mantenimiento",
    "consultar_cierre_y_sensores",
    "consultar_compostaje",
    "consultar_calendario_rutinas",
    "consultar_inventario",
    "gestionar_lugar",
    "trasladar_animales",
    "gestionar_mantenimiento",
    "registrar_movimiento_insumo",
    "registrar_lectura_sensor",
    "registrar_compostaje",
    "completar_rutina_calendario",
    "registrar_cierre_diario",
  ],
  finanzas: [
    "consultar_finanzas",
    "consultar_contabilidad_analitica",
    "consultar_presupuestos",
    "consultar_cuentas_pendientes",
    "consultar_contactos",
    "consultar_inventario",
    "consultar_produccion",
    "consultar_lotes",
    "registrar_gasto",
    "registrar_ingreso",
    "registrar_pago_cuenta",
    "registrar_adquisicion",
    "registrar_prorrateo",
    "registrar_contacto",
    "registrar_venta_animales",
    "registrar_venta_huevos",
    "registrar_venta_carne",
    "registrar_venta_gallinaza",
  ],
  resumen_granja: [
    "consultar_resumen_granja",
    "consultar_inventario",
    "consultar_aves",
    "consultar_lotes",
    "consultar_trazabilidad_genetica",
    "consultar_ubicaciones",
    "consultar_produccion",
    "consultar_finanzas",
    "consultar_sanidad",
    "consultar_mantenimiento",
    "consultar_activos",
    "consultar_alimentos",
    "consultar_programas_nutricion",
    "consultar_parametros",
    "consultar_reproduccion",
    "consultar_bioseguridad",
    "consultar_compostaje",
    "consultar_cierre_y_sensores",
    "consultar_incubacion",
    "consultar_calendario_rutinas",
    "consultar_contabilidad_analitica",
    "consultar_presupuestos",
    "consultar_cuentas_pendientes",
    "consultar_kpis_y_alimentacion",
    "consultar_contactos",
    "consultar_conocimiento",
    "consultar_memoria_granja",
    "recordar_dato_granja",
  ],
};

const MIN_INTENT_PROBABILITY = 0.9;
const MIN_SINGLE_REQUEST_PROBABILITY = 0.9;
const MIN_MULTI_DOMAIN_SCORE = 0.78;
const SYSTEMONE_URL = "https://api.typesafe.ai/v1/systemone";

export interface JevRoutingResult {
  tools: LlmToolDefinition[];
  mode: "disabled" | "routed" | "uncertain" | "unavailable";
  intent?: JevIntent;
  domains?: JevDomain[];
  needsKnowledge?: boolean;
  needsMemory?: boolean;
  model?: string;
}

export type JevEnvironment = Record<string, string | undefined>;

export interface JevQuestion {
  type: "choice" | "noul" | "score";
  instructions: string;
  criteria?: Record<string, string>;
  min?: number;
  max?: number;
}

export interface JevSystemOneResponse {
  model?: string;
  answers?: Record<string, Record<string, unknown>>;
}

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

export async function callJevSystemOne(params: {
  state: Record<string, unknown>;
  questions: Record<string, JevQuestion>;
  env?: JevEnvironment;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}): Promise<JevSystemOneResponse> {
  const env = params.env || (process.env as Record<string, string | undefined>);
  const fetcher = params.fetcher || fetch;
  const apiKey = env.TYPESAFE_API_KEY?.trim();
  if (!apiKey) throw new Error("TYPESAFE_API_KEY no configurada");

  const deadline = Date.now() + Math.min(8_000, Math.max(1_000, params.timeoutMs || 4_000));
  let attempt = 0;

  while (true) {
    attempt += 1;
    const remaining = Math.max(500, deadline - Date.now());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const response = await fetcher(SYSTEMONE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: env.TYPESAFE_MODEL?.trim() || "jev-latest",
          state: params.state,
          questions: params.questions,
        }),
        signal: controller.signal,
        cache: "no-store",
      });

      if ((response.status === 429 || response.status === 529) && attempt === 1 && Date.now() + 700 < deadline) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      if (!response.ok) throw new Error(`TypeSafe HTTP ${response.status}`);
      return (await response.json()) as JevSystemOneResponse;
    } finally {
      clearTimeout(timer);
    }
  }
}

export async function routeAgentTools(
  message: string,
  tools: LlmToolDefinition[],
  env: JevEnvironment = process.env as Record<string, string | undefined>,
  fetcher: typeof fetch = fetch,
): Promise<JevRoutingResult> {
  if (!isJevRoutingEnabled(env)) return { tools, mode: "disabled" };

  try {
    const payload = await callJevSystemOne({
      env,
      fetcher,
      timeoutMs: 3800,
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
        needs_knowledge: {
          type: "noul",
          instructions:
            "Does user_message ask how a farm procedure or app feature works, regulatory thresholds (NTC 1240, ICA, ITH, NH3, AGROSAVIA), or troubleshooting guidance?",
        },
        needs_memory: {
          type: "noul",
          instructions:
            "Does user_message state a persistent farm preference/rule/supplier/buyer to remember OR ask about a previously saved farm preference or note?",
        },
        domain_animales: {
          type: "noul",
          instructions: "Does user_message involve livestock records, batches, weighing, mortality, transfers, acquisitions, reproduction or slaughter?",
        },
        domain_produccion: {
          type: "noul",
          instructions: "Does user_message involve eggs, incubation, self-consumption, meat/manure output or barn sensor readings?",
        },
        domain_alimentacion_sanidad: {
          type: "noul",
          instructions: "Does user_message involve feed/nutrition rations, supplies, vaccines, medical withdrawal/treatments, biosecurity or composting?",
        },
        domain_lugares_mantenimiento: {
          type: "noul",
          instructions: "Does user_message involve farm locations/facilities, equipment assets, maintenance tasks, daily routines or daily closure?",
        },
        domain_finanzas: {
          type: "noul",
          instructions: "Does user_message involve sales, expenses, income, payments/receivables/payables, budgets, analytical cost allocation or contacts?",
        },
      },
    });

    const answers = payload.answers || {};
    const intent = parseIntent(answers.intent);
    const isOneClearRequest = parseNoul(answers.is_one_clear_request);
    const needsKnowledgeScore = parseNoul(answers.needs_knowledge);
    const needsMemoryScore = parseNoul(answers.needs_memory);
    const needsKnowledge = needsKnowledgeScore != null && needsKnowledgeScore >= 0.78;
    const needsMemory = needsMemoryScore != null && needsMemoryScore >= 0.78;

    const extras = new Set<string>();
    if (needsKnowledge) extras.add("consultar_conocimiento");
    if (needsMemory) {
      extras.add("consultar_memoria_granja");
      extras.add("recordar_dato_granja");
    }

    // Camino 1: intención única y categórica (alta precisión para consultas focalizadas).
    if (
      intent &&
      intent.intent !== "otro" &&
      intent.probability >= MIN_INTENT_PROBABILITY &&
      isOneClearRequest != null &&
      isOneClearRequest >= MIN_SINGLE_REQUEST_PROBABILITY
    ) {
      const allowed = new Set<string>([...TOOL_ROUTES[intent.intent], ...extras]);
      const routed = tools.filter((tool) => allowed.has(tool.function.name));
      return routed.length > 0
        ? {
            tools: routed,
            mode: "routed",
            intent: intent.intent,
            domains: [intent.intent],
            needsKnowledge,
            needsMemory,
            model: payload.model,
          }
        : { tools, mode: "uncertain", intent: intent.intent, needsKnowledge, needsMemory, model: payload.model };
    }

    // Camino 2: fan-out multidominio usando compuertas `noul` por área (1..3 áreas relevantes).
    const domainCandidates: Array<{ domain: JevDomain; score: number }> = [
      { domain: "animales", score: parseNoul(answers.domain_animales) ?? 0 },
      { domain: "produccion", score: parseNoul(answers.domain_produccion) ?? 0 },
      { domain: "alimentacion_sanidad", score: parseNoul(answers.domain_alimentacion_sanidad) ?? 0 },
      { domain: "lugares_mantenimiento", score: parseNoul(answers.domain_lugares_mantenimiento) ?? 0 },
      { domain: "finanzas", score: parseNoul(answers.domain_finanzas) ?? 0 },
    ];
    const activeDomains = domainCandidates
      .filter((d) => d.score >= MIN_MULTI_DOMAIN_SCORE)
      .map((d) => d.domain);

    if (activeDomains.length >= 1 && activeDomains.length <= 3) {
      const allowed = new Set<string>(extras);
      for (const domain of activeDomains) {
        for (const name of TOOL_ROUTES[domain]) allowed.add(name);
      }
      const routed = tools.filter((tool) => allowed.has(tool.function.name));
      if (routed.length > 0 && routed.length < tools.length) {
        return {
          tools: routed,
          mode: "routed",
          intent: activeDomains.length === 1 ? activeDomains[0] : "otro",
          domains: activeDomains,
          needsKnowledge,
          needsMemory,
          model: payload.model,
        };
      }
    }

    return {
      tools,
      mode: "uncertain",
      intent: intent?.intent,
      needsKnowledge,
      needsMemory,
      model: payload.model,
    };
  } catch (error) {
    const failure = error instanceof Error && error.name === "AbortError" ? "timeout" : "unavailable";
    console.warn(`TypeSafe intent routing ${failure}; using full assistant tools`);
    return { tools, mode: "unavailable" };
  }
}

export async function jevRerankCandidates(params: {
  query: string;
  candidates: Array<{ id: string; title: string; summary: string }>;
  env?: JevEnvironment;
  fetcher?: typeof fetch;
}): Promise<string | null> {
  const env = params.env || (process.env as Record<string, string | undefined>);
  if (!isJevRoutingEnabled(env) || params.candidates.length < 2) return null;

  const sliced = params.candidates.slice(0, 6);
  const criteria: Record<string, string> = {};
  const idByKey = new Map<string, string>();
  sliced.forEach((candidate, idx) => {
    const key = `opt_${idx}`;
    idByKey.set(key, candidate.id);
    criteria[key] = `${candidate.title}: ${candidate.summary}`.slice(0, 260);
  });

  try {
    const payload = await callJevSystemOne({
      env,
      fetcher: params.fetcher,
      timeoutMs: 2500,
      state: { query: params.query.slice(0, 1200) },
      questions: {
        best_match: {
          type: "choice",
          instructions: "Select the single candidate option that best answers or matches query.",
          criteria,
        },
        is_confident: {
          type: "noul",
          instructions: "Is best_match clearly superior to the other options for answering query?",
        },
      },
    });
    const best = payload.answers?.best_match as { choice?: unknown; probabilities?: Record<string, unknown> } | undefined;
    const confident = parseNoul(payload.answers?.is_confident);
    if (!best || typeof best.choice !== "string" || !idByKey.has(best.choice)) return null;
    const prob = Number(best.probabilities?.[best.choice] ?? 0);
    if (prob < 0.65 || (confident != null && confident < 0.6)) return null;
    return idByKey.get(best.choice) || null;
  } catch {
    return null;
  }
}

export function isJevRoutingEnabled(env: JevEnvironment = process.env as Record<string, string | undefined>): boolean {
  return env.ASSISTANT_JEV_ROUTING === "true" && Boolean(env.TYPESAFE_API_KEY?.trim());
}

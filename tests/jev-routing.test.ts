import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/species-db", () => ({
  normalizeSpecies: (value: string) => String(value || "").trim().toLowerCase() || null,
  speciesLabel: (species: string) => species,
}));

import { AGENT_TOOLS } from "@/lib/agent/tools";
import {
  TOOL_ROUTES,
  isJevRoutingEnabled,
  jevRerankCandidates,
  routeAgentTools,
} from "@/lib/agent/jev-routing";
import type { LlmToolDefinition } from "@/lib/agent/llm";

const tool = (name: string): LlmToolDefinition => ({
  type: "function",
  function: { name, description: name, parameters: { type: "object" } },
});

const sampleTools = [
  tool("consultar_activos"),
  tool("consultar_mantenimiento"),
  tool("consultar_finanzas"),
  tool("consultar_aves"),
  tool("registrar_venta_animales"),
  tool("consultar_conocimiento"),
  tool("consultar_memoria_granja"),
  tool("recordar_dato_granja"),
];
const env = { ASSISTANT_JEV_ROUTING: "true", TYPESAFE_API_KEY: "test-key" };

function jevAnswer(answers: Record<string, unknown>, model = "jev-latest", status = 200) {
  return new Response(JSON.stringify({ model, answers }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("enrutamiento opcional y re-ranking con TypeSafe Jev", () => {
  it("solo reduce herramientas ante una intención única y muy clara", async () => {
    const fetcher = vi.fn(async () =>
      jevAnswer({
        intent: { type: "choice", choice: "lugares_mantenimiento", probabilities: { lugares_mantenimiento: 0.97 } },
        is_one_clear_request: { type: "noul", noul: 0.98 },
      }),
    );
    const result = await routeAgentTools(
      "¿Dónde está la bomba de agua?",
      sampleTools.slice(0, 3),
      env,
      fetcher as typeof fetch,
    );
    expect(result.mode).toBe("routed");
    expect(result.intent).toBe("lugares_mantenimiento");
    expect(result.tools.map((item) => item.function.name)).toEqual(["consultar_activos", "consultar_mantenimiento"]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("inyecta conocimiento y memoria cuando Jev detecta intención normativa o de preferencias", async () => {
    const fetcher = vi.fn(async () =>
      jevAnswer({
        intent: { type: "choice", choice: "finanzas", probabilities: { finanzas: 0.96 } },
        is_one_clear_request: { type: "noul", noul: 0.94 },
        needs_knowledge: { type: "noul", noul: 0.89 },
        needs_memory: { type: "noul", noul: 0.84 },
      }),
    );
    const result = await routeAgentTools(
      "Recuerda que a Laura siempre le cobro según NTC 1240 las finanzas de huevos",
      sampleTools,
      env,
      fetcher as typeof fetch,
    );
    expect(result.mode).toBe("routed");
    expect(result.needsKnowledge).toBe(true);
    expect(result.needsMemory).toBe(true);
    const names = result.tools.map((item) => item.function.name);
    expect(names).toContain("consultar_finanzas");
    expect(names).toContain("consultar_conocimiento");
    expect(names).toContain("consultar_memoria_granja");
    expect(names).toContain("recordar_dato_granja");
  });

  it("ejecuta fan-out multidominio noul cuando la petición cruza 2 dominios claros", async () => {
    const fetcher = vi.fn(async () =>
      jevAnswer({
        intent: { type: "choice", choice: "otro", probabilities: { otro: 0.68 } },
        is_one_clear_request: { type: "noul", noul: 0.42 },
        domain_animales: { type: "noul", noul: 0.93 },
        domain_finanzas: { type: "noul", noul: 0.86 },
        domain_produccion: { type: "noul", noul: 0.12 },
        domain_alimentacion_sanidad: { type: "noul", noul: 0.1 },
        domain_lugares_mantenimiento: { type: "noul", noul: 0.15 },
      }),
    );
    const result = await routeAgentTools(
      "¿Qué aves activas tengo y cuánto me dejó la venta de animales este mes?",
      sampleTools,
      env,
      fetcher as typeof fetch,
    );
    expect(result.mode).toBe("routed");
    expect(result.domains).toEqual(["animales", "finanzas"]);
    const names = result.tools.map((item) => item.function.name);
    expect(names).toEqual(["consultar_finanzas", "consultar_aves", "registrar_venta_animales"]);
  });

  it("reintenta una vez ante HTTP 429 transitorio", async () => {
    let calls = 0;
    const fetcher = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return new Response("rate limit", { status: 429 });
      return jevAnswer({
        intent: { type: "choice", choice: "lugares_mantenimiento", probabilities: { lugares_mantenimiento: 0.95 } },
        is_one_clear_request: { type: "noul", noul: 0.93 },
      });
    });
    const result = await routeAgentTools("Estado de mantenimiento", sampleTools.slice(0, 3), env, fetcher as typeof fetch);
    expect(calls).toBe(2);
    expect(result.mode).toBe("routed");
  });

  it("mantiene todas las herramientas si la intención es dudosa o compuesta", async () => {
    const uncertain = await routeAgentTools(
      "Ayúdame con esto",
      sampleTools.slice(0, 3),
      env,
      vi.fn(async () =>
        jevAnswer({
          intent: { type: "choice", choice: "lugares_mantenimiento", probabilities: { lugares_mantenimiento: 0.61 } },
          is_one_clear_request: { type: "noul", noul: 0.55 },
        }),
      ) as typeof fetch,
    );
    expect(uncertain.mode).toBe("uncertain");
    expect(uncertain.tools).toEqual(sampleTools.slice(0, 3));
  });

  it("no llama a TypeSafe si el enrutamiento no fue activado explícitamente", async () => {
    const fetcher = vi.fn();
    const result = await routeAgentTools(
      "consulta",
      sampleTools.slice(0, 3),
      { TYPESAFE_API_KEY: "test-key" },
      fetcher as typeof fetch,
    );
    expect(result.mode).toBe("disabled");
    expect(result.tools).toEqual(sampleTools.slice(0, 3));
    expect(fetcher).not.toHaveBeenCalled();
    expect(isJevRoutingEnabled({ ASSISTANT_JEV_ROUTING: "true" })).toBe(false);
  });

  it("jevRerankCandidates devuelve el mejor candidato solo cuando hay alta confianza", async () => {
    const candidates = [
      { id: "guide-1", title: "Huevos NTC 1240", summary: "Pesos Jumbo, AAA y AA" },
      { id: "guide-2", title: "Compostaje", summary: "Pila AGROSAVIA" },
    ];
    const clearWinner = await jevRerankCandidates({
      query: "Peso mínimo huevo AAA",
      candidates,
      env,
      fetcher: vi.fn(async () =>
        jevAnswer({
          best_match: { type: "choice", choice: "opt_0", probabilities: { opt_0: 0.91 } },
          is_confident: { type: "noul", noul: 0.88 },
        }),
      ) as typeof fetch,
    });
    expect(clearWinner).toBe("guide-1");

    const lowConfidence = await jevRerankCandidates({
      query: "duda ambigua",
      candidates,
      env,
      fetcher: vi.fn(async () =>
        jevAnswer({
          best_match: { type: "choice", choice: "opt_1", probabilities: { opt_1: 0.72 } },
          is_confident: { type: "noul", noul: 0.41 },
        }),
      ) as typeof fetch,
    });
    expect(lowConfidence).toBeNull();

    const disabled = await jevRerankCandidates({
      query: "algo",
      candidates,
      env: { ASSISTANT_JEV_ROUTING: "false" },
    });
    expect(disabled).toBeNull();
  });

  it("cubre en TOOL_ROUTES el 100 % de las herramientas registradas en AGENT_TOOLS", () => {
    const routedNames = new Set(Object.values(TOOL_ROUTES).flat());
    for (const registered of AGENT_TOOLS) {
      expect(routedNames.has(registered.name)).toBe(true);
    }
  });
});

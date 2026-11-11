import { describe, expect, it, vi } from "vitest";
import { isJevRoutingEnabled, routeAgentTools } from "@/lib/agent/jev-routing";
import type { LlmToolDefinition } from "@/lib/agent/llm";

const tool = (name: string): LlmToolDefinition => ({
  type: "function",
  function: { name, description: name, parameters: { type: "object" } },
});

const allTools = [tool("consultar_activos"), tool("consultar_mantenimiento"), tool("consultar_finanzas")];
const env = { ASSISTANT_JEV_ROUTING: "true", TYPESAFE_API_KEY: "test-key" };

function answer(choice: string, probability: number, oneRequest: number) {
  return new Response(JSON.stringify({
    answers: {
      intent: { type: "choice", choice, probabilities: { [choice]: probability } },
      is_one_clear_request: { type: "noul", noul: oneRequest },
    },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("enrutamiento opcional con Jev", () => {
  it("solo reduce herramientas ante una intención única y muy clara", async () => {
    const fetcher = vi.fn(async () => answer("lugares_mantenimiento", 0.97, 0.98));
    const result = await routeAgentTools("¿Dónde está la bomba de agua?", allTools, env, fetcher as typeof fetch);
    expect(result.mode).toBe("routed");
    expect(result.tools.map((item) => item.function.name)).toEqual(["consultar_activos", "consultar_mantenimiento"]);
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("mantiene todas las herramientas si la intención es dudosa o compuesta", async () => {
    const uncertain = await routeAgentTools("Ayúdame con esto", allTools, env, vi.fn(async () => answer("lugares_mantenimiento", 0.61, 0.55)) as typeof fetch);
    expect(uncertain.mode).toBe("uncertain");
    expect(uncertain.tools).toEqual(allTools);
  });

  it("no llama a TypeSafe si el enrutamiento no fue activado explícitamente", async () => {
    const fetcher = vi.fn();
    const result = await routeAgentTools("consulta", allTools, { TYPESAFE_API_KEY: "test-key" }, fetcher as typeof fetch);
    expect(result.mode).toBe("disabled");
    expect(result.tools).toEqual(allTools);
    expect(fetcher).not.toHaveBeenCalled();
    expect(isJevRoutingEnabled({ ASSISTANT_JEV_ROUTING: "true" })).toBe(false);
  });
});

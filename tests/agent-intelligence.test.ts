import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { agentMemories, users } from "@/db/schema";
import { DEFAULT_FARM_ID, runWithFarmContext } from "@/db/tenant-context";
import { getSessionUser } from "@/lib/auth";
import { mockRequest, parseJson } from "./helpers";
import {
  getKnowledgeCorpus,
  getKnowledgeDigest,
  searchFarmKnowledge,
} from "@/lib/agent/knowledge";
import {
  buildDeterministicConversationSummary,
  deleteFarmMemory,
  extractDurableMemoriesFromUserText,
  extractFarmEntities,
  listFarmMemories,
  recallRelevantMemories,
  saveFarmMemory,
  scoreMemoryRelevance,
} from "@/lib/agent/memory";
import { agentStatus, sanitizeLlmHistory } from "@/lib/agent/runtime";
import { buildSystemPrompt } from "@/lib/agent/prompt";
import { formatSituationalBrief, type SituationalSnapshot } from "@/lib/agent/situational";
import { AGENT_TOOLS } from "@/lib/agent/tools";
import { __setSettingsCacheForTests } from "@/lib/settings";
import { GET as memoriaGET, POST as memoriaPOST, DELETE as memoriaDELETE } from "@/app/api/asistente/memoria/route";

function findTool(name: string) {
  const tool = AGENT_TOOLS.find((item) => item.name === name);
  if (!tool) throw new Error(`Falta herramienta ${name}`);
  return tool;
}

function mockCtx(
  get: (path: string) => Promise<unknown>,
  post: (path: string, body: unknown) => Promise<unknown> = async () => ({ ok: true }),
  put: (path: string, body: unknown) => Promise<unknown> = async () => ({ ok: true }),
  userId = "test-user",
) {
  return {
    api: { get: vi.fn(get), post: vi.fn(post), put: vi.fn(put) },
    userId,
    userName: "Usuario Prueba",
    conversationId: null,
  } as any;
}

describe("base de conocimiento y búsqueda full-doc + reranker", () => {
  it("indexa guías operativas + normas técnicas y expone digest compacto", () => {
    const corpus = getKnowledgeCorpus();
    expect(corpus.length).toBeGreaterThanOrEqual(50);
    expect(corpus.some((d) => d.source === "norma_tecnica")).toBe(true);
    expect(corpus.some((d) => d.source === "guia")).toBe(true);

    const digest = getKnowledgeDigest();
    expect(digest).toContain("NTC 1240");
    expect(digest).toContain("AGROSAVIA");
    expect(digest).toContain("consultar_conocimiento");
  });

  it("recupera normas técnicas completas (NTC 1240 y compostaje) sin truncar pasos", async () => {
    const eggRes = await searchFarmKnowledge("peso minimo huevo AAA y Jumbo NTC 1240");
    expect(eggRes.totalIndexed).toBeGreaterThanOrEqual(50);
    expect(eggRes.matches[0]?.id).toBe("std-ntc-1240-huevos");
    expect(eggRes.matches[0]?.bodyExcerpt).toContain("AAA");

    const compostRes = await searchFarmKnowledge("compostaje proporcion 3:1:1 temperatura humedad AGROSAVIA");
    expect(compostRes.matches.some((m) => m.id === "std-compostaje-agrosavia")).toBe(true);
    expect(compostRes.matches[0]?.steps.length).toBeGreaterThanOrEqual(3);
  });

  it("usa rerankFn de Jev para promover el mejor candidato y hace fallback si falla", async () => {
    const base = await searchFarmKnowledge("registrar mortalidad vacuna", { limit: 3 });
    expect(base.matches.length).toBeGreaterThanOrEqual(2);
    const secondId = base.matches[1].id;

    const promoted = await searchFarmKnowledge("registrar mortalidad vacuna", {
      limit: 3,
      rerankFn: async () => secondId,
    });
    expect(promoted.rerankedByJev).toBe(true);
    expect(promoted.matches[0].id).toBe(secondId);

    const fallback = await searchFarmKnowledge("registrar mortalidad vacuna", {
      limit: 3,
      rerankFn: async () => {
        throw new Error("timeout simulado");
      },
    });
    expect(fallback.rerankedByJev).toBe(false);
    expect(fallback.matches.length).toBeGreaterThanOrEqual(2);
  });
});

describe("memoria episódica, destilación y compactación", () => {
  const tempUserId = crypto.randomUUID();
  const tempUsername = `mem_test_${tempUserId.slice(0, 8)}`;

  beforeAll(async () => {
    await db.insert(users).values({
      id: tempUserId,
      username: tempUsername,
      passwordHash: "test-hash-not-used",
      name: "Operador Memoria",
      role: "admin",
    });
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.id, tempUserId));
  });

  it("extrae entidades zootécnicas y hechos duraderos de mensajes del usuario", () => {
    const entities = extractFarmEntities("El lote LT-204 de gallinas en galpon 2 tiene retiro ICA-12");
    expect(entities).toContain("gallina");
    expect(entities).toContain("LT-204");
    expect(entities).toContain("ICA-12");
    expect(entities).toContain("galpon 2");

    const explicit = extractDurableMemoriesFromUserText("Recuerda que Laura paga por Nequi los viernes.");
    expect(explicit.length).toBe(1);
    expect(explicit[0].importance).toBe(5);
    expect(explicit[0].content).toContain("Laura");

    const pref = extractDurableMemoriesFromUserText("Siempre prefiero que los reportes muestren costo por huevo.");
    expect(pref.length).toBe(1);
    expect(pref[0].category).toBe("preferencia");

    const rule = extractDurableMemoriesFromUserText("Nunca vender huevos de galpon en cuarentena.");
    expect(rule.length).toBe(1);
    expect(rule[0].category).toBe("restriccion");
  });

  it("puntúa memorias con entidades compartidas por encima de hechos no relacionados", () => {
    const now = Date.now();
    const relevant = scoreMemoryRelevance(
      {
        category: "comprador",
        subjectKey: "comprador_laura",
        content: "Laura compra huevos AAA de gallina en Galpón Norte los viernes",
        entities: ["gallina", "galpon norte"],
        importance: 4,
        accessCount: 3,
        updatedAt: new Date(now),
      },
      "¿A cómo le vendemos huevos de gallina a Laura?",
      now,
    );
    const unrelated = scoreMemoryRelevance(
      {
        category: "instalacion",
        subjectKey: "bomba_pozo",
        content: "La bomba sumergible necesita cambio de sello mecánico",
        entities: [],
        importance: 3,
        accessCount: 0,
        updatedAt: new Date(now - 30 * 86_400_000),
      },
      "¿A cómo le vendemos huevos de gallina a Laura?",
      now,
    );
    expect(relevant).toBeGreaterThan(unrelated);
  });

  it("construye resumen determinista al compactar historial largo", () => {
    const summary = buildDeterministicConversationSummary("Previo: revisamos lote LT-1.", [
      { role: "user", content: "Registra 120 huevos AAA" },
      { role: "tool", content: "ignorar salida técnica" },
      { role: "assistant", content: "Registrados 120 huevos AAA hoy." },
    ]);
    expect(summary).toContain("Previo: revisamos lote LT-1.");
    expect(summary).toContain("Usuario: Registra 120 huevos AAA");
    expect(summary).toContain("Asistente: Registrados 120 huevos AAA hoy.");
    expect(summary).not.toContain("ignorar salida técnica");
  });

  it("persiste, recupera (incrementando acceso), lista y elimina memorias en PostgreSQL y /api/asistente/memoria", async () => {
    const saved = await saveFarmMemory({
      userId: tempUserId,
      category: "proveedor",
      subjectKey: "italcol_concentrado",
      content: "El proveedor principal de postura es Italcol y entrega los martes.",
      importance: 5,
    });
    expect(saved.category).toBe("proveedor");
    expect(saved.entities.length).toBeGreaterThanOrEqual(0);

    // Upsert por (userId, category, subjectKey)
    const updated = await saveFarmMemory({
      userId: tempUserId,
      category: "proveedor",
      subjectKey: "italcol_concentrado",
      content: "El proveedor principal de concentrado para gallina es Italcol y entrega los miércoles.",
      importance: 5,
    });
    expect(updated.id).toBe(saved.id);

    const recalled = await recallRelevantMemories(tempUserId, "¿Qué día entrega concentrado para gallina Italcol?", 5);
    expect(recalled.some((m) => m.id === saved.id)).toBe(true);

    const refreshedAfterRecall = await listFarmMemories(tempUserId);
    expect(refreshedAfterRecall.find((m) => m.id === saved.id)?.accessCount).toBeGreaterThanOrEqual(1);

    // API CRUD con sesión mockeada al usuario temporal (withApiHandler + handler consultan getSessionUser)
    const sessionAdmin = { id: tempUserId, username: tempUsername, name: "Operador Memoria", role: "admin" };
    vi.mocked(getSessionUser).mockResolvedValue(sessionAdmin as any);
    try {
      const postRes = await memoriaPOST(
        mockRequest("http://localhost/api/asistente/memoria", {
          method: "POST",
          body: { category: "restriccion", content: "No usar agua de pozo sin clorar para pollitos", importance: 5 },
        }),
      );
      expect(postRes.status).toBe(201);
      const postBody = (await parseJson(postRes)) as any;
      const apiMemId = postBody.memory.id;

      const getRes = await memoriaGET(mockRequest("http://localhost/api/asistente/memoria?q=pollitos"));
      expect(getRes.status).toBe(200);
      const getBody = (await parseJson(getRes)) as any;
      expect(getBody.memories.some((m: any) => m.id === apiMemId)).toBe(true);

      const delRes = await memoriaDELETE(mockRequest(`http://localhost/api/asistente/memoria?id=${apiMemId}`, { method: "DELETE" }));
      expect(delRes.status).toBe(200);
    } finally {
      vi.mocked(getSessionUser).mockResolvedValue({
        id: "test-user",
        username: "test",
        name: "Test User",
        role: "admin",
        farmId: "00000000-0000-0000-0000-000000000001",
      });
    }

    const removed = await deleteFarmMemory(tempUserId, saved.id);
    expect(removed).toBe(true);
    const remaining = await listFarmMemories(tempUserId);
    expect(remaining.length).toBe(0);
  });
});

describe("identidad de finca y memoria aislada por granja", () => {
  const tempUserId = crypto.randomUUID();
  const tempUsername = `farm_scope_${tempUserId.slice(0, 8)}`;
  const otherFarmId = crypto.randomUUID();

  beforeAll(async () => {
    await db.insert(users).values({
      id: tempUserId,
      username: tempUsername,
      passwordHash: "test-hash-not-used",
      name: "Operador Multi-Finca",
      role: "propietario",
      farmId: DEFAULT_FARM_ID,
    });
  });

  afterAll(async () => {
    await db.delete(agentMemories).where(eq(agentMemories.userId, tempUserId));
    await db.delete(users).where(eq(users.id, tempUserId));
  });

  it("inyecta la identidad de la finca activa en el prompt del asistente", async () => {
    await runWithFarmContext(DEFAULT_FARM_ID, async () => {
      __setSettingsCacheForTests({
        "farm.name": "Granja La Esperanza",
        "farm.city": "Ibagué",
        "farm.department": "Tolima",
        "farm.altitude_meters": "1285",
        "farm.production_focus": "gallinas ponedoras",
      });
      try {
        const prompt = await buildSystemPrompt("Camilosal");
        expect(prompt).toContain("## Identidad de la finca activa");
        expect(prompt).toContain("Finca: Granja La Esperanza");
        expect(prompt).toContain("Ubicación: Ibagué, Tolima");
        expect(prompt).toContain("Altitud: 1285 msnm");
        expect(prompt).toContain("Actividad principal: gallinas ponedoras");
      } finally {
        __setSettingsCacheForTests(null);
      }
    });
  });

  it("omite la sección de identidad cuando la finca no tiene datos", async () => {
    const prompt = await runWithFarmContext(otherFarmId, async () => {
      __setSettingsCacheForTests(null);
      return buildSystemPrompt("Camilosal");
    });
    expect(prompt).not.toContain("## Identidad de la finca activa");
  });

  it("guarda y lista memorias separadas por finca para el mismo usuario", async () => {
    const first = await runWithFarmContext(DEFAULT_FARM_ID, () =>
      saveFarmMemory({
        userId: tempUserId,
        category: "proveedor",
        subjectKey: "proveedor_principal",
        content: "En la finca base el proveedor principal es Italcol.",
      }),
    );
    const second = await runWithFarmContext(otherFarmId, () =>
      saveFarmMemory({
        userId: tempUserId,
        category: "proveedor",
        subjectKey: "proveedor_principal",
        content: "En la segunda finca el proveedor principal es Coopegg.",
      }),
    );

    expect(first.id).not.toBe(second.id);

    const defaultFarmMemories = await runWithFarmContext(DEFAULT_FARM_ID, () =>
      listFarmMemories(tempUserId),
    );
    const otherFarmMemories = await runWithFarmContext(otherFarmId, () =>
      listFarmMemories(tempUserId),
    );

    expect(defaultFarmMemories).toHaveLength(1);
    expect(defaultFarmMemories[0].id).toBe(first.id);
    expect(defaultFarmMemories[0].content).toContain("Italcol");

    expect(otherFarmMemories).toHaveLength(1);
    expect(otherFarmMemories[0].id).toBe(second.id);
    expect(otherFarmMemories[0].content).toContain("Coopegg");
  });
});

describe("higiene de historial, estado situacional y runtime", () => {
  it("sanitizeLlmHistory elimina tool huérfanos al inicio, al medio y al final", () => {
    const dirty: any[] = [
      { role: "tool", tool_call_id: "orphan-head", content: "x" },
      { role: "user", content: "hola" },
      {
        role: "assistant",
        content: "Voy a consultar",
        tool_calls: [{ id: "tc-cut", type: "function", function: { name: "consultar_aves", arguments: "{}" } }],
      },
      { role: "user", content: "siguiente pregunta sin esperar tool" },
      {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "tc-tail", type: "function", function: { name: "consultar_finanzas", arguments: "{}" } }],
      },
    ];
    const clean = sanitizeLlmHistory(dirty);
    expect(clean[0]).toEqual({ role: "user", content: "hola" });
    expect(clean[1]).toEqual({ role: "assistant", content: "Voy a consultar" });
    expect(clean[2]).toEqual({ role: "user", content: "siguiente pregunta sin esperar tool" });
    expect(clean.length).toBe(3);
  });

  it("formatSituationalBrief resume alertas activas, retiros y estado de cierre", () => {
    const snap: SituationalSnapshot = {
      dateIso: "2026-11-12",
      activeHens: 120,
      activeRoosters: 8,
      activeBatches: 3,
      batchAnimals: 340,
      activeLocations: 6,
      todayClosed: true,
      overdueRoutines: [{ id: "r-1", name: "Lavado bebederos", nextDueDate: "2026-11-10" }],
      dueSoonRoutines: [],
      activeWithdrawals: [{ product: "Enrofloxacina", species: "pollo", until: "2026-11-18" }],
      lowStockFeeds: [{ name: "Prepico", stock: "25", minStock: "50", unit: "kg" }],
      sensorAlertsRecent: [{ metricType: "temperatura", value: "31.5", unit: "°C", ithIndex: "79" }],
      compostingAlerts: [{ code: "COMP-1", name: "Pila Sur", status: "atencion_requerida", nextTurnDueDate: "2026-11-13" }],
      overdueMaintenance: [{ title: "Revisar ventilador", scheduledDate: "2026-11-09" }],
      overdueReceivablesCount: 1,
      overduePayablesCount: 0,
    };
    const brief = formatSituationalBrief(snap);
    expect(brief).toContain("120 gallinas");
    expect(brief).toContain("CERRADO");
    expect(brief).toContain("Enrofloxacina");
    expect(brief).toContain("Prepico");
    expect(brief).toContain("ITH:79");
    expect(brief).toContain("COMP-1");
  });

  it("agentStatus reporta 58 herramientas y cobertura de conocimiento", () => {
    const status = agentStatus(null);
    expect(status.configured).toBe(false);
    expect(status.toolCount).toBe(58);
    expect(status.knowledgeCount).toBeGreaterThanOrEqual(50);
  });
});

describe("nuevas herramientas operativas del agente (prepara y ejecuta)", () => {
  it("consulta nutrición, presupuestos y cuentas pendientes", async () => {
    const ctx = mockCtx(async (url) => {
      if (url === "/api/produccion/etapas") return [{ id: "st-1", name: "Postura" }];
      if (url.startsWith("/api/produccion/etapas/resumen")) return { dias: 14, totalKg: 210 };
      if (url === "/api/presupuestos") return [{ id: "b-1", name: "Presupuesto Nov" }];
      if (url.startsWith("/api/presupuestos/comparativo")) return { totalBudget: 1000000 };
      if (url === "/api/cuentas-cobrar") return [{ id: "ar-1", buyer: "Laura", pendingAmount: 150000, isOverdue: true, status: "pendiente" }];
      if (url === "/api/cuentas-pagar") return [{ id: "ap-1", supplier: "Italcol", pendingAmount: 300000, isOverdue: false, status: "pendiente" }];
      return [];
    });

    const nut = (await findTool("consultar_programas_nutricion").execute({ dias: 14 }, ctx)) as any;
    expect(nut.resumen.totalKg).toBe(210);

    const bud = (await findTool("consultar_presupuestos").execute({ presupuesto: "Nov" }, ctx)) as any;
    expect(bud.total).toBe(1);
    expect(bud.comparativo.totalBudget).toBe(1000000);

    const ctas = (await findTool("consultar_cuentas_pendientes").execute({ tipo: "ambas" }, ctx)) as any;
    expect(ctas.resumen.porCobrarCop).toBe(150000);
    expect(ctas.resumen.porPagarCop).toBe(300000);
    expect(ctas.resumen.porCobrarVencidas).toBe(1);
  });

  it("prepara gestionar_lugar, trasladar_animales y registrar_adquisicion", async () => {
    const ctx = mockCtx(async (url) => {
      if (url.startsWith("/api/ubicaciones")) {
        return [
          { id: "loc-1", code: "LOC-1", name: "Galpón Sur", type: "galpon" },
          { id: "loc-2", code: "LOC-2", name: "Galpón Norte", type: "galpon" },
        ];
      }
      if (url === "/api/produccion/pollos") {
        return [{ id: "b-1", code: "LT-10", species: "pollo", status: "activo", currentQuantity: 80, locationId: "loc-1" }];
      }
      return [];
    });

    const prepLoc = (await findTool("gestionar_lugar").prepare!(
      { accion: "crear", nombre: "Galpón Este", tipo: "galpon", capacidad: 200 },
      ctx,
    )) as any;
    expect(prepLoc.args._method).toBe("POST");
    expect(prepLoc.summary).toContain("Galpón Este");

    const prepMove = (await findTool("trasladar_animales").prepare!(
      { tipo_animal: "lote", codigo_o_id: "LT-10", lugar_destino: "Galpón Norte", motivo: "rotacion" },
      ctx,
    )) as any;
    expect(prepMove.args.toLocationId).toBe("loc-2");
    expect(prepMove.args.animalId).toBe("b-1");

    await expect(
      findTool("registrar_adquisicion").prepare!(
        { tipo_adquisicion: "compra", tipo_animal: "lote_pollos", cantidad: 50, lugar_destino: "Galpón Norte" },
        ctx,
      ),
    ).rejects.toThrow(/costo_unitario/i);

    const prepAcq = (await findTool("registrar_adquisicion").prepare!(
      { tipo_adquisicion: "cria_propia", tipo_animal: "cuy", cantidad: 6, lugar_destino: "Galpón Sur" },
      ctx,
    )) as any;
    expect(prepAcq.args.unitCost).toBeNull();
    expect(prepAcq.args.destinationLocationId).toBe("loc-1");
  });

  it("prepara registrar_sacrificio_carne, ajustar_gallinaza, gestionar_alimento y registrar_pago_cuenta", async () => {
    const ctx = mockCtx(async (url) => {
      if (url === "/api/produccion/pollos") {
        return [{ id: "b-2", code: "LT-20", species: "pollo", status: "activo", currentQuantity: 15, locationId: "loc-1" }];
      }
      if (url.startsWith("/api/produccion/alimentacion")) {
        return [{ id: "f-1", name: "Prepico", category: "Concentrado", feedType: "Concentrado Aves", unit: "kg", currentStock: 50, minStock: "20", costPerUnit: "2500" }];
      }
      if (url === "/api/cuentas-cobrar") {
        return [{ id: "ar-9", buyer: "Don Carlos", pendingAmount: 80000, status: "pendiente" }];
      }
      if (url === "/api/inventarios/insumos") {
        return [{ id: "sup-1", name: "Creolina", unit: "L" }];
      }
      if (url === "/api/operaciones/mantenimiento") {
        return [{ id: "m-1", title: "Limpiar canaleta", status: "pendiente", scheduledDate: "2026-11-12" }];
      }
      return [];
    });

    const prepSlaughter = (await findTool("registrar_sacrificio_carne").prepare!(
      { tipo_animal: "lote", codigo_o_id: "LT-20", cantidad: 5, peso_canal_kg: 9.5, destino: "venta" },
      ctx,
    )) as any;
    expect(prepSlaughter.args.batchId).toBe("b-2");
    expect(prepSlaughter.args.destination).toBe("venta");

    const prepManure = (await findTool("ajustar_gallinaza").prepare!(
      { delta_kg: -12.5, motivo: "Merma por humedad" },
      ctx,
    )) as any;
    expect(prepManure.args.deltaKg).toBe(-12.5);

    const prepFeed = (await findTool("gestionar_alimento").prepare!(
      { nombre: "Prepico", stock_minimo: 40 },
      ctx,
    )) as any;
    expect(prepFeed.args._method).toBe("PUT");
    expect(prepFeed.args.payload.id).toBe("f-1");

    await expect(
      findTool("registrar_pago_cuenta").prepare!({ tipo: "cobro", tercero: "Carlos", monto: 120000 }, ctx),
    ).rejects.toThrow(/supera/i);

    const prepPay = (await findTool("registrar_pago_cuenta").prepare!(
      { tipo: "cobro", tercero: "Carlos", monto: 50000, metodo: "nequi" },
      ctx,
    )) as any;
    expect(prepPay.args.receivableId).toBe("ar-9");
    expect(prepPay.args.method).toBe("nequi");

    await findTool("registrar_movimiento_insumo").execute(
      { insumo: "Creolina", tipo: "salida", cantidad: 2, motivo: "desinfeccion" },
      ctx,
    );
    expect(ctx.api.post).toHaveBeenCalledWith(
      "/api/inventarios/insumos/movimientos",
      expect.objectContaining({ supplyId: "sup-1", quantity: 2, isEntry: false }),
    );

    await findTool("gestionar_mantenimiento").execute(
      { accion: "completar", id_o_titulo: "canaleta" },
      ctx,
    );
    expect(ctx.api.put).toHaveBeenCalledWith(
      "/api/operaciones/mantenimiento",
      expect.objectContaining({ id: "m-1", status: "completado" }),
    );
  });
});

describe("configuración multimodal Gemini para Visión OCR y STT", () => {
  it("resuelve getSttConfig/getVisionConfig con proveedor Gemini y limpia codecs en transcribir", async () => {
    const prev = {
      ASSISTANT_STT_BASE_URL: process.env.ASSISTANT_STT_BASE_URL,
      ASSISTANT_STT_API_KEY: process.env.ASSISTANT_STT_API_KEY,
      ASSISTANT_STT_MODEL: process.env.ASSISTANT_STT_MODEL,
      ASSISTANT_VISION_BASE_URL: process.env.ASSISTANT_VISION_BASE_URL,
      ASSISTANT_VISION_API_KEY: process.env.ASSISTANT_VISION_API_KEY,
      ASSISTANT_VISION_MODEL: process.env.ASSISTANT_VISION_MODEL,
    };
    const origFetch = globalThis.fetch;
    try {
      process.env.ASSISTANT_STT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
      process.env.ASSISTANT_STT_API_KEY = "gem-test-key";
      process.env.ASSISTANT_STT_MODEL = "gemini-3.5-transcribe";
      process.env.ASSISTANT_VISION_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
      process.env.ASSISTANT_VISION_API_KEY = "gem-test-key";
      process.env.ASSISTANT_VISION_MODEL = "gemini-3.5-flash-lite";

      const { getSttConfig, getVisionConfig } = await import("@/lib/agent/config");
      const { POST: transcribirPOST } = await import("@/app/api/asistente/transcribir/route");

      const stt = getSttConfig();
      const vis = getVisionConfig();
      expect(stt?.provider).toBe("gemini");
      expect(stt?.model).toBe("gemini-3.5-transcribe");
      expect(vis?.model).toBe("gemini-3.5-flash-lite");

      let calledUrl = "";
      let sentMime = "";
      globalThis.fetch = vi.fn(async (url: any, init: any) => {
        calledUrl = String(url);
        const body = JSON.parse(String(init?.body || "{}"));
        sentMime = body?.contents?.[0]?.parts?.[1]?.inlineData?.mimeType || "";
        return new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{ text: "Recogimos 140 huevos AAA hoy" }] } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as typeof fetch;

      const form = new FormData();
      form.append("audio", new Blob(["fake-opus"], { type: "audio/webm;codecs=opus" }), "nota.webm");
      const req = new Request("http://localhost/api/asistente/transcribir", { method: "POST", body: form }) as any;
      const res = await transcribirPOST(req);
      expect(res.status).toBe(200);
      const data = (await parseJson(res)) as any;
      expect(data.text).toBe("Recogimos 140 huevos AAA hoy");
      expect(calledUrl).toContain("models/gemini-3.5-transcribe:generateContent");
      expect(sentMime).toBe("audio/webm");
    } finally {
      globalThis.fetch = origFetch;
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });
});
